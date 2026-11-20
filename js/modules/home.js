/* Home: a daily command centre. Only what matters today, in order of importance:
 * progress, quick actions, focus tasks, habits, schedule, a few real snapshots, deadlines and recent activity.
 * Nothing is invented: every number comes from recorded data, and a section with no data does not appear. */
import * as State from '../core/state.js';
import { num, esc, todayStr, fmtLong, greeting, addDays, relDay, plural, fmtTime, money, monthKey, fmtDate, isDateStr } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { habitsDueOn, habitDone, todaysTasks, academicOverview, habitStreakInfo, monthTotals, bookProgress, gameProgress, budgetSpent } from '../core/stats.js';
import { ring } from '../components/charts.js';
import { addBtn, emptyState } from '../components/ui.js';
import { taskRow } from './tasks.js';

const MAX_TASKS = 4;
const streakText = (s, h) => { const i = habitStreakInfo(s, h); return i.value ? `${i.value} ${i.unit}${i.value === 1 ? '' : 's'} streak` : 'Start a streak'; };

function snapshots(s, today) {
  const tiles = [];
  const mk = monthKey(today), totals = monthTotals(s, mk);
  if (totals.count) {
    const over = s.budgets.filter(b => b.month === mk && b.monthlyLimit > 0 && budgetSpent(s, b) > b.monthlyLimit).length;
    tiles.push({ href: '#/finance', ico: 'wallet', label: 'Spent this month', value: money(totals.expense, { compactMode: true }), sub: over ? `${plural(over, 'budget')} over limit` : totals.income ? `${money(totals.income, { compactMode: true })} in` : 'No budget exceeded' });
  }
  const weekAgo = addDays(today, -6), sessions = new Set(s.workoutLogs.filter(w => w.date >= weekAgo && w.date <= today).map(w => w.date)).size;
  if (s.workoutLogs.length) {
    const last = s.workoutLogs.map(w => w.date).sort().pop();
    tiles.push({ href: '#/fitness', ico: 'dumbbell', label: 'Training', value: sessions ? plural(sessions, 'session') : 'Rest', sub: sessions ? 'Last 7 days' : `Last: ${relDay(last)}` });
  }
  const ov = academicOverview(s);
  if (ov.pending.length) {
    const next = ov.upcoming[0];
    tiles.push({ href: '#/academics', ico: 'graduation', label: 'Academics', value: `${ov.pending.length} pending`, sub: next ? `${next.title} · ${relDay(next.due)}` : 'No deadlines set' });
  }
  const reading = s.books.find(b => b.status === 'Reading');
  if (reading) tiles.push({ href: '#/books', ico: 'book', label: 'Reading', value: `${Math.round(bookProgress(reading))}%`, sub: reading.title });
  const playing = s.games.find(g => g.status === 'Playing');
  if (playing && tiles.length < 4) tiles.push({ href: '#/gaming', ico: 'gamepad', label: 'Playing', value: gameProgress(playing).value === null ? `${Math.round(num(playing.hours))} h` : `${Math.round(gameProgress(playing).value)}%`, sub: playing.title });
  return tiles.slice(0, 4);
}

function render() {
  const s = State.get(), today = todayStr();
  const tasks = todaysTasks(s), tasksDone = tasks.filter(t => t.done).length;
  const due = habitsDueOn(s, today), habitsDone = due.filter(h => habitDone(s, h.id, today)).length;
  const total = tasks.length + due.length, done = tasksDone + habitsDone;
  const percent = total ? (done / total) * 100 : 0;
  const byTime = (a, b) => (a.due || '9').localeCompare(b.due || '9') || (a.dueTime || '').localeCompare(b.dueTime || '');
  const open = tasks.filter(t => !t.done).sort(byTime);
  const ov = academicOverview(s);
  const deadlines = ov.upcoming.filter(x => x.due <= addDays(today, 14)).slice(0, 3);
  const empty = !s.tasks.length && !s.habits.length && !s.transactions.length && !s.workoutLogs.length && !s.subjects.length && !s.games.length && !s.books.length && !s.notes.length;
  const schedule = [...s.events.filter(e => e.date === today).map(e => ({ title: e.title, time: e.startTime, sub: e.endTime ? `Until ${fmtTime(e.endTime)}` : 'Event' })), ...s.tasks.filter(t => !t.done && t.due === today && t.dueTime).map(t => ({ title: t.title, time: t.dueTime, sub: 'Task' }))].sort((a, b) => a.time.localeCompare(b.time));
  const nowT = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;
  const snaps = snapshots(s, today);
  const recent = s.activityLog.slice(0, 3);
  const summary = !total ? 'Nothing planned yet' : done === total ? 'All done for today' : `${plural(total - done, 'thing')} left`;

  return `<header class="page-head home-head" style="--i:0"><div><p class="eyebrow">${esc(fmtLong())}</p><h1 class="t-hero">${esc(greeting())}</h1></div></header>
    <div class="stack-lg">
      ${empty ? `<section class="card" style="--i:1">${emptyState({ icon: 'sparkles', title: 'A clean start', text: 'Begin with whatever matters most today. Everything you add stays on this device and syncs only if you turn on cloud sync.', action: `<div class="row-gap" style="justify-content:center">${addBtn('task', 'Add a task')}${addBtn('habit', 'Add a habit', { cls: 'btn btn-sm' })}</div>` })}</section>` : `
      <section class="card home-hero" style="--i:1"><div class="hero-top">${ring({ value: percent, size: 92, stroke: 9, label: total ? `${Math.round(percent)}%` : '–', title: `${done} of ${total} done today` })}
        <div class="hero-copy"><p class="hero-sum">${esc(summary)}</p>
          ${total ? `<div class="hero-pills"><span class="pill">${icon('check-square', { size: 14 })}${tasksDone}/${tasks.length} tasks</span><span class="pill">${icon('repeat', { size: 14 })}${habitsDone}/${due.length} habits</span></div>` : '<p class="t-small">Add a task or habit to begin.</p>'}</div></div></section>
      <div class="qa-row hscroll" style="--i:2" aria-label="Quick actions">${addBtn('task', 'Task', { cls: 'qa-chip' })}${addBtn('transaction', 'Expense', { cls: 'qa-chip', prefill: { type: 'expense' } })}${addBtn('workout', 'Workout', { cls: 'qa-chip' })}${addBtn('note', 'Note', { cls: 'qa-chip' })}${addBtn('habit', 'Habit', { cls: 'qa-chip' })}</div>

      <section style="--i:3"><div class="sec-head tight"><h2>Focus</h2><a class="link-btn" href="#/plan">All tasks ${icon('chevron-right', { size: 14 })}</a></div>
        ${tasks.length ? `<div class="card card-flush"><div class="list">${[...open.slice(0, MAX_TASKS), ...tasks.filter(t => t.done).slice(0, Math.max(0, MAX_TASKS - open.length))].map(t => taskRow(t, { compact: true })).join('')}</div>${open.length > MAX_TASKS ? `<a class="more-line" href="#/plan">+${open.length - MAX_TASKS} more</a>` : ''}</div>` : `<div class="card card-pad inline-empty"><span>Nothing due today.</span>${addBtn('task', 'Add task', { cls: 'link-btn' })}</div>`}</section>

      ${due.length ? `<section style="--i:4"><div class="sec-head tight"><h2>Habits</h2><a class="link-btn" href="#/habits">Open ${icon('chevron-right', { size: 14 })}</a></div>
        <div class="habit-tiles hscroll">${due.map(h => { const on = habitDone(s, h.id, today); return `<button type="button" class="habit-tile ${on ? 'is-on' : ''}" style="--hc:${esc(h.color || '#5cc28a')}" data-action="habit-toggle" data-id="${esc(h.id)}" data-date="${today}" aria-pressed="${on}"><span class="ht-top"><span class="ht-ico">${esc(h.icon || '✦')}</span><span class="ht-check">${icon('check', { size: 14 })}</span></span><b class="trunc">${esc(h.name)}</b><small class="trunc">${esc(streakText(s, h))}</small></button>`; }).join('')}</div></section>` : ''}

      ${schedule.length ? `<section style="--i:5"><div class="sec-head tight"><h2>Schedule</h2><a class="link-btn" href="#/calendar">Calendar ${icon('chevron-right', { size: 14 })}</a></div>
        <div class="card card-flush"><div class="list">${schedule.map(i => `<a class="row sched-row ${i.time < nowT ? 'is-past' : ''}" href="#/calendar"><span class="sched-time t-num">${esc(fmtTime(i.time))}</span><span class="row-main"><span class="row-title trunc">${esc(i.title)}</span><span class="row-sub">${esc(i.sub)}</span></span></a>`).join('')}</div></div></section>` : ''}

      ${snaps.length ? `<section style="--i:6"><div class="sec-head tight"><h2>Snapshot</h2></div><div class="snap-grid">${snaps.map(t => `<a class="card snap" href="${t.href}"><span class="snap-ico">${icon(t.ico, { size: 18 })}</span><span class="snap-label">${esc(t.label)}</span><b class="snap-val t-num trunc">${esc(t.value)}</b><span class="snap-sub trunc">${esc(t.sub)}</span></a>`).join('')}</div></section>` : ''}

      ${deadlines.length ? `<section style="--i:7"><div class="sec-head tight"><div><h2>Upcoming deadlines</h2></div><a class="link-btn" href="#/academics">Academics ${icon('chevron-right', { size: 14 })}</a></div>
        <div class="card card-flush"><div class="list">${deadlines.map(x => `<a class="row" href="#/academics"><span class="row-lead">${icon('graduation', { size: 18 })}</span><span class="row-main"><span class="row-title trunc">${esc(x.title)}</span><span class="row-sub">${esc(x.subject)}</span></span><span class="row-end"><span class="badge ${x.due < today ? 'badge-neg' : 'badge-accent'} no-dot">${esc(relDay(x.due))}${x.dueTime ? `, ${esc(fmtTime(x.dueTime))}` : ''}</span></span></a>`).join('')}</div></div></section>` : ''}

      ${recent.length ? `<section style="--i:8"><div class="sec-head tight"><h2>Recent activity</h2><a class="link-btn" href="#/levels">Levels ${icon('chevron-right', { size: 14 })}</a></div>
        <div class="card card-flush"><div class="list">${recent.map(a => `<div class="row row-compact"><span class="row-main"><span class="row-title trunc">${esc(a.label)}</span><span class="row-sub">${esc(isDateStr(String(a.date).slice(0, 10)) ? fmtDate(String(a.date).slice(0, 10)) : '')}</span></span><span class="row-end"><span class="badge badge-accent no-dot">+${a.points} XP</span></span></div>`).join('')}</div></div></section>` : ''}`}
    </div>`;
}

export const route = { id: 'home', render };
