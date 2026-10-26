const MODELS = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3.8-27b'];
function modelFor(value) { return MODELS.includes(value) ? value : MODELS[0]; }
function object(properties) { return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false }; }
const nullableString = { type: ['string', 'null'] };
const schedule = object({ title: { type: 'string' }, description: { type: 'string' }, priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
  startsOn: nullableString, endsOn: nullableString, isPaused: { type: 'boolean' },
  skipRanges: { type: 'array', items: object({ start: { type: 'string' }, end: { type: 'string' } }) } });
const slot = object({ subject: { type: 'string' }, dayOfWeek: { type: 'integer' }, startTime: { type: 'string' }, endTime: { type: 'string' }, room: { type: 'string' }, teacher: { type: 'string' } });
const action = object({ targetType: { type: 'string', enum: ['task', 'event', 'timetable', 'slot'] }, timetableId: nullableString, slotId: nullableString,
  schedule: { anyOf: [schedule, { type: 'null' }] }, slot: { anyOf: [slot, { type: 'null' }] }, operation: { type: 'string', enum: ['create', 'update'] }, taskId: nullableString,
  title: { type: 'string' }, description: { type: 'string' }, itemType: { type: 'string', enum: ['task', 'event'] },
  priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] }, dueDate: nullableString,
  dueTime: nullableString, endTime: nullableString, reason: { type: 'string' } });
const planSchema = object({ summary: { type: 'string' }, recommendations: { type: 'array', items: { type: 'string' } }, actions: { type: 'array', items: action } });
const adviceSchema = object({ summary: { type: 'string' }, recommendations: { type: 'array', items: { type: 'string' } } });
const memorySchema = object({ memories: { type: 'array', items: object({ content: { type: 'string' }, category: { type: 'string', enum: ['preferences', 'lifestyle', 'tasks', 'personal'] } }) } });
function requestBody(model, messages, test = false, adviceOnly = false, memoryCapture = false) {
  model = modelFor(model);
  return { model, messages, temperature: 0.2, max_completion_tokens: test ? 512 : memoryCapture ? 768 : 3072,
    ...(model.startsWith('openai/gpt-oss-') ? { reasoning_effort: 'low' } : {}),
    response_format: { type: 'json_schema', json_schema: { name: test ? 'connection_check' : memoryCapture ? 'taskora_memory' : adviceOnly ? 'taskora_advice' : 'taskora_plan', strict: true,
      schema: test ? object({ connected: { type: 'boolean' } }) : memoryCapture ? memorySchema : adviceOnly ? adviceSchema : planSchema } } };
}
// Merge overlapping busy windows before sending context to Groq. Server-side
// conflict checks still use the full records; no occupied time is omitted.
function compactBusy(blocks) {
  const sorted = blocks.filter(block => Number.isFinite(block.start) && Number.isFinite(block.end) && block.end > block.start)
    .map(block => ({ date: block.date, start: block.start, end: block.end, title: String(block.title || 'Busy time').slice(0, 60) }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  const merged = [];
  for (const block of sorted) {
    const last = merged.at(-1);
    if (last && last.date === block.date && block.start <= last.end) {
      last.end = Math.max(last.end, block.end); last.title = 'Existing commitments';
    } else merged.push(block);
  }
  return merged;
}
function redact(value, apiKey) {
  let text = String(value || '');
  if (apiKey) text = text.split(apiKey).join('[redacted]');
  return text.replace(/gsk_[A-Za-z0-9_-]+/g, '[redacted]').replace(/Bearer\s+[^\s"',;]+/gi, 'Bearer [redacted]').replace(/[\r\n]+/g, ' ').slice(0, 600);
}
async function providerError(response, model, apiKey) {
  let detail = ''; let code = '';
  try {
    const body = await response.json();
    detail = redact(body.error?.message, apiKey);
    code = redact(body.error?.code || body.error?.type, apiKey);
  } catch (_) { /* A non-JSON provider error still has a useful HTTP status. */ }
  const retry = redact(response.headers?.get('retry-after'), apiKey);
  const status = response.status === 429 ? 429 : [400, 401, 403, 404, 413, 422].includes(response.status) ? 400 : 502;
  const advice = [401, 403].includes(response.status) ? 'Check the saved key and model access.'
    : response.status === 429 ? `Groq rate limit reached.${retry ? ` Retry after ${retry} seconds.` : ' Wait before retrying.'}`
    : response.status === 413 ? 'Use a smaller planning request or a model with a higher token limit.'
    : response.status === 404 ? 'Check that this model is available to your Groq account.' : '';
  const error = new Error(`Groq ${response.status} (${model}${code ? `, ${code}` : ''}): ${detail || advice || 'The provider rejected this request.'}${detail && advice ? ` ${advice}` : ''}`);
  error.status = status; return error;
}
function parseCompletion(json) {
  const choice = json?.choices?.[0];
  if (choice?.finish_reason === 'length') {
    const error = new Error('Groq reached its output-token limit. Ask for fewer suggestions and try again.'); error.status = 502; throw error;
  }
  return JSON.parse(choice.message.content);
}
module.exports = { MODELS, modelFor, requestBody, providerError, parseCompletion, compactBusy };
