const express = require('express');
const router = express.Router();
const {
  getAssignments,
  assignCameras,
  removeAssignment,
  getMyAssignedCameras,
} = require('../controllers/operatorAssignmentController');
const {
  protect,
  authorize,
  requireActiveOrganization,
  requireVerifiedUser,
  requireActiveSubscription,
  requireActiveSubscriptionUnlessDeprovision,
} = require('../middleware/auth');

router.use(protect);
router.use(authorize('super_admin', 'org_admin', 'operator'));
router.use(requireActiveOrganization);
router.use(requireVerifiedUser);

router.get('/my-cameras', authorize('operator'), requireActiveSubscription, getMyAssignedCameras);
// Read-only listing stays available to org admins after expiry (same rule as GET /api/cameras),
// so the Operators page still loads; changing assignments needs an active subscription.
router
  .route('/')
  .get(authorize('super_admin', 'org_admin'), requireActiveSubscriptionUnlessDeprovision, getAssignments)
  .post(authorize('super_admin', 'org_admin'), requireActiveSubscription, assignCameras);
router.delete('/:assignmentId', authorize('super_admin', 'org_admin'), requireActiveSubscription, removeAssignment);

module.exports = router;
