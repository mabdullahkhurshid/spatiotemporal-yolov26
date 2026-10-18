// ONVIF Profile S/T device access: identity, media profiles and RTSP stream URIs.
const net = require('net');
const { soapRequest, OnvifError, text, asArray, xmlEscape } = require('./soap');
const { checkStreamSource } = require('../../utils/streamSource');

const NS = {
  device: 'http://www.onvif.org/ver10/device/wsdl',
  media: 'http://www.onvif.org/ver10/media/wsdl',
  media2: 'http://www.onvif.org/ver20/media/wsdl',
  schema: 'http://www.onvif.org/ver10/schema',
};
const MAX_PROFILES = 8;
const HOSTNAME_REGEX = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i;

const formatHost = (host) => (net.isIPv6(host) ? `[${host}]` : host);

/** Validates host/port and applies the same address policy as camera stream URLs. */
function normalizeTarget(rawHost, rawPort) {
  const host = String(rawHost || '').trim().replace(/^\[|\]$/g, '');
  if (!host || !(net.isIP(host) || HOSTNAME_REGEX.test(host))) {
    throw new OnvifError('invalid_host', 'Enter the camera IP address or host name');
  }
  const port = rawPort === undefined || rawPort === null || rawPort === '' ? 80 : Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new OnvifError('invalid_host', 'ONVIF port must be between 1 and 65535');
  }
  const policy = checkStreamSource(`http://${formatHost(host)}:${port}/`);
  if (!policy.ok) throw new OnvifError('invalid_host', policy.message);
  return { host, port, deviceUrl: `http://${formatHost(host)}:${port}/onvif/device_service` };
}

// Devices often advertise their own LAN address; behind NAT or port forwarding the address the user
// entered is the reachable one. Service URLs keep their path; stream URLs also keep their RTSP port.
function rebase(rawUrl, target, { keepPort = false } = {}) {
  try {
    const url = new URL(rawUrl);
    url.hostname = formatHost(target.host);
    if (!keepPort) url.port = String(target.port);
    return url.toString();
  } catch (_) {
    return null;
  }
}

async function getTimeOffset(deviceUrl) {
  try {
    const body = await soapRequest(deviceUrl, `<GetSystemDateAndTime xmlns="${NS.device}"/>`, { auth: false });
    const utc = body.GetSystemDateAndTimeResponse?.SystemDateAndTime?.UTCDateTime;
    if (!utc?.Date || !utc?.Time) return 0;
    const deviceNow = Date.UTC(
      Number(text(utc.Date.Year)),
      Number(text(utc.Date.Month)) - 1,
      Number(text(utc.Date.Day)),
      Number(text(utc.Time.Hour)),
      Number(text(utc.Time.Minute)),
      Number(text(utc.Time.Second))
    );
    return Number.isFinite(deviceNow) ? deviceNow - Date.now() : 0;
  } catch (error) {
    // Unreachable / not ONVIF are final; some devices require auth even for the clock, which is fine.
    if (error.code === 'auth' || error.code === 'fault') return 0;
    throw error;
  }
}

async function getDeviceInformation(deviceUrl, opts) {
  const body = await soapRequest(deviceUrl, `<GetDeviceInformation xmlns="${NS.device}"/>`, opts);
  const info = body.GetDeviceInformationResponse || {};
  return {
    manufacturer: text(info.Manufacturer),
    model: text(info.Model),
    firmwareVersion: text(info.FirmwareVersion),
    serialNumber: text(info.SerialNumber),
    hardwareId: text(info.HardwareId),
  };
}

async function getMediaServices(target, opts) {
  const services = {};
  try {
    const body = await soapRequest(
      target.deviceUrl,
      `<GetServices xmlns="${NS.device}"><IncludeCapability>false</IncludeCapability></GetServices>`,
      opts
    );
    for (const service of asArray(body.GetServicesResponse?.Service)) {
      const namespace = text(service.Namespace);
      const xaddr = rebase(text(service.XAddr), target);
      if (namespace === NS.media) services.media = xaddr;
      if (namespace === NS.media2) services.media2 = xaddr;
    }
  } catch (error) {
    if (error.code !== 'fault' && error.code !== 'not_onvif') throw error;
  }
  if (!services.media && !services.media2) {
    const body = await soapRequest(
      target.deviceUrl,
      `<GetCapabilities xmlns="${NS.device}"><Category>All</Category></GetCapabilities>`,
      opts
    );
    const xaddr = text(body.GetCapabilitiesResponse?.Capabilities?.Media?.XAddr);
    if (xaddr) services.media = rebase(xaddr, target);
  }
  return services;
}

const toProfile = (token, name, encoder) => ({
  token,
  name: name || token,
  encoding: text(encoder?.Encoding),
  width: Number(text(encoder?.Resolution?.Width)) || undefined,
  height: Number(text(encoder?.Resolution?.Height)) || undefined,
  fps: Number(text(encoder?.RateControl?.FrameRateLimit)) || undefined,
});

async function getProfiles(services, opts) {
  if (services.media) {
    const body = await soapRequest(services.media, `<GetProfiles xmlns="${NS.media}"/>`, opts);
    const all = asArray(body.GetProfilesResponse?.Profiles);
    const video = all.filter((p) => p.VideoEncoderConfiguration);
    const profiles = (video.length ? video : all).map((p) => toProfile(p['@_token'], text(p.Name), p.VideoEncoderConfiguration));
    if (profiles.length || !services.media2) return { version: 1, profiles };
  }
  const body = await soapRequest(
    services.media2,
    `<GetProfiles xmlns="${NS.media2}"><Type>VideoEncoder</Type></GetProfiles>`,
    opts
  );
  const profiles = asArray(body.GetProfilesResponse?.Profiles).map((p) =>
    toProfile(p['@_token'], text(p.Name), p.Configurations?.VideoEncoder)
  );
  return { version: 2, profiles };
}

async function getStreamUri(services, version, profileToken, target, opts) {
  let uri;
  if (version === 2) {
    const body = await soapRequest(
      services.media2,
      `<GetStreamUri xmlns="${NS.media2}"><Protocol>RTSP</Protocol><ProfileToken>${xmlEscape(profileToken)}</ProfileToken></GetStreamUri>`,
      opts
    );
    uri = text(body.GetStreamUriResponse?.Uri);
  } else {
    const body = await soapRequest(
      services.media,
      `<GetStreamUri xmlns="${NS.media}"><StreamSetup>` +
        `<Stream xmlns="${NS.schema}">RTP-Unicast</Stream>` +
        `<Transport xmlns="${NS.schema}"><Protocol>RTSP</Protocol></Transport>` +
        `</StreamSetup><ProfileToken>${xmlEscape(profileToken)}</ProfileToken></GetStreamUri>`,
      opts
    );
    uri = text(body.GetStreamUriResponse?.MediaUri?.Uri);
  }
  if (!uri) throw new OnvifError('invalid_stream', 'The camera did not return a stream address for this profile');

  const streamUrl = rebase(uri, target, { keepPort: true });
  const policy = streamUrl ? checkStreamSource(streamUrl) : { ok: false, message: 'Invalid stream address' };
  if (!policy.ok) throw new OnvifError('invalid_stream', `The camera's stream address was refused: ${policy.message}`);
  if (policy.kind !== 'rtsp' && policy.kind !== 'http') {
    throw new OnvifError('invalid_stream', 'The camera returned an unsupported stream address');
  }
  // Credentials are supplied separately and never stored in the URL.
  const clean = new URL(streamUrl);
  clean.username = '';
  clean.password = '';
  return clean.toString();
}

/** Open a session: validates the target, corrects for device clock skew, checks credentials. */
async function openSession({ host, port, username, password }) {
  const target = normalizeTarget(host, port);
  const timeOffsetMs = await getTimeOffset(target.deviceUrl);
  const opts = { username: username || undefined, password: password || '', timeOffsetMs };
  const deviceInfo = await getDeviceInformation(target.deviceUrl, opts);
  const services = await getMediaServices(target, opts);
  if (!services.media && !services.media2) {
    throw new OnvifError('no_profiles', 'The camera does not offer an ONVIF media service');
  }
  return { target, opts, deviceInfo, services };
}

/** Device identity plus every video profile with its stream address (for the "Connect" step). */
async function probeOnvifDevice(connection) {
  const session = await openSession(connection);
  const { version, profiles } = await getProfiles(session.services, session.opts);
  if (!profiles.length) throw new OnvifError('no_profiles', 'The camera has no video stream profiles');

  const withStreams = [];
  for (const profile of profiles.slice(0, MAX_PROFILES)) {
    try {
      const streamUrl = await getStreamUri(session.services, version, profile.token, session.target, session.opts);
      withStreams.push({ ...profile, streamUrl });
    } catch (error) {
      if (error.code === 'unreachable' || error.code === 'timeout' || error.code === 'auth') throw error;
      withStreams.push({ ...profile, streamUrl: null, error: error.message });
    }
  }
  return {
    host: session.target.host,
    port: session.target.port,
    deviceInfo: session.deviceInfo,
    mediaVersion: version,
    profiles: withStreams,
  };
}

/** Resolve the stream address of one profile (the first usable one when no token is given). */
async function resolveOnvifStream({ profileToken, ...connection }) {
  const session = await openSession(connection);
  const { version, profiles } = await getProfiles(session.services, session.opts);
  if (!profiles.length) throw new OnvifError('no_profiles', 'The camera has no video stream profiles');

  let candidates = profiles;
  if (profileToken) {
    candidates = profiles.filter((p) => p.token === profileToken);
    if (!candidates.length) {
      throw new OnvifError('no_profiles', 'The selected stream profile no longer exists on the camera. Connect again and pick a profile.');
    }
  }

  let lastError = null;
  for (const profile of candidates.slice(0, MAX_PROFILES)) {
    try {
      const streamUrl = await getStreamUri(session.services, version, profile.token, session.target, session.opts);
      return { host: session.target.host, port: session.target.port, deviceInfo: session.deviceInfo, profile, streamUrl };
    } catch (error) {
      if (error.code !== 'invalid_stream' && error.code !== 'fault') throw error;
      lastError = error;
    }
  }
  throw lastError || new OnvifError('invalid_stream', 'No usable stream address was found');
}

module.exports = { normalizeTarget, probeOnvifDevice, resolveOnvifStream, rebase };
