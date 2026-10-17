const { spawn } = require('child_process');
const Camera = require('../models/Camera');
const OperatorCameraAssignment = require('../models/OperatorCameraAssignment');

const FFMPEG_BIN = process.env.FFMPEG_PATH || 'ffmpeg';

async function authorizeCameraStream(req, res) {
  const camera = await Camera.findById(req.params.id);
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
        '-rtsp_transport',
        'tcp',
        '-i',
        camera.streamUrl,
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
      console.error(`ffmpeg camera ${camera._id}:`, chunk.toString());
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
