const express = require('express');
const router = express.Router();
const { checkoutSubscription, getMySubscription } = require('../controllers/subscriptionController');
const { protect, requireActiveOrganization } = require('../middleware/auth');

router.use(protect);

router.post('/checkout', checkoutSubscription);
router.get('/me', requireActiveOrganization, getMySubscription);

module.exports = router;

