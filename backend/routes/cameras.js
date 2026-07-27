const express = require('express');
const router = express.Router();
const {
  getCameras,
  getCamera,
  createCamera,
  updateCamera,
  deleteCamera,
  updateCameraActivity,
} = require('../controllers/cameraController');
const { protect, authorize, requireActiveOrganization, requireVerifiedUser, requireActiveSubscription } = require('../middleware/auth');
const { validateCamera, validate } = require('../middleware/validation');

router.use(protect);
router.use(authorize('super_admin', 'org_admin', 'operator'));
router.use(requireActiveOrganization);
router.use(requireVerifiedUser);
router.use(requireActiveSubscription);

router.route('/').get(getCameras).post(authorize('super_admin', 'org_admin'), validateCamera, validate, createCamera);

router.route('/:id/activity').put(updateCameraActivity);

router.route('/:id').get(getCamera).put(authorize('super_admin', 'org_admin'), updateCamera).delete(authorize('super_admin', 'org_admin'), deleteCamera);

module.exports = router;
