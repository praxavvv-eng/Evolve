/* Pure calculations over workspace state. No DOM, no writes.
 * Everything displayed as a number elsewhere in the app comes from here or from raw records. */
import { addDays, todayStr, parseDate, monthKey, sum, num, clamp, groupBy, isDateStr } from './utils.js';

/* ---------------- habits ---------------- */
export function isScheduled(habit, date) {
  const dow = (parseDate(date) || new Date()).getDay();       // 0 Sun … 6 Sat
  if (habit.schedule === 'Weekdays') return dow >= 1 && dow <= 5;
  if (habit.schedule === 'Weekends') return dow === 0 || dow === 6;
  return true;
}
export const habitDone = (state, id, date) => Boolean(state.habitLogs?.[date]?.[id]);

/** Consecutive scheduled days completed. Unscheduled days are skipped; today does not break a streak until it ends. */
export function habitStreak(state, habit) {
  let count = 0, cursor = todayStr();
  for (let i = 0; i < 400; i++) {
    if (!isScheduled(habit, cursor)) { cursor = addDays(cursor, -1); continue; }
    if (habitDone(state, habit.id, cursor)) count++;
    else if (cursor !== todayStr()) break;
    cursor = addDays(cursor, -1);
  }
  return count;
}
export const habitsDueOn = (state, date) => state.habits.filter(h => isScheduled(h, date));

/* ---------------- tasks ---------------- */
export const completedOn = (t, date) => t.done && String(t.completedAt || '').slice(0, 10) === date;
/** Tasks that belong to "today": open and due today or overdue, or finished today. Undated tasks are not "today". */
export function todaysTasks(state) {
  const today = todayStr();
  return state.tasks.filter(t => (!t.done && isDateStr(t.due) && t.due <= today) || completedOn(t, today));
}

/* ---------------- academics ---------------- */
const itemPct = x => (x.status === 'Completed' ? 100 : clamp(x.progress));

function workStats(items, total, noField) {
  const configured = Math.max(0, num(total));
  const highest = Math.max(0, ...items.map(x => num(x[noField])));
  const denominator = configured || Math.max(items.length, highest);           // only configured (or tracked) slots count
  const byNo = new Map();
  items.forEach(x => { const n = num(x[noField]); if (n > 0 && !byNo.has(n)) byNo.set(n, x); });
  const unnumbered = items.filter(x => !(num(x[noField]) > 0));
  const counted = [...byNo.values(), ...unnumbered].slice(0, denominator || undefined);
  const done = counted.filter(x => x.status === 'Completed' || num(x.progress) >= 100).length;
  const progress = denominator ? Math.min(100, Math.round(sum(counted, itemPct) / denominator)) : 0;
  const slots = Array.from({ length: configured || highest }, (_, i) => ({ no: i + 1, item: byNo.get(i + 1) || null }));
  return { total: denominator, configured, done, progress, slots, items };
}

export function subjectStats(state, subject) {
  const items = state.academicItems.filter(x => x.subject === subject.name);
  const assignments = workStats(items.filter(x => x.type === 'Assignment'), subject.totalAssignments, 'assignmentNo');
  const practicals = workStats(items.filter(x => x.type === 'Practical'), subject.totalPracticals, 'practicalNo');
  const other = items.filter(x => !['Assignment', 'Practical'].includes(x.type));
  const held = num(subject.classesHeld), attended = Math.min(held, num(subject.classesAttended));
  const slots = assignments.total + practicals.total + other.length;
  const points = assignments.progress * assignments.total + practicals.progress * practicals.total + sum(other, itemPct);
  const progress = slots ? Math.min(100, Math.round(points / slots)) : 0;
  const pending = items.filter(x => x.status !== 'Completed' && num(x.progress) < 100);
  return { items, assignments, practicals, other, attendance: { held, attended, rate: held ? (attended / held) * 100 : null }, progress, pending, completed: items.length - pending.length };
}

export function academicOverview(state) {
  const subs = state.subjects.map(s => ({ subject: s, ...subjectStats(state, s) }));
  const loose = state.academicItems.filter(x => !state.subjects.some(s => s.name === x.subject));
  const pending = state.academicItems.filter(x => x.status !== 'Completed' && num(x.progress) < 100);
  const slots = sum(subs, s => s.assignments.total + s.practicals.total + s.other.length) + loose.length;
  const points = sum(subs, s => s.progress * (s.assignments.total + s.practicals.total + s.other.length)) + sum(loose, itemPct);
  const dated = pending.filter(x => isDateStr(x.due)).sort((a, b) => a.due.localeCompare(b.due));
  return { subs, loose, pending, progress: slots ? Math.min(100, Math.round(points / slots)) : 0, upcoming: dated, completed: state.academicItems.length - pending.length };
}

/* ---------------- finance ---------------- */
export const txInMonth = (state, key) => state.transactions.filter(t => monthKey(t.date) === key);
export function monthTotals(state, key) {
  const items = txInMonth(state, key);
  const income = sum(items.filter(t => t.type === 'income'), t => t.amount);
  const expense = sum(items.filter(t => t.type === 'expense'), t => t.amount);
  const byCat = {};
  items.filter(t => t.type === 'expense').forEach(t => { const c = t.category || 'Other'; byCat[c] = (byCat[c] || 0) + num(t.amount); });
  return { items, income, expense, net: income - expense, byCat, count: items.length };
}
export const recordedBalance = state => sum(state.transactions.filter(t => t.type === 'income'), t => t.amount) - sum(state.transactions.filter(t => t.type === 'expense'), t => t.amount);
export const budgetSpent = (state, b) => sum(state.transactions.filter(t => t.type === 'expense' && monthKey(t.date) === b.month && t.category === b.category), t => t.amount);

/* ---------------- fitness ---------------- */
export const entryVolume = x => num(x.sets) * num(x.reps) * num(x.weight);
export const norm = s => String(s || '').trim().toLowerCase();
export function exerciseSummaries(state) {
  const groups = groupBy(state.workoutLogs, x => norm(x.exercise));
  return Object.values(groups).map(list => {
    const sorted = list.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.createdAt || '').localeCompare(b.createdAt || ''));
    const name = sorted[sorted.length - 1].exercise;
    const maxWeight = Math.max(0, ...sorted.map(x => num(x.weight)));
    const best = sorted.reduce((b, x) => (num(x.weight) > num(b.weight) || (num(x.weight) === num(b.weight) && num(x.reps) > num(b.reps)) ? x : b), sorted[0]);
    const bestVolume = sorted.reduce((b, x) => (entryVolume(x) > entryVolume(b) ? x : b), sorted[0]);
    return { key: norm(name), name, entries: sorted, count: sorted.length, last: sorted[sorted.length - 1], maxWeight, best, bestVolume, hasWeight: maxWeight > 0 };
  }).sort((a, b) => b.last.date.localeCompare(a.last.date));
}
/** A PR is a heaviest weighted set; unweighted exercises use most reps in a set. */
export const personalRecord = s => (s.hasWeight ? { value: s.maxWeight, unit: 'kg', detail: `${num(s.best.reps)} reps`, date: s.best.date } : { value: Math.max(...s.entries.map(x => num(x.reps))), unit: 'reps', detail: 'best set', date: s.entries.reduce((b, x) => (num(x.reps) > num(b.reps) ? x : b), s.entries[0]).date });
export const sessionsByDate = state => groupBy(state.workoutLogs, x => x.date || 'unknown');

/* ---------------- discipline ---------------- */
export const logsOf = nf => nf?.dailyLogs || nf?.logs || {};
export function streakFrom(logs, endDate, startDate = '') {
  let count = 0, cursor = endDate;
  while (count < 10000) {
    if (startDate && cursor < startDate) break;
    if (logs?.[cursor]?.status !== 'on-track') break;
    count++; cursor = addDays(cursor, -1);
  }
  return count;
}
/** Current streak: ends today if today is recorded on-track, otherwise yesterday. An unrecorded day does not erase it until it passes. */
export function currentStreak(nf) {
  const logs = logsOf(nf), today = todayStr();
  if (logs[today]?.status === 'slip') return 0;
  return streakFrom(logs, logs[today]?.status === 'on-track' ? today : addDays(today, -1));
}
export function bestStreak(nf) {
  const logs = logsOf(nf);
  let best = 0, run = 0, prev = '';
  Object.keys(logs).sort().forEach(d => {
    if (logs[d]?.status !== 'on-track') { run = 0; prev = d; return; }
    run = prev && addDays(prev, 1) === d && run > 0 ? run + 1 : 1; best = Math.max(best, run); prev = d;
  });
  return Math.max(best, num(nf?.bestStreak));
}

/* ---------------- books ---------------- */
export const bookProgress = b => (b.status === 'Finished' ? 100 : b.totalPages > 0 ? Math.min(100, Math.round((num(b.currentPage) / b.totalPages) * 100)) : 0);
