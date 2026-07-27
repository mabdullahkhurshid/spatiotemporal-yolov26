const express = require('express');
const router = express.Router();
const {
  getSubscriptionPlans,
  getSubscriptionPlan,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deactivateSubscriptionPlan,
  reactivateSubscriptionPlan,
  deleteSubscriptionPlan,
  assignPlanToOrganization,
} = require('../controllers/subscriptionPlanController');
const { protect, authorize, requireActiveOrganization } = require('../middleware/auth');

router.use(protect);
router.use(requireActiveOrganization);

router.route('/').get(getSubscriptionPlans).post(authorize('super_admin'), createSubscriptionPlan);
router.put('/:planId/assign/:organizationId', authorize('super_admin'), assignPlanToOrganization);
router.get('/:id', getSubscriptionPlan);
router.put('/:id', authorize('super_admin'), updateSubscriptionPlan);
router.put('/:id/deactivate', authorize('super_admin'), deactivateSubscriptionPlan);
router.put('/:id/activate', authorize('super_admin'), reactivateSubscriptionPlan);
router.delete('/:id', authorize('super_admin'), deleteSubscriptionPlan);

module.exports = router;
