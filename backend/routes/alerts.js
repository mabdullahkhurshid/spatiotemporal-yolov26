const express = require('express');
const router = express.Router();
const {
  getAlerts,
  getAlert,
  createAlert,
  resolveAlert,
  markFalseAlarm,
  getAlertStats,
  acknowledgeAlert,
} = require('../controllers/alertController');
const { protect, authorize, requireActiveOrganization, requireVerifiedUser, requireActiveSubscription } = require('../middleware/auth');
const { validateAlert, validate } = require('../middleware/validation');

router.use(protect);
router.use(authorize('super_admin', 'org_admin', 'operator'));
router.use(requireActiveOrganization);
router.use(requireVerifiedUser);
router.use(requireActiveSubscription);

router.get('/stats', getAlertStats);
router.route('/').get(getAlerts).post(validateAlert, validate, createAlert);
router.route('/:id').get(getAlert);
router.put('/:id/resolve', authorize('super_admin', 'org_admin', 'operator'), resolveAlert);
router.put('/:id/false-alarm', authorize('super_admin', 'org_admin', 'operator'), markFalseAlarm);
router.put('/:id/acknowledge', authorize('super_admin', 'org_admin', 'operator'), acknowledgeAlert);

module.exports = router;
