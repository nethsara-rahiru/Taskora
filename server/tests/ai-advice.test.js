const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const rules = require('../services/ai-validation');

function setup(output) {
  let requests = 0;
  const chain = { sort() { return this; }, limit() { return this; }, lean: async () => [] };
  const dependencies = {
    mongoose: require('mongoose'),
    '../models/User': { findById: () => ({ select: async () => ({ groqKeyEncrypted: 'encrypted', aiSettings: { toObject: () => ({ ...rules.DEFAULTS, enabled: true }) } }) }) },
    '../models/Task': { find: () => chain },
    '../models/Timetable': { find: () => chain },
    '../models/AiPlan': { create: () => { throw new Error('Advice must not write an actionable plan'); } },
    './task.service': {}, './timetable.service': {},
    '../lib/ai-key': { decrypt: () => 'test-key' }, './ai-validation': rules,
    './groq-request': require('../services/groq-request'), './ai-targets': require('../services/ai-targets'),
    '../../public/js/schedule-rules': require('../../public/js/schedule-rules')
  };
  const context = { module: { exports: {} }, AbortSignal, require: name => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  }, fetch: async (url, options) => {
    requests++;
    const request = JSON.parse(options.body);
    // Reproduce Groq's rejection when advice lacking actions is sent to the plan schema.
    const required = request.response_format.json_schema.schema.required;
    if (required.some(key => !(key in output))) {
      return new Response(JSON.stringify({ error: { code: 'json_validate_failed', message: "missing properties: 'actions'" } }), { status: 400 });
    }
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(output) } }] }));
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../services/ai.service.js'), 'utf8'), context);
  return { api: context.module.exports, requests: () => requests };
}
const input = { mode: 'recommend', adviceOnly: true, date: '2026-10-26', prompt: 'Help me work today.' };

test('daily advice accepts summary and recommendations without an actions property', async () => {
  const { api, requests } = setup({ summary: 'Focus on the report.', recommendations: ['Work for 30 minutes.', 'Take a short break.'] });
  const result = await api.generate('user', input);
  assert.equal(result.summary, 'Focus on the report.');
  assert.equal(result.recommendations.length, 2);
  assert.equal(result.actions.length, 0);
  assert.equal(result.timezone, rules.DEFAULTS.timezone);
  assert.equal(requests(), 1);
});
test('advice cannot turn an unexpected provider action into a stored proposal', async () => {
  const { api } = setup({ summary: 'Advice', recommendations: [], actions: [{ operation: 'create' }] });
  assert.equal((await api.generate('user', input)).actions.length, 0);
});
test('malformed advice still fails and other AI requests keep requiring actions', async () => {
  const invalid = setup({ summary: 'Advice', recommendations: 'not an array' });
  await assert.rejects(invalid.api.generate('user', input), /invalid plan/);
  const regular = setup({ summary: 'Advice', recommendations: [] });
  await assert.rejects(regular.api.generate('user', { ...input, adviceOnly: false }), /json_validate_failed/);
  const wrongMode = setup({ summary: 'Advice', recommendations: [] });
  await assert.rejects(wrongMode.api.generate('user', { ...input, mode: 'schedule' }), /recommendations mode/);
  assert.equal(wrongMode.requests(), 0);
});
