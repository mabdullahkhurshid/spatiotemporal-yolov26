// Reversible encryption for secrets the server must replay to third parties (camera passwords).
// AES-256-GCM; the stored form is "v1:<iv>:<tag>:<ciphertext>" (base64 parts).
const crypto = require('crypto');

let warnedFallback = false;

// Key derived from JWT_SECRET: the default when CAMERA_CREDENTIALS_KEY is not set, and the fallback for
// decrypting passwords stored before CAMERA_CREDENTIALS_KEY was configured.
const jwtDerivedKey = () =>
  Buffer.from(crypto.hkdfSync('sha256', process.env.JWT_SECRET, 'fire-detection', 'camera-credentials', 32));

function key() {
  const configured = process.env.CAMERA_CREDENTIALS_KEY;
  if (configured) {
    return crypto.createHash('sha256').update(configured).digest();
  }
  if (!process.env.JWT_SECRET) {
    throw new Error('CAMERA_CREDENTIALS_KEY (or JWT_SECRET) must be set to store camera credentials');
  }
  if (!warnedFallback && process.env.NODE_ENV !== 'test') {
    warnedFallback = true;
    console.warn('CAMERA_CREDENTIALS_KEY is not set; camera passwords are encrypted with a key derived from JWT_SECRET. Rotating JWT_SECRET will then require re-entering camera passwords.');
  }
  return jwtDerivedKey();
}

/** Keys to try when decrypting: the active key first, then the legacy JWT-derived key. */
function decryptionKeys() {
  const keys = [key()];
  if (process.env.CAMERA_CREDENTIALS_KEY && process.env.JWT_SECRET) keys.push(jwtDerivedKey());
  return keys;
}

function encryptSecret(plain) {
  if (plain === undefined || plain === null || plain === '') return undefined;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), ciphertext.toString('base64')].join(':');
}

/** Returns the plain secret, or null when missing or undecryptable (e.g. the key changed). */
function decryptSecret(stored) {
  if (!stored) return null;
  const [version, iv, tag, ciphertext] = String(stored).split(':');
  if (version !== 'v1' || !iv || !tag || ciphertext === undefined) return null;
  let keys;
  try {
    keys = decryptionKeys();
  } catch (_) {
    return null;
  }
  for (const candidate of keys) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', candidate, Buffer.from(iv, 'base64'));
      decipher.setAuthTag(Buffer.from(tag, 'base64'));
      return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8');
    } catch (_) {
      // wrong key (or tampered data): try the next one
    }
  }
  return null;
}

module.exports = { encryptSecret, decryptSecret };
