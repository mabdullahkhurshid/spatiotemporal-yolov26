// Serves stored alert media (snapshots, explanation heatmaps) with the same access rules as alerts.
// URLs keep the historical /uploads/<kind>/<orgId>/<file>.jpg shape, so stored alert data needs no migration.
const path = require('path');
const Alert = require('../models/Alert');
const OperatorCameraAssignment = require('../models/OperatorCameraAssignment');
const {
  protect,
  requireActiveOrganization,
  requireVerifiedUser,
  requireActiveSubscription,
} = require('../middleware/auth');
const { hasValidInferenceKey } = require('../utils/safeCompare');

const UPLOADS_ROOT = path.resolve(__dirname, '..', '..', 'uploads');
const OBJECT_ID = /^[a-f0-9]{24}$/;
const FILE_NAME = /^[\w-]+\.jpg$/;
const MEDIA_ROLES = new Set(['super_admin', 'org_admin', 'operator']);

const notFound = (res) => res.status(404).json({ success: false, message: 'File not found' });
const forbidden = (res) => res.status(403).json({ success: false, message: 'Not authorized to access this file' });

/** Validates the path parts and resolves the file inside the uploads root. */
exports.parseUploadPath = (req, res, next) => {
  const { kind, orgId, file } = req.params;
  if (!OBJECT_ID.test(orgId) || !FILE_NAME.test(file)) {
    return res.status(400).json({ success: false, message: 'Invalid file path' });
  }
  const fullPath = path.resolve(UPLOADS_ROOT, kind, orgId, file);
  if (!fullPath.startsWith(UPLOADS_ROOT + path.sep)) {
    return res.status(400).json({ success: false, message: 'Invalid file path' });
  }
  req.upload = { kind, orgId, file, fullPath };
  next();
};

/** Runs middleware in order; stops when one responds instead of calling next(). */
const chain = (middlewares) => (req, res, next) => {
  let index = 0;
  const step = (err) => {
    if (err) return next(err);
    const middleware = middlewares[index++];
    if (!middleware) return next();
    Promise.resolve()
      .then(() => middleware(req, res, step))
      .catch(next);
  };
  step();
};

// Operators see media only for cameras assigned to them (same rule as alerts).
async function operatorCameraId({ kind, file }) {
  const prefix = file.split('-')[0];
  if (!OBJECT_ID.test(prefix)) return null;
  if (kind === 'snapshots') return prefix;
  const alert = await Alert.findById(prefix).select('cameraId').lean();
  return alert ? alert.cameraId : null;
}

const authorizeUpload = async (req, res, next) => {
  const user = req.user;
  if (!MEDIA_ROLES.has(user.role)) return forbidden(res);
  if (user.role === 'super_admin') return next();

  if (req.upload.orgId !== user.organizationId?.toString()) return forbidden(res);
  if (user.role === 'org_admin') return next();

  const cameraId = await operatorCameraId(req.upload);
  if (!cameraId) return forbidden(res);
  const assigned = await OperatorCameraAssignment.exists({ operatorId: user._id, cameraId });
  return assigned ? next() : forbidden(res);
};

const userAccess = chain([
  protect,
  requireActiveOrganization,
  requireVerifiedUser,
  requireActiveSubscription,
  authorizeUpload,
]);

/** The inference/explainer service (API key) or a signed-in user allowed to see this tenant's alerts. */
exports.authorizeMedia = (req, res, next) => {
  if (hasValidInferenceKey(req)) return next();
  return userAccess(req, res, next);
};

exports.sendUpload = (req, res) => {
  res.sendFile(
    req.upload.fullPath,
    { dotfiles: 'deny', headers: { 'Cache-Control': 'private, max-age=300' } },
    (err) => {
      if (err && !res.headersSent) notFound(res);
    }
  );
};
