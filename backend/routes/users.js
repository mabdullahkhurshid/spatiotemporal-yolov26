const express = require('express');
const router = express.Router();
const {
  getAccountSummary,
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  verifyUser,
  suspendUser,
  reactivateUser,
  resetUserPassword,
} = require('../controllers/userController');
const { protect, authorize, requireActiveOrganization, requireVerifiedUser } = require('../middleware/auth');
const { body } = require('express-validator');
const { validate, validateCreateUser } = require('../middleware/validation');

router.use(protect);

router.get('/me/account-summary', authorize('customer', 'org_admin'), getAccountSummary);

router.use(requireActiveOrganization);

router.route('/').get(authorize('super_admin', 'org_admin'), requireVerifiedUser, getUsers).post(authorize('super_admin', 'org_admin'), requireVerifiedUser, validateCreateUser, validate, createUser);

router.put('/:id/verify', authorize('super_admin'), verifyUser);
router.put('/:id/suspend', authorize('super_admin', 'org_admin'), suspendUser);
router.put('/:id/reactivate', authorize('super_admin', 'org_admin'), reactivateUser);
router.put('/:id/reset-password', authorize('super_admin'), [body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')], validate, resetUserPassword);

router.route('/:id').get(getUser).put(updateUser).delete(authorize('super_admin', 'org_admin'), requireVerifiedUser, deleteUser);

module.exports = router;
