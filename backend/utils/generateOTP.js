const crypto = require('crypto');

// Generate 6-digit OTP (cryptographically secure)
const generateOTP = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

// Generate random token
const generateToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

// Hash a secret before storing it, so a database leak does not expose usable codes or tokens
const hashToken = (value) => {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
};

module.exports = {
  generateOTP,
  generateToken,
  hashToken,
};
