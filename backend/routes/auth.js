const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { startGoogleSignIn, handleGoogleCallback } = require('../services/oauthService');
const {
  register,
  verifyEmail,
  resendVerification,
  login,
  logout,
  logoutAll,
  getMe,
  forgotPassword,
  resetPassword,
  refreshToken,
  googleCallback,
  exchangeOAuthCode,
  setPassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { credentialLimiter, emailLimiter } = require('../middleware/rateLimits');
const {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateSetPassword,
  validate,
} = require('../middleware/validation');

// Same normalization as registration, so mixed-case / dotted Gmail addresses match the stored email.
const validateEmailOnly = [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
];

// Public routes
router.post('/register', emailLimiter, validateRegister, validate, register);
router.post('/verify-email', credentialLimiter, validateEmailOnly, validate, verifyEmail);
router.post('/resend-verification', emailLimiter, validateEmailOnly, validate, resendVerification);
router.post('/login', credentialLimiter, validateLogin, validate, login);
router.post('/forgotpassword', emailLimiter, validateForgotPassword, validate, forgotPassword);
router.put('/resetpassword', credentialLimiter, validateResetPassword, validate, resetPassword);
router.post('/refresh', refreshToken);
router.post('/logout', logout);

// Google OAuth routes
router.get('/google', startGoogleSignIn);
router.get('/google/callback', handleGoogleCallback, googleCallback);
router.post('/oauth/exchange', credentialLimiter, exchangeOAuthCode);

// Protected routes
router.get('/me', protect, getMe);
router.post('/set-password', protect, validateSetPassword, validate, setPassword);
router.post('/logout-all', protect, logoutAll);

module.exports = router;
