/* Home: a calm daily command centre. Only things that matter today:
 * progress ring, today's tasks, habits, upcoming deadlines, a 7-day activity strip and three quick actions. */
import * as State from '../core/state.js';
import { esc, todayStr, fmtLong, greeting, addDays, rangeDates, weekdayInitial, relDay, plural } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { habitsDueOn, habitDone, todaysTasks, completedOn, academicOverview } from '../core/stats.js';
import { ring, bars, legend } from '../components/charts.js';
import { addBtn, emptyState } from '../components/ui.js';
import { taskRow } from './tasks.js';

const COLORS = { tasks: 'var(--accent)', habits: '#94b8d0', workouts: '#d39a6e' };

function weekActivity(s) {
  const today = todayStr();
  return rangeDates(addDays(today, -6), today).map(d => {
    const tasks = s.tasks.filter(t => completedOn(t, d)).length;
    const habits = Object.keys(s.habitLogs[d] || {}).length;
    const workouts = s.workoutLogs.filter(w => w.date === d).length;
    return { label: weekdayInitial(d), today: d === today, segments: [{ v: tasks, color: COLORS.tasks, name: `${tasks} tasks` }, { v: habits, color: COLORS.habits, name: `${habits} habits` }, { v: workouts, color: COLORS.workouts, name: `${workouts} workouts` }], title: `${d}: ${tasks} tasks, ${habits} habits, ${workouts} workouts` };
  });
}

function render() {
  const s = State.get(), today = todayStr();
  const tasks = todaysTasks(s), tasksDone = tasks.filter(t => t.done).length;
  const due = habitsDueOn(s, today), habitsDone = due.filter(h => habitDone(s, h.id, today)).length;
  const total = tasks.length + due.length, done = tasksDone + habitsDone;
  const percent = total ? (done / total) * 100 : 0;
  const open = tasks.filter(t => !t.done).sort((a, b) => (a.due || '9').localeCompare(b.due || '9'));
  const ov = academicOverview(s);
  const deadlines = ov.upcoming.filter(x => x.due <= addDays(today, 14)).slice(0, 3);
  const week = weekActivity(s), weekTotal = week.reduce((a, d) => a + d.segments.reduce((x, y) => x + y.v, 0), 0);
  const empty = !s.tasks.length && !s.habits.length && !s.transactions.length && !s.workoutLogs.length && !s.subjects.length && !s.games.length;

  const summary = !total ? 'Nothing planned yet today.' : done === total ? 'Everything for today is done.' : `${plural(total - done, 'thing')} left today.`;

  return `<header class="page-head home-head" style="--i:0"><div><p class="eyebrow">${esc(fmtLong())}</p><h1 class="t-hero">${esc(greeting())}</h1></div></header>
    <div class="stack-lg">
      <section class="card home-hero" style="--i:1">
        <div class="hero-top">${ring({ value: percent, size: 112, stroke: 10, label: total ? `${Math.round(percent)}%` : '–', sub: 'today', title: `${done} of ${total} done today` })}
          <div class="hero-copy"><p class="t-h2">${esc(summary)}</p>
            <p class="t-small">${total ? `${tasksDone}/${tasks.length} tasks · ${habitsDone}/${due.length} habits` : 'Add a task or a habit to begin.'}</p></div></div>
        ${weekTotal ? `<div class="hero-week">${bars({ items: week, height: 74, ariaLabel: 'Activity over the last 7 days' })}${legend([{ label: 'Tasks', color: COLORS.tasks }, { label: 'Habits', color: COLORS.habits }, { label: 'Workouts', color: COLORS.workouts }])}</div>` : ''}
      </section>

      <div class="quick-row" style="--i:2">${addBtn('task', 'Task', { cls: 'btn' })}${addBtn('workout', 'Workout', { cls: 'btn' })}${addBtn('transaction', 'Expense', { cls: 'btn' })}</div>

      ${empty ? `<section class="card" style="--i:3">${emptyState({ icon: 'sparkles', title: 'A clean start', text: 'Begin with whatever matters most today. Everything you add stays in this browser.', action: `<div class="row-gap" style="justify-content:center">${addBtn('task', 'Add a task')}${addBtn('habit', 'Add a habit', { cls: 'btn btn-sm' })}</div>` })}</section>` : `
      <section class="card card-flush" style="--i:3"><div class="panel-head"><div><h2>Today</h2></div><a class="link-btn" href="#/plan">All tasks ${icon('chevron-right', { size: 14 })}</a></div>
        ${open.length || tasksDone ? `<div class="list">${[...open.slice(0, 4), ...tasks.filter(t => t.done).slice(0, Math.max(0, 4 - open.length))].map(t => taskRow(t, { menu: false })).join('')}</div>${open.length > 4 ? `<p class="t-small" style="padding:4px var(--card-p) var(--card-p)">+${open.length - 4} more in Plan</p>` : ''}` : `<p class="t-body" style="padding:0 var(--card-p) var(--card-p)">Nothing due today. ${addBtn('task', 'Add one', { cls: 'link-btn' })}</p>`}</section>

      ${due.length ? `<section class="card card-pad" style="--i:4"><div class="between"><h2 class="t-h2">Habits</h2><a class="link-btn" href="#/habits">Manage ${icon('chevron-right', { size: 14 })}</a></div>
        <div class="habit-chips mt-3">${due.map(h => { const on = habitDone(s, h.id, today); return `<button type="button" class="habit-chip ${on ? 'is-on' : ''}" data-action="habit-toggle" data-id="${esc(h.id)}" data-date="${today}" aria-pressed="${on}"><span>${esc(h.icon || '✦')}</span><b class="trunc">${esc(h.name)}</b>${on ? icon('check', { size: 16 }) : ''}</button>`; }).join('')}</div></section>` : ''}

      ${deadlines.length ? `<section class="card card-flush" style="--i:5"><div class="panel-head"><div><h2>Upcoming deadlines</h2><p>Next 14 days</p></div><a class="link-btn" href="#/academics">Academics ${icon('chevron-right', { size: 14 })}</a></div>
        <div class="list">${deadlines.map(x => `<a class="row" href="#/academics"><span class="row-lead">${icon('graduation', { size: 18 })}</span><span class="row-main"><span class="row-title trunc">${esc(x.title)}</span><span class="row-sub">${esc(x.subject)}</span></span><span class="row-end"><span class="badge ${x.due < today ? 'badge-neg' : 'badge-accent'} no-dot">${esc(relDay(x.due))}</span></span></a>`).join('')}</div></section>` : ''}`}
    </div>`;
}

export const route = { id: 'home', render };
