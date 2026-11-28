const { sameSecret } = require('../utils/safeCompare');
const Camera = require('../models/Camera');
const User = require('../models/User');
const { generatePublishToken, verifyPublishToken } = require('../utils/generateToken');
const { demoCamerasEnabled, listDemoClips } = require('../utils/demoSource');

// @desc    Whether demo cameras are enabled, and the looping videos available for demo_feed cameras
// @route   GET /api/cameras/demo-feeds
exports.getDemoFeeds = (req, res) => {
  const enabled = demoCamerasEnabled();
  res.status(200).json({
    success: true,
    data: { enabled, clips: enabled ? listDemoClips().map((id) => ({ id, name: id.replace(/[_-]+/g, ' ') })) : [] },
  });
};

// @desc    WHIP URL (with a short-lived token) for publishing this browser's camera to a webcam camera
// @route   GET /api/cameras/:id/publish-token
exports.issuePublishToken = async (req, res, next) => {
  try {
    if (!demoCamerasEnabled()) {
      return res.status(400).json({ success: false, message: 'Demo cameras are disabled on this server' });
    }
    const camera = await Camera.findById(req.params.id);
    if (!camera || camera.isDeleted) {
      return res.status(404).json({ success: false, message: 'Camera not found' });
    }
    if (camera.organizationId.toString() !== req.user.organizationId?.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    if (camera.cameraType !== 'webcam') {
      return res.status(400).json({ success: false, message: 'Only laptop camera devices can broadcast' });
    }

    const base = (process.env.MEDIAMTX_WHIP_URL || 'http://localhost:8889').replace(/\/$/, '');
    const token = generatePublishToken(req.user._id, camera._id);
    res.status(200).json({
      success: true,
      data: { whipUrl: `${base}/webcam/${camera._id}/whip?token=${encodeURIComponent(token)}` },
    });
  } catch (error) {
    next(error);
  }
};

const isInternalUser = ({ user, password }) =>
  Boolean(process.env.MEDIAMTX_INTERNAL_USER && process.env.MEDIAMTX_INTERNAL_PASS) &&
  sameSecret(user, process.env.MEDIAMTX_INTERNAL_USER) &&
  sameSecret(password, process.env.MEDIAMTX_INTERNAL_PASS);

async function canPublishWebcam(streamPath, query) {
  const match = /^webcam\/([a-f0-9]{24})$/.exec(streamPath || '');
  const token = new URLSearchParams(query || '').get('token');
  if (!match || !token) return false;

  let decoded;
  try {
    decoded = verifyPublishToken(token);
  } catch (_) {
    return false;
  }
  if (decoded.cam !== match[1]) return false;

  const [camera, user] = await Promise.all([Camera.findById(match[1]), User.findById(decoded.sub)]);
  return Boolean(
    camera &&
      !camera.isDeleted &&
      camera.cameraType === 'webcam' &&
      user &&
      !user.isDeleted &&
      user.isActive &&
      user.role === 'org_admin' &&
      user.organizationId?.toString() === camera.organizationId.toString()
  );
}

// @desc    MediaMTX HTTP auth hook (authMethod: http). 200 allows the action, anything else denies it.
//          Internal services (backend, inference, fakecam) use the shared internal user; browsers may
//          only publish to webcam/<cameraId> with a token from GET /api/cameras/:id/publish-token.
// @route   POST /api/internal/mediamtx/auth
exports.mediamtxAuth = async (req, res) => {
  try {
    const { action, path: streamPath, query } = req.body || {};
    const allowed =
      demoCamerasEnabled() &&
      (isInternalUser(req.body || {}) || (action === 'publish' && (await canPublishWebcam(streamPath, query))));
    res.status(allowed ? 200 : 401).end();
  } catch (_) {
    res.status(401).end();
  }
};
