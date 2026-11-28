// Demo cameras for setups without hardware. Both kinds are streams on the MediaMTX server:
//   demo_feed — a video in DEMO_VIDEOS_DIR looped by the fakecam container to demo/<clip>
//   webcam    — a browser camera published over WebRTC (WHIP) to webcam/<cameraId>
// The URL is built here from server config, never taken from the client.
const fs = require('fs');
const path = require('path');
const { authenticatedStreamUrl } = require('../services/onvif');
const { checkStreamSource } = require('./streamSource');

const DEMO_TYPES = ['demo_feed', 'webcam'];
const CLIP_ID = /^[A-Za-z0-9_-]+$/;

const isDemoType = (cameraType) => DEMO_TYPES.includes(cameraType);

// Default: on outside production.
const demoCamerasEnabled = () =>
  process.env.DEMO_CAMERAS_ENABLED !== undefined
    ? process.env.DEMO_CAMERAS_ENABLED === 'true'
    : process.env.NODE_ENV !== 'production';

const demoVideosDir = () => process.env.DEMO_VIDEOS_DIR || path.join(__dirname, '..', '..', 'demo_videos');

/** Clip ids (file names without .mp4) in the demo videos folder, read fresh on every call. */
function listDemoClips() {
  try {
    return fs
      .readdirSync(demoVideosDir(), { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.mp4'))
      .map((entry) => entry.name.slice(0, -4))
      // Same rule as infra/fakecam/run.sh, which skips other names.
      .filter((id) => CLIP_ID.test(id))
      .sort();
  } catch (_) {
    return [];
  }
}

function demoStreamPath(camera) {
  if (camera.cameraType === 'demo_feed') return camera.demo?.clip ? `demo/${camera.demo.clip}` : null;
  if (camera.cameraType === 'webcam') return `webcam/${camera._id}`;
  return null;
}

/** RTSP URL on MediaMTX with the internal read credentials, for server-side consumers only. */
function demoStreamUrl(camera) {
  const streamPath = demoStreamPath(camera);
  if (!streamPath) return null;
  const url = new URL(`${(process.env.MEDIAMTX_RTSP_URL || 'rtsp://localhost:8554').replace(/\/$/, '')}/${streamPath}`);
  if (process.env.MEDIAMTX_INTERNAL_USER) {
    url.username = process.env.MEDIAMTX_INTERNAL_USER;
    url.password = process.env.MEDIAMTX_INTERNAL_PASS || '';
  }
  return url.toString();
}

/** The URL ffmpeg / the inference worker should open for any camera type. */
const resolveStreamUrl = (camera) => (isDemoType(camera.cameraType) ? demoStreamUrl(camera) : authenticatedStreamUrl(camera));

/** { url, kind } for a server-side ffmpeg reader, or null when the camera has no usable stream.
 * `camera` must include +onvif.passwordEnc for ONVIF cameras. */
function ffmpegInput(camera) {
  if (isDemoType(camera.cameraType)) {
    const url = demoCamerasEnabled() ? demoStreamUrl(camera) : null;
    return url ? { url, kind: 'rtsp' } : null;
  }
  if (!camera.streamUrl) return null;
  const source = checkStreamSource(camera.streamUrl);
  return source.ok ? { url: authenticatedStreamUrl(camera), kind: source.kind } : null;
}

module.exports = {
  DEMO_TYPES,
  isDemoType,
  demoCamerasEnabled,
  listDemoClips,
  demoStreamPath,
  resolveStreamUrl,
  ffmpegInput,
};
