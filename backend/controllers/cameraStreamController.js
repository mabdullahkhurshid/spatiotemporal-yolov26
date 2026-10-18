const { spawn } = require('child_process');
const Camera = require('../models/Camera');
const OperatorCameraAssignment = require('../models/OperatorCameraAssignment');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { generateStreamToken, verifyStreamToken } = require('../utils/generateToken');
const { checkStreamSource, FFMPEG_PROTOCOLS } = require('../utils/streamSource');
const { authenticatedStreamUrl, redactCredentials } = require('../services/onvif');

const FFMPEG_BIN = process.env.FFMPEG_PATH || 'ffmpeg';

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

  try {
    const camera = await authorizeCameraStream(req, res);
    if (!camera) return;

    if (camera.cameraType !== 'ip_rtsp' && camera.cameraType !== 'onvif') {
      return res.status(400).json({
        success: false,
        message: 'MJPEG proxy is only required for RTSP/ONVIF cameras',
      });
    }

    if (!camera.streamUrl) {
      return res.status(400).json({ success: false, message: 'Camera has no stream URL configured' });
    }

    const source = checkStreamSource(camera.streamUrl);
    if (!source.ok) {
      return res.status(400).json({ success: false, message: source.message });
    }

    const inputArgs =
      source.kind === 'rtsp'
        ? ['-rtsp_transport', 'tcp']
        : source.kind === 'file'
          ? ['-re', '-stream_loop', '-1'] // play demo files in real time, looping
          : [];

    res.writeHead(200, {
      Connection: 'close',
      'Content-Type': 'multipart/x-mixed-replace; boundary=ffserver',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
    });

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
        authenticatedStreamUrl(camera),
        '-an',
        '-c:v',
        'mjpeg',
        '-q:v',
        '8',
        '-f',
        'mpjpeg',
        'pipe:1',
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );

    ffmpegProc.stdout.pipe(res);

    ffmpegProc.stderr.on('data', (chunk) => {
      console.error(`ffmpeg camera ${camera._id}:`, redactCredentials(chunk.toString()));
    });

    const cleanup = () => {
      if (ffmpegProc && !ffmpegProc.killed) {
        ffmpegProc.kill('SIGTERM');
      }
    };

    req.on('close', cleanup);
    req.on('aborted', cleanup);
    res.on('close', cleanup);

    ffmpegProc.on('error', (err) => {
      console.error('ffmpeg spawn error:', err.message);
      if (!res.headersSent) {
        res.status(503).json({
          success: false,
          message: 'ffmpeg is not installed or not on PATH. Set FFMPEG_PATH in .env.',
        });
      } else {
        res.end();
      }
    });

    ffmpegProc.on('close', () => {
      if (!res.writableEnded) {
        res.end();
      }
    });
  } catch (error) {
    if (ffmpegProc && !ffmpegProc.killed) {
      ffmpegProc.kill('SIGTERM');
    }
    next(error);
  }
};
