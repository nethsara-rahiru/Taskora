const app = require('../server');

console.log('[Verification Test] Checking Taskora Express server initialization...');

if (app) {
  console.log('[Verification Test] Express app initialized successfully.');
  process.exit(0);
} else {
  console.error('[Verification Test] Server initialization failed.');
  process.exit(1);
}
