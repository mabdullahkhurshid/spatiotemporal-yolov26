const express = require('express');
const router = express.Router();
const {
  getOrganizations,
  getOrganization,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  approveOrganization,
  rejectOrganization,
  suspendOrganization,
  unsuspendOrganization,
} = require('../controllers/organizationController');
const { protect, authorize, checkOrganizationAccess, requireActiveOrganization, requireVerifiedUser } = require('../middleware/auth');

router.use(protect);
router.use(requireActiveOrganization);

router.route('/').get(authorize('super_admin'), getOrganizations).post(authorize('super_admin'), createOrganization);

router.put('/:id/approve', authorize('super_admin'), approveOrganization);
router.put('/:id/reject', authorize('super_admin'), rejectOrganization);
router.put('/:id/suspend', authorize('super_admin'), suspendOrganization);
router.put('/:id/unsuspend', authorize('super_admin'), unsuspendOrganization);

router
  .route('/:id')
  .get(checkOrganizationAccess, getOrganization)
  .put(checkOrganizationAccess, requireVerifiedUser, updateOrganization)
  .delete(authorize('super_admin'), deleteOrganization);

module.exports = router;
