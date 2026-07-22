const express = require('express');
const router = express.Router();
const passport = require('../services/oauthService');
const {
  register,
  verifyEmail,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  refreshToken,
  googleCallback,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validate,
} = require('../middleware/validation');

// Public routes
router.post('/register', validateRegister, validate, register);
router.post('/verify-email', verifyEmail);
router.post('/login', validateLogin, validate, login);
router.post('/forgotpassword', validateForgotPassword, validate, forgotPassword);
router.put('/resetpassword', validateResetPassword, validate, resetPassword);
router.post('/refresh', refreshToken);

// Google OAuth routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', { session: false }), googleCallback);

// Protected routes
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);

module.exports = router;
