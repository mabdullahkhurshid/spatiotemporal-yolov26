const express = require('express');
const router = express.Router();
const {
  getAssignments,
  assignCameras,
  removeAssignment,
  getMyAssignedCameras,
} = require('../controllers/operatorAssignmentController');
const { protect, authorize, requireActiveOrganization, requireVerifiedUser, requireActiveSubscription } = require('../middleware/auth');

router.use(protect);
router.use(authorize('super_admin', 'org_admin', 'operator'));
router.use(requireActiveOrganization);
router.use(requireVerifiedUser);
router.use(requireActiveSubscription);

router.get('/my-cameras', authorize('operator'), getMyAssignedCameras);
router.route('/').get(authorize('super_admin', 'org_admin'), getAssignments).post(authorize('super_admin', 'org_admin'), assignCameras);
router.delete('/:assignmentId', authorize('super_admin', 'org_admin'), removeAssignment);

module.exports = router;
