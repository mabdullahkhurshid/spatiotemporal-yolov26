const express = require('express');
const router = express.Router();
const {
  getCameras,
  getCamera,
  createCamera,
  updateCamera,
  deleteCamera,
  updateCameraActivity,
  pauseCamera,
  resumeCamera,
  getCameraUsage,
  assignOperatorsToCamera,
  getDeletedCameras,
  restoreCamera,
  permanentDeleteCamera,
} = require('../controllers/cameraController');
const { streamMjpeg, streamAuth, issueStreamToken } = require('../controllers/cameraStreamController');
const { getDemoFeeds, issuePublishToken } = require('../controllers/demoCameraController');
const { discoverOnvif, probeOnvif, refreshOnvifCamera } = require('../controllers/onvifController');
const { onvifLimiter } = require('../middleware/rateLimits');
const {
  protect,
  authorize,
  requireActiveOrganization,
  requireVerifiedUser,
  requireActiveSubscriptionUnlessDeprovision,
} = require('../middleware/auth');
const { validateCamera, validate } = require('../middleware/validation');

// <img src> cannot send headers, so the MJPEG proxy accepts a short-lived camera-scoped ?streamToken=
// (from GET /:id/stream-token) instead of the access token in the URL.
router.get(
  '/:id/stream/mjpeg',
  streamAuth,
  authorize('super_admin', 'org_admin', 'operator'),
  requireActiveOrganization,
  requireVerifiedUser,
  requireActiveSubscriptionUnlessDeprovision,
  streamMjpeg
);

router.use(protect);
router.use(authorize('super_admin', 'org_admin', 'operator'));
router.use(requireActiveOrganization);
router.use(requireVerifiedUser);
router.use(requireActiveSubscriptionUnlessDeprovision);

router.route('/').get(getCameras).post(authorize('super_admin', 'org_admin'), validateCamera, validate, createCamera);

router.get('/usage', authorize('org_admin'), getCameraUsage);

router.get('/demo-feeds', authorize('super_admin', 'org_admin'), getDemoFeeds);
router.get('/:id/publish-token', authorize('org_admin'), issuePublishToken);

router.get('/deleted', authorize('super_admin', 'org_admin'), getDeletedCameras);

router.post('/onvif/discover', authorize('super_admin', 'org_admin'), onvifLimiter, discoverOnvif);
router.post('/onvif/probe', authorize('super_admin', 'org_admin'), onvifLimiter, probeOnvif);
router.post('/:id/onvif/refresh', authorize('super_admin', 'org_admin'), onvifLimiter, refreshOnvifCamera);

router.get('/:id/stream-token', issueStreamToken);

router.route('/:id/activity').put(updateCameraActivity);

router.put('/:id/pause', authorize('super_admin', 'org_admin'), pauseCamera);
router.put('/:id/resume', authorize('super_admin', 'org_admin'), resumeCamera);

router.put('/:id/operators', authorize('org_admin'), assignOperatorsToCamera);

router.put('/:id/restore', authorize('super_admin', 'org_admin'), restoreCamera);

router.delete('/:id/permanent', authorize('super_admin', 'org_admin'), permanentDeleteCamera);

router.route('/:id')
  .get(getCamera)
  .put(authorize('super_admin', 'org_admin'), validateCamera, validate, updateCamera)
  .delete(authorize('super_admin', 'org_admin'), deleteCamera);

module.exports = router;
