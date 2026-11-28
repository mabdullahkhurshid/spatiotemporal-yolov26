const { spawn } = require('child_process');
const Camera = require('../models/Camera');
const OperatorCameraAssignment = require('../models/OperatorCameraAssignment');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { generateStreamToken, verifyStreamToken } = require('../utils/generateToken');
const { checkStreamSource, checkStreamHost, FFMPEG_PROTOCOLS, FFMPEG_FAST_START } = require('../utils/streamSource');
const { redactCredentials } = require('../services/onvif');
const { isDemoType, demoCamerasEnabled, resolveStreamUrl } = require('../utils/demoSource');

const FFMPEG_BIN = process.env.FFMPEG_PATH || 'ffmpeg';
const STREAM_RETRY_MS = 2000;

// Each MJPEG viewer runs its own ffmpeg, so cap them per user and in total (CPU protection).
const intEnv = (name, fallback) => parseInt(process.env[name], 10) || fallback;
const streamsPerUser = new Map(); // userId -> open MJPEG streams
let totalStreams = 0;
const liveStreamStops = new Set(); // cleanup functions of open streams (used on shutdown)

/** Reserves a stream slot; returns a release function that is safe to call more than once, or null when full. */
function acquireStreamSlot(userId) {
  const key = String(userId);
  const mine = streamsPerUser.get(key) || 0;
  if (mine >= intEnv('CAMERA_STREAM_MAX_PER_USER', 6) || totalStreams >= intEnv('CAMERA_STREAM_MAX_TOTAL', 50)) {
    return null;
  }
  streamsPerUser.set(key, mine + 1);
  totalStreams += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    totalStreams -= 1;
    const left = (streamsPerUser.get(key) || 1) - 1;
    if (left > 0) streamsPerUser.set(key, left);
    else streamsPerUser.delete(key);
  };
}

/** Ends every open MJPEG stream (graceful shutdown). */
exports.stopAllStreams = () => {
  for (const stop of [...liveStreamStops]) stop();
};
// Must match ffmpeg's -boundary_tag: the browser cannot split frames on any other boundary.
const MJPEG_BOUNDARY = 'ffmpeg';

async function authorizeCameraStream(req, res) {
  const camera = await Camera.findById(req.params.id).select('+onvif.passwordEnc');
  if (!camera || camera.isDeleted) {
    res.status(404).json({ success: false, message: 'Camera not found' });
    return null;
  }

  if (req.user.role === 'super_admin') {
    return camera;
  }
  if (camera.organizationId.toString() !== req.user.organizationId?.toString()) {
    res.status(403).json({ success: false, message: 'Not authorized' });
    return null;
  }
  if (req.user.role === 'operator') {
    const assigned = await OperatorCameraAssignment.findOne({
      operatorId: req.user._id,
      cameraId: camera._id,
    });
    if (!assigned) {
      res.status(403).json({ success: false, message: 'Not authorized' });
      return null;
    }
  }

  return camera;
}

// @desc    Issue a short-lived token for one camera's MJPEG stream (used in <img src>, which cannot send headers)
// @route   GET /api/cameras/:id/stream-token
exports.issueStreamToken = async (req, res, next) => {
  try {
    const camera = await authorizeCameraStream(req, res);
    if (!camera) return;

    const ttl = parseInt(process.env.CAMERA_STREAM_TOKEN_TTL_SEC, 10) || 60;
    res.status(200).json({
      success: true,
      data: { token: generateStreamToken(req.user._id, camera._id), expiresIn: ttl },
    });
  } catch (error) {
    next(error);
  }
};

// Authenticates the MJPEG route with ?streamToken= (camera-scoped), or falls back to the normal Bearer flow.
exports.streamAuth = async (req, res, next) => {
  const streamToken = typeof req.query.streamToken === 'string' ? req.query.streamToken : null;
  if (!streamToken) {
    return protect(req, res, next);
  }
  try {
    const decoded = verifyStreamToken(streamToken);
    if (decoded.cam !== req.params.id) {
      return res.status(401).json({ success: false, message: 'Stream token is not valid for this camera' });
    }
    const user = await User.findById(decoded.sub).select('-password');
    if (!user || user.isDeleted || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Stream token expired or invalid' });
  }
};

// @desc    MJPEG proxy for RTSP cameras (browser playback)
// @route   GET /api/cameras/:id/stream/mjpeg
exports.streamMjpeg = async (req, res, next) => {
  let ffmpegProc = null;
  let releaseSlot = null;

  try {
    const camera = await authorizeCameraStream(req, res);
    if (!camera) return;

    const isDemo = isDemoType(camera.cameraType);
    if (camera.cameraType !== 'ip_rtsp' && camera.cameraType !== 'onvif' && !isDemo) {
      return res.status(400).json({
        success: false,
        message: 'MJPEG proxy is only required for RTSP/ONVIF cameras',
      });
    }

    if (Camera.HELD_STATUSES.includes(camera.status)) {
      return res.status(409).json({ success: false, message: camera.status === 'paused' ? 'Camera is paused' : 'Camera is under maintenance' });
    }

    if (isDemo && !demoCamerasEnabled()) {
      return res.status(400).json({ success: false, message: 'Demo cameras are disabled on this server' });
    }

    if (!isDemo && !camera.streamUrl) {
      return res.status(400).json({ success: false, message: 'Camera has no stream URL configured' });
    }

    // Demo streams are built from server config (MediaMTX), so the user-URL policy does not apply.
    const source = isDemo ? { ok: true, kind: 'rtsp' } : checkStreamSource(camera.streamUrl);
    if (!source.ok) {
      return res.status(400).json({ success: false, message: source.message });
    }
    if (!isDemo) {
      const host = await checkStreamHost(camera.streamUrl);
      if (!host.ok) {
        return res.status(400).json({ success: false, message: host.message });
      }
    }

    releaseSlot = acquireStreamSlot(req.user._id);
    if (!releaseSlot) {
      return res.status(429).json({
        success: false,
        message: 'Too many live views are open. Close another live view and try again.',
      });
    }

    const inputArgs =
      source.kind === 'rtsp'
        ? ['-rtsp_transport', 'tcp', ...FFMPEG_FAST_START]
        : source.kind === 'file'
          ? ['-re', '-stream_loop', '-1'] // play demo files in real time, looping
          : [];

    res.writeHead(200, {
      Connection: 'close',
      'Content-Type': `multipart/x-mixed-replace; boundary=${MJPEG_BOUNDARY}`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      // helmet() defaults to same-origin, which makes the browser drop this <img> when the SPA runs on
      // another origin (VITE_API_URL). Access is already limited by the camera-scoped stream token.
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });

    let viewerGone = false;
    let retryTimer = null;

    // The response stays open while the viewer watches: if the camera stream drops, ffmpeg is
    // restarted and its frames continue on the same multipart response (no frozen picture).
    const startFfmpeg = () => {
      ffmpegProc = spawn(
        FFMPEG_BIN,
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-protocol_whitelist',
          FFMPEG_PROTOCOLS[source.kind],
          ...inputArgs,
          '-i',
          resolveStreamUrl(camera),
          '-an',
          '-c:v',
          'mjpeg',
          '-q:v',
          '8',
          '-f',
          'mpjpeg',
          '-boundary_tag',
          MJPEG_BOUNDARY,
          'pipe:1',
        ],
        { stdio: ['ignore', 'pipe', 'pipe'] }
      );

      ffmpegProc.stdout.pipe(res, { end: false });

      ffmpegProc.stderr.on('data', (chunk) => {
        console.error(`ffmpeg camera ${camera._id}:`, redactCredentials(chunk.toString()));
      });

      ffmpegProc.on('error', (err) => {
        console.error('ffmpeg spawn error:', err.message);
        viewerGone = true; // not installed: retrying cannot help
        res.end();
      });

      ffmpegProc.on('close', async () => {
        if (viewerGone || res.writableEnded) return;
        const current = await Camera.findById(camera._id).select('isDeleted status').catch(() => null);
        if (!current || current.isDeleted || Camera.HELD_STATUSES.includes(current.status)) {
          res.end();
          return;
        }
        retryTimer = setTimeout(() => !viewerGone && startFfmpeg(), STREAM_RETRY_MS);
      });
    };

    const cleanup = () => {
      viewerGone = true;
      clearTimeout(retryTimer);
      if (ffmpegProc && !ffmpegProc.killed) {
        ffmpegProc.kill('SIGTERM');
      }
      releaseSlot();
      if (liveStreamStops.delete(cleanup) && !res.writableEnded) res.end();
    };
    liveStreamStops.add(cleanup);

    req.on('close', cleanup);
    req.on('aborted', cleanup);
    res.on('close', cleanup);

    startFfmpeg();
  } catch (error) {
    if (ffmpegProc && !ffmpegProc.killed) {
      ffmpegProc.kill('SIGTERM');
    }
    if (releaseSlot) releaseSlot();
    next(error);
  }
};
