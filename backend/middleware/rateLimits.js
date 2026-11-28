const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { hasValidInferenceKey } = require('../utils/safeCompare');

const intEnv = (name, fallback) => parseInt(process.env[name], 10) || fallback;

const limitResponse = (message) => ({ success: false, message });

// Signed-in users get their own budget (an office behind one NAT IP is many users); others are keyed by IP.
const userOrIpKey = (req) => {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      const { id } = jwt.verify(header.slice(7), process.env.JWT_SECRET);
      if (id) return `user:${id}`;
    } catch (_) {
      // invalid/expired token: fall back to IP
    }
  }
  return `ip:${req.ip}`;
};

// General API limiter. The inference worker posts every frame with its own API key, so it is exempt,
// but only with a valid key: wrong-key attempts count against the caller's IP like any other request.
exports.apiLimiter = rateLimit({
  windowMs: intEnv('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  max: intEnv('RATE_LIMIT_MAX_REQUESTS', 1000),
  keyGenerator: userOrIpKey,
  skip: (req) => req.originalUrl.startsWith('/api/internal/inference/') && hasValidInferenceKey(req),
  standardHeaders: true,
  legacyHeaders: false,
  message: limitResponse('Too many requests, please try again later.'),
});

// Brute-force protection for credential checks: only failed attempts count.
exports.credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: intEnv('AUTH_RATE_LIMIT_MAX', 10),
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: limitResponse('Too many failed attempts. Please wait 15 minutes and try again.'),
});

// Endpoints that send email (registration, verification codes, password reset).
exports.emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: intEnv('EMAIL_RATE_LIMIT_MAX', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: limitResponse('Too many requests. Please try again in an hour.'),
});

// Public contact form spam protection.
exports.contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: intEnv('CONTACT_RATE_LIMIT_MAX', 5),
  standardHeaders: true,
  legacyHeaders: false,
  message: limitResponse('Too many messages. Please try again later.'),
});

// ONVIF discovery / probe make the server contact devices on the network; cap them per user.
exports.onvifLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: intEnv('ONVIF_RATE_LIMIT_MAX', 30),
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: limitResponse('Too many camera connection attempts. Please wait a few minutes and try again.'),
});
