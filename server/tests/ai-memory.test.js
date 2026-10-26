const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
function setup() {
  const users = new Map([['a', { aiMemory: [], aiMemoryRevision: 0, aiMemoryAutoLearn: true }], ['b', { aiMemory: [], aiMemoryRevision: 0, aiMemoryAutoLearn: true }]]);
  const User = {
    findById: id => ({ select: async () => users.get(id) }),
    findOneAndUpdate: (query, update) => ({ select: async () => {
      const user = users.get(query._id); if (!user) return null;
      if (query.aiMemoryRevision !== undefined && query.aiMemoryRevision !== user.aiMemoryRevision) return null;
      if (query.$or && user.aiMemoryRevision) return null;
      Object.assign(user, update.$set); user.aiMemoryRevision = (user.aiMemoryRevision || 0) + 1; return user;
    } })
  };
  const context = { module: { exports: {} }, require: name => name === 'mongoose' ? mongoose : User };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../services/ai-memory.js'), 'utf8'), context);
  return { memory: context.module.exports, users };
}
test('memories are validated, owned by one account, editable and removable', async () => {
  const { memory } = setup();
  const added = await memory.add('a', { content: ' I prefer short study blocks. ', category: 'preferences', source: 'ai', userId: 'b' });
  assert.equal(added.memories[0].source, 'user'); assert.equal(added.memories[0].content, 'I prefer short study blocks.');
  assert.equal((await memory.read('b')).memories.length, 0);
  const id = String(added.memories[0]._id);
  await assert.rejects(memory.edit('b', id, { content: 'No', category: 'personal' }), { status: 404 });
  await assert.rejects(memory.remove('b', id), { status: 404 });
  const edited = await memory.edit('a', id, { content: 'I prefer 25-minute study blocks.', category: 'lifestyle' });
  assert.equal(edited.memories[0].category, 'lifestyle'); assert.equal(edited.revision, 2);
  assert.equal((await memory.remove('a', id)).memories.length, 0);
  await assert.rejects(memory.add('a', { content: 'x'.repeat(401), category: 'personal' }), { status: 400 });
  await assert.rejects(memory.add('a', { content: 'x', category: 'unknown' }), { status: 400 });
});
test('concurrent additions preserve both notes and normalize duplicate content', async () => {
  const { memory } = setup();
  await Promise.all([memory.add('a', { content: 'Morning study', category: 'preferences' }), memory.add('a', { content: 'Evening walks', category: 'lifestyle' })]);
  assert.equal((await memory.read('a')).memories.length, 2);
  await assert.rejects(memory.add('a', { content: 'morning  STUDY!', category: 'tasks' }), /already saved/);
});
test('AI only appends bounded distinct notes and never restores a deleted memory or bypasses disabled learning', async () => {
  const { memory } = setup();
  const first = await memory.add('a', { content: 'Morning study', category: 'preferences' });
  const learned = await memory.learn('a', [{ content: 'Morning study!', category: 'preferences' }, { content: 'I take a walk after lunch.', category: 'lifestyle' }], first.revision);
  assert.equal(learned.saved, 1);
  const state = await memory.read('a'); assert.equal(state.memories[1].source, 'ai');
  await memory.remove('a', String(state.memories[1]._id));
  assert.equal((await memory.learn('a', [{ content: 'I take a walk after lunch.', category: 'lifestyle' }], state.revision)).saved, 0);
  const disabled = await memory.configure('a', { autoLearn: false });
  assert.equal((await memory.learn('a', [{ content: 'New fact', category: 'personal' }], disabled.revision)).saved, 0);
  assert.equal((await memory.read('a')).memories.length, 1);
});
test('memory capacity is enforced for both manual and automatic additions', async () => {
  const { memory, users } = setup();
  users.get('a').aiMemory = Array.from({ length: 30 }, (_, index) => ({ content: `Fact ${index}`, category: 'personal', source: 'user', _id: new mongoose.Types.ObjectId() }));
  await assert.rejects(memory.add('a', { content: 'Another fact', category: 'personal' }), /up to 30/);
  assert.equal((await memory.learn('a', [{ content: 'Another fact', category: 'personal' }], 0)).saved, 0);
});
