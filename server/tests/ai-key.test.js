const test = require('node:test');
const assert = require('node:assert/strict');
const keys = require('../lib/ai-key');

test('Groq keys encrypt with fresh IVs, decrypt, and reject tampering', () => {
  const previous = process.env.AI_ENCRYPTION_KEY;
  process.env.AI_ENCRYPTION_KEY = 'test-encryption-secret-32-characters-minimum';
  try {
    const secret = 'gsk_test_secret_not_real';
    const a = keys.encrypt(secret), b = keys.encrypt(secret);
    assert.notEqual(a, b);
    assert(!a.includes(secret));
    assert.equal(keys.decrypt(a), secret);
    const parts = a.split('.'); parts[1] = Buffer.alloc(16).toString('base64');
    assert.throws(() => keys.decrypt(parts.join('.')));
    process.env.AI_ENCRYPTION_KEY = 'different-encryption-secret-32-characters';
    assert.throws(() => keys.decrypt(a));
  } finally {
    if (previous === undefined) delete process.env.AI_ENCRYPTION_KEY;
    else process.env.AI_ENCRYPTION_KEY = previous;
  }
});
