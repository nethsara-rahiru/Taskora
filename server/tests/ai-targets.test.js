const test = require('node:test');
const assert = require('node:assert/strict');
const targets = require('../services/ai-targets');
const rules = require('../services/ai-validation');

test('explicit targets constrain updates to the selected record or its own slots', () => {
  assert(targets.matchesSelection({ operation:'update', targetType:'event', taskId:'e1' }, { type:'event', id:'e1' }));
  assert(!targets.matchesSelection({ operation:'update', targetType:'event', taskId:'e2' }, { type:'event', id:'e1' }));
  assert(targets.matchesSelection({ operation:'update', targetType:'slot', timetableId:'tt', slotId:'s1' }, { type:'timetable', id:'tt' }));
  assert(!targets.matchesSelection({ operation:'update', targetType:'slot', timetableId:'other', slotId:'s1' }, { type:'timetable', id:'tt' }));
  assert(!targets.matchesSelection({ operation:'update', targetType:'slot', timetableId:'tt', slotId:'s2' }, { type:'slot', id:'tt', slotId:'s1' }));
});
test('schedule settings keep slots and owner fields outside the update payload', () => {
  const value = targets.scheduleValues({ title:'Updated', priority:'urgent', endsOn:'2026-12-31', skipRanges:[{start:'2026-11-09',end:'2026-11-15'}], userId:'other', slots:[] },
    { title:'Work', description:'Weekly', isPaused:false, slots:[{subject:'Math'}] });
  assert.equal(value.title,'Updated'); assert.equal(value.priority,'urgent'); assert.equal(value.endsOn,'2026-12-31');
  assert.equal(value.userId,undefined); assert.equal(value.slots,undefined);
  assert.throws(()=>targets.scheduleValues({startsOn:'2026-12-31',endsOn:'2026-11-01'}, {title:'Work'}));
});
test('slot updates validate weekday and times and do not change ids or other slots', () => {
  const original={subject:'Math',dayOfWeek:1,startTime:'09:00',endTime:'10:00',room:'A',teacher:''};
  const value=targets.slotValues({dayOfWeek:2,startTime:'11:00',endTime:'12:00',userId:'other',_id:'other'},original);
  assert.equal(value.subject,'Math'); assert.equal(value.dayOfWeek,2); assert.equal(value._id,undefined);
  assert.throws(()=>targets.slotValues({dayOfWeek:7},original));
  assert.throws(()=>targets.slotValues({endTime:'08:00'},original));
});
test('weekly slot conflict checks exclude skipped days and respect template dates', () => {
  const value={subject:'Math',dayOfWeek:1,startTime:'09:00',endTime:'10:00'};
  const blocks=[{date:'2026-11-02',start:540,end:600,title:'Busy'}];
  assert.deepEqual(targets.slotConflicts(value,{},blocks,'2026-11-02','2026-11-08'),['Busy']);
  assert.deepEqual(targets.slotConflicts(value,{isPaused:true},blocks,'2026-11-02','2026-11-08'),[]);
  assert.deepEqual(targets.slotConflicts(value,{skipRanges:[{start:'2026-11-02',end:'2026-11-02'}]},blocks,'2026-11-02','2026-11-08'),[]);
  const intervals=rules.busyIntervals([], [{_id:'tt', title:'Work', slots:[{_id:'s1',...value}]}], '2026-11-02','2026-11-08');
  assert.equal(intervals[0].timetableId,'tt'); assert.equal(intervals[0].slotId,'s1');
});
