const express = require('express');
const router = express.Router();
const { getOrders, getOrder, getOrderStats, updateOrder, deleteOrder } = require('../controllers/orderController');
const { protect, authorize, requireActiveOrganization } = require('../middleware/auth');
const { validateUpdateOrder, validate } = require('../middleware/validation');

router.use(protect);
router.use(requireActiveOrganization);

router.get('/stats', authorize('super_admin'), getOrderStats);
router.get('/', authorize('super_admin'), getOrders);
router.get('/:id', authorize('super_admin'), getOrder);
router.put('/:id', authorize('super_admin'), validateUpdateOrder, validate, updateOrder);
router.delete('/:id', authorize('super_admin'), deleteOrder);

module.exports = router;