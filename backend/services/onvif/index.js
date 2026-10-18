const { OnvifError } = require('./soap');
const { normalizeTarget, probeOnvifDevice, resolveOnvifStream } = require('./device');
const { discoverOnvifDevices } = require('./discovery');
const { decryptSecret } = require('../../utils/secretBox');

// Production servers usually sit far from the cameras' LAN; discovery there would only scan the
// hosting network, so it is opt-in outside development.
const isDiscoveryEnabled = () =>
  process.env.ONVIF_DISCOVERY_ENABLED
    ? process.env.ONVIF_DISCOVERY_ENABLED === 'true'
    : process.env.NODE_ENV !== 'production';

/**
 * Stream URL with the camera's ONVIF credentials added, for server-side consumers only
 * (ffmpeg proxy, inference worker). Requires the camera loaded with `+onvif.passwordEnc`.
 */
function authenticatedStreamUrl(camera) {
  if (!camera?.streamUrl) return camera?.streamUrl;
  if (camera.cameraType !== 'onvif' || !camera.onvif?.username) return camera.streamUrl;
  try {
    const url = new URL(camera.streamUrl);
    if (url.username) return camera.streamUrl;
    url.username = camera.onvif.username;
    url.password = decryptSecret(camera.onvif.passwordEnc) || '';
    return url.toString();
  } catch (_) {
    return camera.streamUrl;
  }
}

/** Hide credentials in text that may contain stream URLs (e.g. ffmpeg error output). */
const redactCredentials = (value) => String(value).replace(/(\b[a-z][a-z0-9+.-]*:\/\/)[^/@\s]+@/gi, '$1***@');

module.exports = {
  OnvifError,
  normalizeTarget,
  probeOnvifDevice,
  resolveOnvifStream,
  discoverOnvifDevices,
  isDiscoveryEnabled,
  authenticatedStreamUrl,
  redactCredentials,
};
