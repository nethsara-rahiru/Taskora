const mongoose = require('mongoose');
const User = require('../models/User');
const MAX_MEMORIES = 30;
const CATEGORIES = ['preferences', 'lifestyle', 'tasks', 'personal'];
const fail = (message, status = 400) => { const error = new Error(message); error.status = status; throw error; };
function validate(input) {
  if (!input || typeof input.content !== 'string' || !input.content.trim() || input.content.trim().length > 400 || !CATEGORIES.includes(input.category)) fail('Choose a category and enter a memory of 1–400 characters.');
  return { content: input.content.trim(), category: input.category };
}
function fingerprint(content) { return content.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
function state(user) {
  return { memories: (user.aiMemory || []).map(entry => entry.toObject ? entry.toObject() : { ...entry }), autoLearn: user.aiMemoryAutoLearn !== false, revision: user.aiMemoryRevision || 0, limit: MAX_MEMORIES };
}
async function read(userId) {
  const user = await User.findById(userId).select('aiMemory aiMemoryAutoLearn aiMemoryRevision');
  if (!user) fail('Account not found.', 404);
  return state(user);
}
function revisionQuery(userId, revision) {
  return { _id: userId, ...(revision ? { aiMemoryRevision: revision } : { $or: [{ aiMemoryRevision: 0 }, { aiMemoryRevision: { $exists: false } }] }) };
}
async function write(userId, current, next) {
  const user = await User.findOneAndUpdate(revisionQuery(userId, current.revision), {
    $set: { aiMemory: next.memories, aiMemoryAutoLearn: next.autoLearn }, $inc: { aiMemoryRevision: 1 }
  }, { new: true, runValidators: true }).select('aiMemory aiMemoryAutoLearn aiMemoryRevision');
  return user ? state(user) : null;
}
async function mutate(userId, update) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await read(userId);
    const next = update(current);
    const saved = await write(userId, current, next);
    if (saved) return saved;
  }
  fail('Memories changed in another tab. Reload and try again.', 409);
}
function validId(id) { if (!mongoose.Types.ObjectId.isValid(id)) fail('Memory not found.', 404); }
async function add(userId, input) {
  const value = validate(input);
  return mutate(userId, current => {
    if (current.memories.length >= MAX_MEMORIES) fail(`You can save up to ${MAX_MEMORIES} memories. Remove one before adding another.`);
    if (current.memories.some(entry => fingerprint(entry.content) === fingerprint(value.content))) fail('That memory is already saved.');
    const now = new Date();
    return { ...current, memories: [...current.memories, { ...value, _id: new mongoose.Types.ObjectId(), source: 'user', createdAt: now, updatedAt: now }] };
  });
}
async function edit(userId, id, input) {
  validId(id); const value = validate(input);
  return mutate(userId, current => {
    if (!current.memories.some(entry => String(entry._id) === id)) fail('Memory not found.', 404);
    if (current.memories.some(entry => String(entry._id) !== id && fingerprint(entry.content) === fingerprint(value.content))) fail('That memory is already saved.');
    return { ...current, memories: current.memories.map(entry => String(entry._id) === id ? { ...entry, ...value, source: 'user', updatedAt: new Date() } : entry) };
  });
}
async function remove(userId, id) {
  validId(id);
  return mutate(userId, current => {
    if (!current.memories.some(entry => String(entry._id) === id)) fail('Memory not found.', 404);
    return { ...current, memories: current.memories.filter(entry => String(entry._id) !== id) };
  });
}
async function configure(userId, input) {
  if (typeof input.autoLearn !== 'boolean') fail('Choose whether AI may add memories.');
  return mutate(userId, current => ({ ...current, autoLearn: input.autoLearn }));
}
function context(user) { return (user.aiMemory || []).map(entry => ({ content: entry.content, category: entry.category, source: entry.source })); }
async function learn(userId, candidates, expectedRevision) {
  const current = await read(userId);
  // Never resurrect deleted memories or overwrite edits made during generation.
  if (!current.autoLearn || current.revision !== expectedRevision) return { saved: 0, status: 'changed' };
  const existing = new Set(current.memories.map(entry => fingerprint(entry.content)));
  const additions = [];
  for (const candidate of Array.isArray(candidates) ? candidates.slice(0, 3) : []) {
    let value; try { value = validate(candidate); } catch (_) { continue; }
    const key = fingerprint(value.content);
    if (existing.has(key) || current.memories.length + additions.length >= MAX_MEMORIES) continue;
    existing.add(key); const now = new Date();
    additions.push({ ...value, _id: new mongoose.Types.ObjectId(), source: 'ai', createdAt: now, updatedAt: now });
  }
  if (!additions.length) return { saved: 0, status: 'unchanged' };
  const saved = await write(userId, current, { ...current, memories: [...current.memories, ...additions] });
  return { saved: saved ? additions.length : 0, status: saved ? 'saved' : 'changed' };
}
module.exports = { MAX_MEMORIES, CATEGORIES, validate, fingerprint, read, add, edit, remove, configure, context, learn };
