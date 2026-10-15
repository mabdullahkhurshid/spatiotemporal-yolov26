const express = require('express');
const router = express.Router();
const {
  getCameras,
  getCamera,
  createCamera,
  updateCamera,
  deleteCamera,
  updateCameraActivity,
  getCameraUsage,
  assignOperatorsToCamera,
  getDeletedCameras,
  restoreCamera,
  permanentDeleteCamera,
} = require('../controllers/cameraController');
const { protect, authorize, requireActiveOrganization, requireVerifiedUser, requireActiveSubscription } = require('../middleware/auth');
const { validateCamera, validate } = require('../middleware/validation');

router.use(protect);
router.use(authorize('super_admin', 'org_admin', 'operator'));
router.use(requireActiveOrganization);
router.use(requireVerifiedUser);
router.use(requireActiveSubscription);

router.route('/').get(getCameras).post(authorize('super_admin', 'org_admin'), validateCamera, validate, createCamera);

router.get('/usage', authorize('org_admin'), getCameraUsage);

router.get('/deleted', authorize('super_admin', 'org_admin'), getDeletedCameras);

router.route('/:id/activity').put(updateCameraActivity);

router.put('/:id/operators', authorize('org_admin'), assignOperatorsToCamera);

router.put('/:id/restore', authorize('super_admin', 'org_admin'), restoreCamera);

router.delete('/:id/permanent', authorize('super_admin', 'org_admin'), permanentDeleteCamera);

router.route('/:id')
  .get(getCamera)
  .put(authorize('super_admin', 'org_admin'), validateCamera, validate, updateCamera)
  .delete(authorize('super_admin', 'org_admin'), deleteCamera);

module.exports = router;
