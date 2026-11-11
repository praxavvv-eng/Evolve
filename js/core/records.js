/* All writes to user records go through here: create, edit, delete (to a 30-day trash), restore,
 * plus domain mutations (toggle task, habit check-in, attendance, progress). XP is awarded here, once, via xp.award(). */
import * as State from './state.js';
import { schemas } from './schemas.js';
import { prepare } from './validation.js';
import { award, checkProgress } from './xp.js';
import { uid, todayStr, clamp, num, isDateStr, dateStr } from './utils.js';

export const find = (type, id) => State.get()[schemas[type].list].find(x => x.id === id);

/* ---------------- create / edit ---------------- */
export function saveRecord(type, raw, id = '') {
  const schema = schemas[type];
  const state = State.get();
  const existing = id ? state[schema.list].find(x => x.id === id) : null;
  const { record, errors } = prepare(type, raw, { state, existing });
  if (Object.keys(errors).length) return { ok: false, errors };

  let saved, rewards = [];
  const ok = State.update(s => {
    const list = s[schema.list];
    const now = new Date().toISOString();
    const prev = existing ? list.find(x => x.id === id) : null;
    const wasStatus = prev?.status;
    saved = prev ? Object.assign(prev, record, { updatedAt: now }) : { id: uid(type), ...record, createdAt: now };
    if (!prev) list.push(saved);

    /* per-type side effects */
    if (type === 'subject' && prev && existing.name !== record.name) s.academicItems.forEach(x => { if (x.subject === existing.name) x.subject = record.name; });
    if (type === 'game') trackGameHistory(saved, wasStatus, !prev);
    if (type === 'book') trackBookDates(saved, wasStatus, !prev);
    if (type === 'academic' && saved.status === 'Completed' && !saved.completedAt) saved.completedAt = now;
    if (type === 'academic' && saved.status !== 'Completed') delete saved.completedAt;

    /* XP: once per event key */
    const gained = (key, pts, cat, label) => { const r = award(s, key, pts, cat, label); if (r.awarded) rewards.push(r.points); };
    if (!prev && type === 'workout') gained(`workout:${saved.id}`, 20, 'fitness', 'Workout logged');
    if (!prev && type === 'transaction') gained(`finance:log:${todayStr()}`, 5, 'finance', 'Recorded a transaction');
    if (saved.status === 'Completed' && wasStatus !== 'Completed') {
      if (type === 'academic') gained(`academic:${saved.id}`, 20, 'academics', 'Academic work completed');
      if (type === 'goal') gained(`goal:${saved.id}`, 30, 'personal', 'Goal completed');
      if (type === 'game') gained(`game:${saved.id}`, 30, 'gaming', 'Game completed');
    }
    if (type === 'book' && saved.status === 'Finished' && wasStatus !== 'Finished') gained(`book:${saved.id}`, 25, 'learning', 'Book finished');
  });
  checkProgress();
  return { ok: true, record: saved, created: !existing, saved: ok, xp: rewards.reduce((a, b) => a + b, 0) };
}

function trackGameHistory(g, previous, isNew) {
  const today = todayStr();
  g.history = Array.isArray(g.history) ? g.history : [];
  if (isNew || previous !== g.status) g.history.push({ date: today, status: g.status });
  g.history = g.history.slice(-50);
  if (g.status === 'Playing' && !g.startedAt) g.startedAt = today;
  if (g.status === 'Completed') { g.finishedAt = g.finishedAt || today; g.progress = 100; } else if (previous === 'Completed') delete g.finishedAt;
}
function trackBookDates(b, previous, isNew) {
  const today = todayStr();
  if (b.status === 'Reading' && !b.startedAt) b.startedAt = today;
  if (b.status === 'Finished') { b.finishedAt = b.finishedAt || today; b.startedAt = b.startedAt || today; } else if (previous === 'Finished') delete b.finishedAt;
}

/* ---------------- delete / restore ---------------- */
export function removeRecord(type, id) {
  const schema = schemas[type];
  const state = State.get();
  const item = state[schema.list].find(x => x.id === id);
  if (!item) return null;
  const trashId = uid('trash');
  const related = type === 'subject' ? state.academicItems.filter(x => x.subject === item.name).map(x => JSON.parse(JSON.stringify(x))) : [];
  State.update(s => {
    s.trashBin.push({ id: trashId, type, list: schema.list, record: JSON.parse(JSON.stringify(item)), relatedAcademicRecords: related, deletedAt: new Date().toISOString() });
    s.trashBin = s.trashBin.slice(-100);
    s[schema.list] = s[schema.list].filter(x => x.id !== id);
    if (related.length) { const ids = new Set(related.map(x => x.id)); s.academicItems = s.academicItems.filter(x => !ids.has(x.id)); }
  });
  return trashId;
}
export function restoreTrash(trashId) {
  const entry = State.get().trashBin.find(t => t.id === trashId);
  if (!entry) return false;
  State.update(s => {
    s[entry.list] = Array.isArray(s[entry.list]) ? s[entry.list] : [];
    if (!s[entry.list].some(x => x.id === entry.record.id)) s[entry.list].push(entry.record);
    (entry.relatedAcademicRecords || []).forEach(x => { if (!s.academicItems.some(y => y.id === x.id)) s.academicItems.push(x); });
    s.trashBin = s.trashBin.filter(t => t.id !== trashId);
  });
  return true;
}
export function purgeTrash(trashId) { State.update(s => { s.trashBin = s.trashBin.filter(t => t.id !== trashId); }); }

/* ---------------- tasks ---------------- */
export function nextDue(due, repeat) {
  const base = isDateStr(due) ? new Date(`${due}T12:00:00`) : new Date(`${todayStr()}T12:00:00`);
  if (repeat === 'Daily') base.setDate(base.getDate() + 1);
  else if (repeat === 'Weekly') base.setDate(base.getDate() + 7);
  else if (repeat === 'Monthly') { const d = base.getDate(); base.setDate(1); base.setMonth(base.getMonth() + 1); base.setDate(Math.min(d, new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate())); }
  return dateStr(base);
}
export function toggleTask(id) {
  let result = { done: false, next: false, xp: 0 };
  State.update(s => {
    const t = s.tasks.find(x => x.id === id); if (!t) return;
    t.done = !t.done; result.done = t.done;
    if (t.done) {
      t.completedAt = new Date().toISOString();
      const r = award(s, `task:${t.id}`, 10, 'consistency', 'Task completed'); result.xp = r.points;
      if (['Daily', 'Weekly', 'Monthly'].includes(t.repeat)) {
        const due = nextDue(t.due, t.repeat);
        if (!s.tasks.some(x => x.recurrenceSourceId === t.id && x.due === due)) {
          s.tasks.push({ id: uid('task'), title: t.title, due, priority: t.priority || 'Medium', category: t.category || 'Personal', repeat: t.repeat, notes: t.notes || '', done: false, completedAt: '', recurrenceSourceId: t.id, createdAt: new Date().toISOString() });
          result.next = true;
        }
      }
    } else t.completedAt = '';
  });
  checkProgress();
  return result;
}

/* ---------------- habits ---------------- */
export function toggleHabit(id, date = todayStr()) {
  let done = false, xp = 0;
  State.update(s => {
    s.habitLogs[date] = s.habitLogs[date] || {};
    done = !s.habitLogs[date][id];
    if (done) s.habitLogs[date][id] = true; else delete s.habitLogs[date][id];
    if (!Object.keys(s.habitLogs[date]).length) delete s.habitLogs[date];
    if (done && date === todayStr()) xp = award(s, `habit:${date}:${id}`, 8, 'consistency', 'Habit check-in').points;
  });
  checkProgress();
  return { done, xp };
}

/* ---------------- academics ---------------- */
export function setAcademicProgress(id, value) {
  let completed = false;
  State.update(s => {
    const x = s.academicItems.find(i => i.id === id); if (!x) return;
    const v = clamp(value);
    x.progress = v; x.status = v >= 100 ? 'Completed' : v > 0 ? 'In Progress' : 'Pending';
    if (x.status === 'Completed') { completed = true; x.completedAt = x.completedAt || new Date().toISOString(); award(s, `academic:${x.id}`, 20, 'academics', 'Academic work completed'); } else delete x.completedAt;
  });
  checkProgress();
  return completed;
}
export function setAcademicStatus(id, status) {
  setAcademicProgress(id, status === 'Completed' ? 100 : status === 'Pending' ? 0 : Math.max(5, num(find('academic', id)?.progress) || 50));
}
export function markAttendance(subjectId, kind) {
  State.update(s => {
    const sub = s.subjects.find(x => x.id === subjectId); if (!sub) return;
    const held = num(sub.classesHeld), att = num(sub.classesAttended);
    if (kind === 'present') { sub.classesHeld = held + 1; sub.classesAttended = att + 1; }
    else if (kind === 'absent') sub.classesHeld = held + 1;
    else if (kind === 'undo-present' && held > 0 && att > 0) { sub.classesHeld = held - 1; sub.classesAttended = att - 1; }
    else if (kind === 'undo-absent' && held > att) sub.classesHeld = held - 1;
  });
}

/* ---------------- goals ---------------- */
function goalDone(s, g) { if (g.progress >= 100) { g.status = 'Completed'; g.progress = 100; award(s, `goal:${g.id}`, 30, 'personal', 'Goal completed'); } else if (g.status === 'Completed') g.status = 'In progress'; }
export function setGoalProgress(id, value) {
  State.update(s => {
    const g = s.goals.find(x => x.id === id); if (!g) return;
    g.progress = clamp(value);
    if (g.milestones?.length) g.milestoneDone = g.milestones.map((_, i) => i < Math.round(g.progress / 100 * g.milestones.length));
    goalDone(s, g);
  });
  checkProgress();
}
export function toggleMilestone(id, index) {
  State.update(s => {
    const g = s.goals.find(x => x.id === id); if (!g) return;
    g.milestoneDone[index] = !g.milestoneDone[index];
    g.progress = Math.round(g.milestoneDone.filter(Boolean).length / g.milestones.length * 100);
    goalDone(s, g);
  });
  checkProgress();
}

/* ---------------- savings goals ---------------- */
export function contributeSavings(id, amount) {
  const a = num(amount);
  if (!(a > 0)) return false;
  State.update(s => {
    const g = s.savingsGoals.find(x => x.id === id); if (!g) return;
    g.savedAmount = Math.round((num(g.savedAmount) + a) * 100) / 100;
    g.contributions = [...(g.contributions || []), { date: todayStr(), amount: a }].slice(-100);
  });
  checkProgress();
  return true;
}

/* ---------------- books ---------------- */
export function updateBookPage(id, page) {
  State.update(s => {
    const b = s.books.find(x => x.id === id); if (!b) return;
    const p = Math.max(0, Math.round(num(page)));
    b.currentPage = b.totalPages ? Math.min(p, b.totalPages) : p;
    const was = b.status;
    if (b.totalPages && b.currentPage >= b.totalPages) b.status = 'Finished'; else if (b.currentPage > 0 && ['To read', 'Finished'].includes(b.status)) b.status = 'Reading';
    trackBookDates(b, was, false);
    if (b.status === 'Finished' && was !== 'Finished') award(s, `book:${b.id}`, 25, 'learning', 'Book finished');
    b.readLog = [...(b.readLog || []), { date: todayStr(), page: b.currentPage }].slice(-200);
  });
  checkProgress();
}

