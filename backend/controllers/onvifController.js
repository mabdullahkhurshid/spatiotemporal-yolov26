const net = require('net');
const Camera = require('../models/Camera');
const {
  OnvifError,
  normalizeTarget,
  probeOnvifDevice,
  resolveOnvifStream,
  discoverOnvifDevices,
  isDiscoveryEnabled,
} = require('../services/onvif');
const { encryptSecret, decryptSecret } = require('../utils/secretBox');
const { checkStreamSource } = require('../utils/streamSource');

// Device-side failures are 502 (the camera, not the request, is the problem); the rest are fixable input.
const DEVICE_SIDE = new Set(['unreachable', 'timeout', 'not_onvif', 'fault']);

const sendOnvifError = (res, error) =>
  res.status(DEVICE_SIDE.has(error.code) ? 502 : 400).json({
    success: false,
    code: `onvif_${error.code}`,
    message: error.message,
  });

const deprovisionBlocked = (res) =>
  res.status(403).json({
    success: false,
    message: 'Your subscription is not active. Renew your plan to add or change cameras.',
  });

const sameOrg = (req, camera) =>
  req.user.role === 'super_admin' || camera.organizationId.toString() === req.user.organizationId?.toString();

/**
 * Connect to the device, resolve the selected profile's stream and store the connection on `camera`.
 * `input` fields left undefined keep the camera's stored values; an empty password keeps the stored one.
 * The camera must be loaded with `+onvif.passwordEnc` when it already exists.
 */
async function applyOnvifConnection(camera, input = {}) {
  const current = camera.onvif || {};
  const host = typeof input.host === 'string' && input.host.trim() ? input.host.trim() : current.host;
  const port = input.port !== undefined && input.port !== '' ? Number(input.port) : current.port || 80;
  const username = typeof input.username === 'string' ? input.username.trim() : current.username || '';
  let password = '';
  if (username) {
    password = typeof input.password === 'string' && input.password !== '' ? input.password : decryptSecret(current.passwordEnc) || '';
  }
  const profileToken =
    typeof input.profileToken === 'string' && input.profileToken ? input.profileToken : current.profileToken;

  const resolved = await resolveOnvifStream({ host, port, username, password, profileToken });
  const { profile, deviceInfo } = resolved;

  camera.onvif = {
    host: resolved.host,
    port: resolved.port,
    username: username || undefined,
    passwordEnc: username && password ? encryptSecret(password) : undefined,
    hasPassword: Boolean(username && password),
    profileToken: profile.token,
    profileName: profile.name,
    deviceInfo,
    lastSyncedAt: new Date(),
  };
  camera.streamUrl = resolved.streamUrl;
  camera.ipAddress = net.isIPv4(resolved.host) ? resolved.host : undefined;

  const metadata = camera.metadata || {};
  const deviceModel = [deviceInfo.manufacturer, deviceInfo.model].filter(Boolean).join(' ');
  camera.metadata = {
    model: metadata.model || deviceModel || undefined,
    resolution: metadata.resolution || (profile.width && profile.height ? `${profile.width}×${profile.height}` : undefined),
    fps: metadata.fps || profile.fps || undefined,
  };
  return camera;
}

/** True when the request changes how the device is reached (so the stream must be resolved again). */
function onvifConnectionChanged(camera, input) {
  if (!input || typeof input !== 'object') return false;
  const current = camera.onvif || {};
  return (
    (typeof input.host === 'string' && input.host.trim() && input.host.trim() !== current.host) ||
    (input.port !== undefined && input.port !== '' && Number(input.port) !== (current.port || 80)) ||
    (typeof input.username === 'string' && input.username.trim() !== (current.username || '')) ||
    (typeof input.password === 'string' && input.password !== '') ||
    (typeof input.profileToken === 'string' && input.profileToken && input.profileToken !== current.profileToken)
  );
}

// @desc    Find ONVIF cameras on the server's local network (WS-Discovery)
// @route   POST /api/cameras/onvif/discover
// @access  Private (Super Admin, Org Admin)
exports.discoverOnvif = async (req, res, next) => {
  try {
    if (req.deprovisionMode) return deprovisionBlocked(res);
    if (!isDiscoveryEnabled()) {
      return res.status(403).json({
        success: false,
        code: 'onvif_discovery_disabled',
        message: 'Network discovery is turned off on this server. Enter the camera address instead.',
      });
    }
    const timeoutMs = Math.min(parseInt(process.env.ONVIF_DISCOVERY_TIMEOUT_MS, 10) || 3000, 10000);
    const devices = (await discoverOnvifDevices({ timeoutMs })).filter(
      (device) => checkStreamSource(`http://${net.isIPv6(device.host) ? `[${device.host}]` : device.host}:${device.port}/`).ok
    );
    res.status(200).json({ success: true, count: devices.length, data: devices });
  } catch (error) {
    next(error);
  }
};

// @desc    Connect to an ONVIF device and list its stream profiles (nothing is saved)
// @route   POST /api/cameras/onvif/probe
// @access  Private (Super Admin, Org Admin)
exports.probeOnvif = async (req, res, next) => {
  try {
    if (req.deprovisionMode) return deprovisionBlocked(res);
    const { host, port, username, password, cameraId } = req.body;
    for (const [field, value] of Object.entries({ host, username, password, cameraId })) {
      if (value !== undefined && value !== null && typeof value !== 'string') {
        return res.status(400).json({ success: false, message: `Invalid ${field}` });
      }
    }

    let secret = password || '';
    // Editing a saved camera: reuse its stored password, but only against the same device and user,
    // so a stored secret can never be sent to a different address.
    if (!secret && cameraId) {
      const camera = await Camera.findById(cameraId).select('+onvif.passwordEnc').catch(() => null);
      if (!camera || camera.isDeleted || !sameOrg(req, camera)) {
        return res.status(404).json({ success: false, message: 'Camera not found' });
      }
      const target = normalizeTarget(host, port);
      if (
        camera.cameraType === 'onvif' &&
        camera.onvif?.host === target.host &&
        (camera.onvif.port || 80) === target.port &&
        (camera.onvif.username || '') === (username || '').trim()
      ) {
        secret = decryptSecret(camera.onvif.passwordEnc) || '';
      }
    }

    const result = await probeOnvifDevice({ host, port, username: (username || '').trim(), password: secret });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof OnvifError) return sendOnvifError(res, error);
    next(error);
  }
};

// @desc    Re-read the stream address from the device (e.g. after a firmware update or IP change)
// @route   POST /api/cameras/:id/onvif/refresh
// @access  Private (Super Admin, Org Admin)
exports.refreshOnvifCamera = async (req, res, next) => {
  try {
    if (req.deprovisionMode) return deprovisionBlocked(res);
    const camera = await Camera.findById(req.params.id).select('+onvif.passwordEnc');
    if (!camera || camera.isDeleted || !sameOrg(req, camera)) {
      return res.status(404).json({ success: false, message: 'Camera not found' });
    }
    if (camera.cameraType !== 'onvif') {
      return res.status(400).json({ success: false, message: 'Only ONVIF cameras can be refreshed from the device' });
    }
    await applyOnvifConnection(camera, {});
    await camera.save();
    res.status(200).json({ success: true, data: camera, message: 'Stream address refreshed from the camera' });
  } catch (error) {
    if (error instanceof OnvifError) return sendOnvifError(res, error);
    next(error);
  }
};

exports.applyOnvifConnection = applyOnvifConnection;
exports.onvifConnectionChanged = onvifConnectionChanged;
exports.sendOnvifError = sendOnvifError;
