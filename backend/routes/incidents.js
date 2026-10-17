const express = require('express');
const router = express.Router();
const { getIncidents, getIncident, getIncidentStats } = require('../controllers/incidentController');
const {
  protect,
  authorize,
  requireActiveOrganization,
  requireVerifiedUser,
  requireActiveSubscription,
} = require('../middleware/auth');

router.use(protect);
router.use(authorize('super_admin', 'org_admin', 'operator'));
router.use(requireActiveOrganization);
router.use(requireVerifiedUser);
router.use(requireActiveSubscription);

router.get('/stats', getIncidentStats);
router.get('/', getIncidents);
router.get('/:id', getIncident);

module.exports = router;
