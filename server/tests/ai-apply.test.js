const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const rules = require('../services/ai-validation');

test('retrying after a saved task but failed plan-result write does not duplicate the task', async () => {
  const userId = new mongoose.Types.ObjectId();
  const plan = { _id: new mongoose.Types.ObjectId(), userId, timezone: rules.DEFAULTS.timezone, actions: [{ operation: 'create', state: 'pending', values: {
    title: 'Project meeting', itemType: 'event', priority: 'medium', dueDate: '2026-11-05', dueTime: '09:00', endTime: '09:30'
  } }] };
  const tasks = new Map(); let creations = 0; let failOnce = true;
  function patch(update) {
    for (const [key, value] of Object.entries(update.$set || {})) {
      plan.actions[0][key.split('.').at(-1)] = value;
    }
  }
  const Plan = {
    findOne: async query => String(query.userId) === String(userId) ? plan : null,
    findOneAndUpdate: async (query, update) => {
      if (plan.actions[0].state !== 'pending') return null;
      patch(update); return plan;
    },
    updateOne: async (query, update) => {
      if (failOnce && Object.values(update.$set || {}).includes('applied')) {
        failOnce = false; throw new Error('Simulated plan-result write failure');
      }
      patch(update);
    }
  };
  const dependencies = {
    mongoose,
    '../models/User': { findById: () => ({ select: async () => ({ aiSettings: { toObject: () => rules.DEFAULTS } }) }) },
    '../models/Task': { exists: async query => tasks.has(String(query._id)), find: () => ({ limit: () => ({ lean: async () => [] }) }) },
    '../models/Timetable': { find: () => ({ lean: async () => [] }) },
    '../models/AiPlan': Plan,
    './task.service': { createTask: async (owner, values) => {
      creations++;
      assert.equal(String(owner), String(userId));
      const task = { ...values };
      tasks.set(String(task._id), task); return task;
    } },
    '../lib/ai-key': {}, './ai-validation': rules, './groq-request': require('../services/groq-request')
  };
  const context = { module: { exports: {} }, require: name => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../services/ai.service.js'), 'utf8'), context);
  const api = context.module.exports;
  await assert.rejects(api.apply(userId, plan._id, 0, {}), /Simulated plan-result/);
  assert.equal(tasks.size, 1);
  assert.equal(plan.actions[0].state, 'pending');
  const result = await api.apply(userId, plan._id, 0, {});
  assert.equal(result.alreadyApplied, true);
  assert.equal(creations, 1);
  assert.equal(plan.actions[0].state, 'applied');
  await assert.rejects(api.apply(new mongoose.Types.ObjectId(), plan._id, 0, {}), /unavailable/);
  plan.timezone = 'UTC'; plan.actions[0].state = 'pending'; plan.actions[0].resultTaskId = null;
  await assert.rejects(api.apply(userId, plan._id, 0, {}), /timezone changed/);
  assert.equal(creations, 1);
});
