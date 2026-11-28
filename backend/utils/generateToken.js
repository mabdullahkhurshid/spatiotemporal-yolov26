const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Generate JWT access token (kept in memory by the SPA, sent as a Bearer header)
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '15m',
  });
};

// Generate refresh token; jti makes every token unique even when minted in the same second
const generateRefreshToken = (id) => {
  return jwt.sign({ id, jti: crypto.randomUUID() }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d',
  });
};

// Short-lived token that only authorizes the MJPEG proxy for one camera (used in <img src>).
// A separate secret ensures it can never be accepted as an access token.
// Without a JWT_SECRET these would collapse to the public string "undefined:...", so refuse instead.
const requireJwtSecret = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured');
  return process.env.JWT_SECRET;
};

const streamSecret = () => `${requireJwtSecret()}:camera-stream`;

const generateStreamToken = (userId, cameraId) => {
  return jwt.sign({ sub: String(userId), cam: String(cameraId) }, streamSecret(), {
    expiresIn: parseInt(process.env.CAMERA_STREAM_TOKEN_TTL_SEC, 10) || 60,
  });
};

const verifyStreamToken = (token) => jwt.verify(token, streamSecret());

// Lets the browser publish its camera to MediaMTX for one webcam camera (checked in the MediaMTX
// auth hook). MediaMTX checks it only when a session starts, so it can be short-lived.
const publishSecret = () => `${requireJwtSecret()}:camera-publish`;

const generatePublishToken = (userId, cameraId) =>
  jwt.sign({ sub: String(userId), cam: String(cameraId) }, publishSecret(), { expiresIn: 300 });

const verifyPublishToken = (token) => jwt.verify(token, publishSecret());

module.exports = {
  generateToken,
  generateRefreshToken,
  generateStreamToken,
  verifyStreamToken,
  generatePublishToken,
  verifyPublishToken,
};
