const test = require('node:test');
const assert = require('node:assert/strict');
const groq = require('../services/groq-request');
const rules = require('../services/ai-validation');

test('current Groq models use strict JSON schema with model-specific reasoning parameters', () => {
  assert.deepEqual(groq.MODELS, ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3.8-27b']);
  for (const model of groq.MODELS) {
    const request = groq.requestBody(model, [{ role: 'user', content: 'Plan' }]);
    assert.equal(request.model, model);
    assert.equal(request.response_format.type, 'json_schema');
    assert.equal(request.response_format.json_schema.strict, true);
    const schema = request.response_format.json_schema.schema;
    assert.deepEqual(schema.required, Object.keys(schema.properties));
    assert.equal(schema.additionalProperties, false);
    const action = schema.properties.actions.items;
    assert.deepEqual(action.required, Object.keys(action.properties));
    assert.equal(action.additionalProperties, false);
    assert.equal(request.reasoning_effort, model.startsWith('openai/') ? 'low' : undefined);
    assert(rules.settings({ model }).model === model);
    const connection = groq.requestBody(model, [], true);
    assert(connection.max_completion_tokens >= 512);
    assert.equal(connection.response_format.json_schema.schema.properties.connected.type, 'boolean');
  }
});
test('legacy saved models fall back without breaking generation or settings', () => {
  assert.equal(groq.modelFor('llama-3.3-70b-versatile'), 'openai/gpt-oss-20b');
  assert.equal(rules.settings({}, { ...rules.DEFAULTS, model: 'llama-3.1-8b-instant' }).model, 'openai/gpt-oss-20b');
  assert.throws(() => rules.settings({ model: 'arbitrary' }));
});
test('provider errors expose useful diagnostics while redacting credentials', async () => {
  const key = 'gsk_private_example_123456';
  const error = await groq.providerError(new Response(JSON.stringify({ error: {
    code: 'model_not_found', message: `Model not available for ${key}; Bearer another-secret`
  } }), { status: 404 }), 'openai/gpt-oss-120b', key);
  assert.equal(error.status, 400);
  assert(error.message.includes('model_not_found'));
  assert(error.message.includes('openai/gpt-oss-120b'));
  assert(!error.message.includes(key)); assert(!error.message.includes('another-secret'));
  const limit = await groq.providerError(new Response(JSON.stringify({ error: { code: 'rate_limit_exceeded', message: 'Token limit: 6000 TPM' } }),
    { status: 429, headers: { 'retry-after': '60' } }), 'openai/gpt-oss-20b', key);
  assert.equal(limit.status, 429); assert(limit.message.includes('6000 TPM')); assert(limit.message.includes('60 seconds'));
  const unavailable = await groq.providerError(new Response('Bad gateway', { status: 503 }), 'qwen/qwen3.8-27b', key);
  assert.equal(unavailable.status, 502); assert(unavailable.message.includes('Groq 503'));
});
test('token exhaustion is distinguished from malformed JSON', () => {
  assert.throws(() => groq.parseCompletion({ choices: [{ finish_reason: 'length', message: { content: '{' } }] }), /output-token limit/);
  assert.deepEqual(groq.parseCompletion({ choices: [{ finish_reason: 'stop', message: { content: '{"connected":true}' } }] }), { connected: true });
});


test('busy context is compacted without losing occupied time or crossing dates', () => {
  const compact = groq.compactBusy([
    { date: '2026-11-05', start: 540, end: 600, title: 'Task A' },
    { date: '2026-11-05', start: 570, end: 630, title: 'Meeting' },
    { date: '2026-11-05', start: 660, end: 690, title: 'Task B' },
    { date: '2026-11-06', start: 540, end: 600, title: 'Next day' }
  ]);
  assert.equal(compact.length, 3);
  assert.equal(compact[0].start, 540); assert.equal(compact[0].end, 630);
  assert.equal(compact[1].start, 660); assert.equal(compact[2].date, '2026-11-06');
});

test('dashboard advice uses its own strict schema without requiring actions', () => {
  for (const model of groq.MODELS) {
    const request = groq.requestBody(model, [{ role: 'user', content: 'Help me work today' }], false, true);
    const format = request.response_format.json_schema;
    assert.equal(format.name, 'taskora_advice');
    assert.equal(format.strict, true);
    assert.deepEqual(format.schema.required, ['summary', 'recommendations']);
    assert.equal(format.schema.additionalProperties, false);
    assert.equal(format.schema.properties.actions, undefined);
    assert.equal(format.schema.properties.recommendations.items.type, 'string');
    assert(groq.requestBody(model, []).response_format.json_schema.schema.required.includes('actions'));
    assert.equal(groq.requestBody(model, [], true, true).response_format.json_schema.name, 'connection_check');
  }
});
