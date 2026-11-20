/* Pure calculations over workspace state. No DOM, no writes.
 * Everything displayed as a number elsewhere in the app comes from here or from raw records. */
import { addDays, todayStr, parseDate, dateStr, monthKey, sum, num, clamp, groupBy, isDateStr } from './utils.js';

/* ---------------- habits ----------------
 * Every habit keeps its own history in habitLogs[date][habitId] (a boolean map, so one habit can never have two
 * records for the same day). Dates are local YYYY-MM-DD strings everywhere, so time zones and daylight saving never shift a day.
 *
 * Schedules:  Daily / Weekdays / Weekends / Custom (habit.days = weekday numbers 0-6)  -> "fixed" habits, counted in days.
 *             "3 days / week" (habit.perWeek = N)                                       -> "weekly" habits, counted in weeks.
 * Rules:      - future days are never missed          - unscheduled days never break a streak
 *             - a rest day (habit.skips[date]) is not a failure and never breaks a streak
 *             - today is never a miss until the day has passed
 */
export const WEEKLY = '3 days / week';
export const habitMode = h => (h.schedule === WEEKLY ? 'weekly' : 'fixed');
export const habitPerWeek = h => Math.min(6, Math.max(1, Math.round(num(h.perWeek)) || 3));
export const habitUnit = h => (habitMode(h) === 'weekly' ? 'week' : 'day');
export const isRest = (habit, date) => Boolean(habit.skips?.[date]);
export function isScheduled(habit, date) {
  const dow = (parseDate(date) || new Date()).getDay();       // 0 Sun … 6 Sat
  if (habit.schedule === 'Weekdays') return dow >= 1 && dow <= 5;
  if (habit.schedule === 'Weekends') return dow === 0 || dow === 6;
  if (habit.schedule === 'Custom' && Array.isArray(habit.days) && habit.days.length) return habit.days.includes(dow);
  return true;                                                 // Daily, flexible weekly (any day can count) and legacy Custom
}
export const habitDone = (state, id, date) => Boolean(state.habitLogs?.[date]?.[id]);

const mondayOf = (d, monday = true) => { const x = parseDate(d); x.setDate(x.getDate() - (monday ? (x.getDay() + 6) % 7 : x.getDay())); return dateStr(x); };
const startsMonday = state => state?.settings?.weekStartsMonday !== false;

export function habitStartDate(state, h) {
  const first = Object.keys(state.habitLogs).filter(d => state.habitLogs[d]?.[h.id]).sort()[0];
  const created = h.createdAt ? String(h.createdAt).slice(0, 10) : '';
  const candidates = [first, created].filter(isDateStr).sort();
  return candidates[0] || todayStr();
}

/** Weekly habits: one entry per week from the first tracked week to the current one. */
function weekRuns(state, h, start, today) {
  const mon = startsMonday(state), out = [];
  for (let w = mondayOf(start, mon), i = 0; w <= today && i < 600; w = addDays(w, 7), i++) {
    const end = addDays(w, 6), from = w < start ? start : w;
    let done = 0;
    for (let d = from; d <= end && d <= today; d = addDays(d, 1)) if (habitDone(state, h.id, d)) done++;
    const daysLeft = Math.round((parseDate(end) - parseDate(from)) / 86400000) + 1;     // first week may be partial
    const required = Math.min(habitPerWeek(h), daysLeft);
    out.push({ week: w, done, required, met: done >= required, current: end >= today });
  }
  return out;
}

/** { value, unit }: consecutive days (fixed) or weeks (weekly) that were kept. */
export function habitStreakInfo(state, h) {
  const today = todayStr(), start = habitStartDate(state, h), unit = habitUnit(h);
  let count = 0;
  if (unit === 'week') {
    const runs = weekRuns(state, h, start, today);
    for (let i = runs.length - 1; i >= 0; i--) {
      if (runs[i].met) count++;
      else if (runs[i].current) continue;               // this week is still open
      else break;
    }
    return { value: count, unit };
  }
  for (let d = today, i = 0; d >= start && i < 4000; d = addDays(d, -1), i++) {
    if (habitDone(state, h.id, d)) count++;
    else if (!isScheduled(h, d) || isRest(h, d) || d === today) continue;
    else break;
  }
  return { value: count, unit };
}
export const habitStreak = (state, habit) => habitStreakInfo(state, habit).value;
/** Streak expressed in days, for achievements (a weekly streak counts seven days per week). */
export const habitStreakDays = (state, habit) => { const s = habitStreakInfo(state, habit); return s.unit === 'week' ? s.value * 7 : s.value; };

/** State of one calendar day for one habit: done | rest | missed | off | pre | future | open */
export function habitDayState(state, h, d, start) {
  const today = todayStr();
  if (d > today) return 'future';
  if (habitDone(state, h.id, d)) return 'done';
  if (d < start) return 'pre';
  if (isRest(h, d)) return 'rest';
  if (habitMode(h) === 'weekly') return d === today ? 'open' : 'off';      // a weekly habit cannot miss a single day
  if (!isScheduled(h, d)) return 'off';
  return d === today ? 'open' : 'missed';
}

export const habitsDueOn = (state, date) => state.habits.filter(h => isScheduled(h, date) && !isRest(h, date));

/** Share of today's habits done on a day, used by the combined heatmap (0..1, or null when nothing was due). */
export function dayHabitScore(state, date, habits = state.habits) {
  const due = habits.filter(h => isScheduled(h, date) && !isRest(h, date) && (habitStartDate(state, h) <= date));
  const done = habits.filter(h => habitDone(state, h.id, date)).length;
  const total = Math.max(due.length, done);
  return total ? done / total : null;
}

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
  const dated = pending.filter(x => isDateStr(x.due)).sort((a, b) => a.due.localeCompare(b.due) || (a.dueTime || '').localeCompare(b.dueTime || ''));
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
export function streakFrom(logs, endDate, startDate = '', ok = 'on-track') {
  let count = 0, cursor = endDate;
  while (count < 10000) {
    if (startDate && cursor < startDate) break;
    if (logs?.[cursor]?.status !== ok) break;
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

/* ---------------- games ---------------- */
/** Playtime progress. Estimated hours (when set) are authoritative; legacy manual progress is kept; otherwise unset (null).
 *  This is progress against estimated playtime, not story completion. */
export function gameProgress(g) {
  const est = num(g.estimatedHours), hours = num(g.hours);
  if (g.status === 'Completed') return { value: 100, source: 'completed', hours, est };
  if (est > 0) return { value: clamp((hours / est) * 100), source: 'estimate', hours, est };
  if (num(g.progress) > 0) return { value: clamp(g.progress), source: 'manual', hours, est: 0 };
  return { value: null, source: 'unset', hours, est: 0 };
}
/** Timed entries sort by time; entries without a time come first (all-day). */
export const byTime = (a, b) => String(a.dueTime || '').localeCompare(String(b.dueTime || ''));

/* ---------------- habit statistics (all from recorded check-ins) ---------------- */
export function habitStats(state, h) {
  const today = todayStr(), start = habitStartDate(state, h), unit = habitUnit(h);
  let longest = 0, totalDone = 0, scheduled = 0, restDays = 0;
  for (let d = start, i = 0; d <= today && i < 4000; d = addDays(d, 1), i++) {
    if (habitDone(state, h.id, d)) totalDone++;
    if (isRest(h, d) && !habitDone(state, h.id, d)) restDays++;
  }
  if (unit === 'week') {
    const runs = weekRuns(state, h, start, today);
    let run = 0;
    runs.forEach(r => { if (r.met) { run++; longest = Math.max(longest, run); } else if (!r.current) run = 0; });
    scheduled = runs.reduce((a, r) => a + r.required, 0);
  } else {
    let run = 0;
    for (let d = start, i = 0; d <= today && i < 4000; d = addDays(d, 1), i++) {
      if (habitDone(state, h.id, d)) { run++; longest = Math.max(longest, run); if (isScheduled(h, d)) scheduled++; continue; }
      if (!isScheduled(h, d) || isRest(h, d)) continue;
      scheduled++;
      if (d < today) run = 0;
    }
  }
  const cur = habitStreakInfo(state, h);
  let weekDone, weekScheduled;
  if (unit === 'week') {
    const w = weekRuns(state, h, start, today).find(r => r.current);
    weekDone = w ? w.done : 0; weekScheduled = w ? w.required : habitPerWeek(h);
  } else {
    const days = Array.from({ length: 7 }, (_, i) => addDays(today, -i)).filter(d => d >= start && isScheduled(h, d) && !isRest(h, d));
    weekDone = days.filter(d => habitDone(state, h.id, d)).length; weekScheduled = days.length;
  }
  const recent = Object.keys(state.habitLogs).filter(d => state.habitLogs[d]?.[h.id]).sort().reverse().slice(0, 5);
  return { current: cur.value, longest, unit, totalDone, scheduled, pct: scheduled ? Math.min(100, (totalDone / scheduled) * 100) : 0, weekDone, weekScheduled, weekPct: weekScheduled ? Math.min(100, (weekDone / weekScheduled) * 100) : 0, recent, start, restDays };
}

/* ---------------- challenges ---------------- */
export function challengeStats(c) {
  const today = todayStr(), logs = c.logs || {};
  const days = Object.keys(logs).sort();
  let longest = 0, run = 0, prev = '';
  days.forEach(d => { if (logs[d].status !== 'done') { run = 0; prev = d; return; } run = prev && addDays(prev, 1) === d && run > 0 ? run + 1 : 1; longest = Math.max(longest, run); prev = d; });
  let current = 0;
  if (logs[today]?.status !== 'slip') current = streakFrom(logs, logs[today]?.status === 'done' ? today : addDays(today, -1), '', 'done');
  const done = days.filter(d => logs[d].status === 'done').length, slips = days.filter(d => logs[d].status === 'slip').length;
  const end = addDays(c.startDate, Math.max(1, c.targetDays) - 1);
  return { done, slips, current, longest, end, progress: Math.min(100, (current / Math.max(1, c.targetDays)) * 100), reached: longest >= c.targetDays, notStarted: c.startDate > today, todayStatus: logs[today]?.status || '' };
}
export const maxChallengeStreak = state => Math.max(0, ...(state.challenges || []).map(c => challengeStats(c).longest));
