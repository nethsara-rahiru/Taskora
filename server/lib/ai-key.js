const crypto = require('crypto');
const config = require('../config/config');

function encryptionKey() {
  const secret = process.env.AI_ENCRYPTION_KEY ||
    (config.jwtSecret?.length >= 32 && !/default|your_jwt_secret_here/i.test(config.jwtSecret) ? config.jwtSecret : '');
  if (!secret || secret.length < 32) throw new Error('Set AI_ENCRYPTION_KEY to a stable random secret of at least 32 characters on the server.');
  return crypto.createHash('sha256').update(`taskora-groq:${secret}`).digest();
}
function storageReady() { try { encryptionKey(); return true; } catch (_) { return false; } }
function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(buffer => buffer.toString('base64')).join('.');
}
function decrypt(value) {
  try {
    const [iv, tag, encrypted] = value.split('.').map(part => Buffer.from(part, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch (_) { throw new Error('The saved Groq key cannot be unlocked. Check the server encryption secret or save the key again in Settings.'); }
}
module.exports = { encrypt, decrypt, storageReady };
