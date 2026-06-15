const crypto = require('crypto');

const DEFAULT_SECRET = 'change-me-in-production-onboarding-suite-secret';

function getKey() {
  return crypto
    .createHash('sha256')
    .update(String(process.env.ONBOARDING_FACE_ENCRYPTION_KEY || process.env.JWT_SECRET || DEFAULT_SECRET))
    .digest();
}

function encryptJson(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decryptJson(payload) {
  const raw = Buffer.from(String(payload || ''), 'base64');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

function hmac(value) {
  return crypto
    .createHmac('sha256', String(process.env.ONBOARDING_HMAC_SECRET || process.env.JWT_SECRET || DEFAULT_SECRET))
    .update(typeof value === 'string' ? value : JSON.stringify(value))
    .digest('hex');
}

function checksum(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

module.exports = { encryptJson, decryptJson, hmac, checksum };
