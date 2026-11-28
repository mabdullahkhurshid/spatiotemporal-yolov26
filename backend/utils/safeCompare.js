const crypto = require('crypto');

/** Constant-time string comparison for shared secrets (API keys, passwords). */
const sameSecret = (a, b) => {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

/** True when the request carries the configured inference service key. */
const hasValidInferenceKey = (req) => {
  const configured = process.env.INFERENCE_SERVICE_API_KEY;
  return Boolean(configured) && sameSecret(req.headers['x-inference-api-key'], configured);
};

module.exports = { sameSecret, hasValidInferenceKey };
