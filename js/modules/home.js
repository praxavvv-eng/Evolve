/* Home: a calm daily command centre. Only things that matter today:
 * progress ring, today's tasks, habits, upcoming deadlines, a 7-day activity strip and three quick actions. */
import * as State from '../core/state.js';
import { esc, todayStr, fmtLong, greeting, addDays, relDay, plural, fmtTime } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { habitsDueOn, habitDone, todaysTasks, academicOverview } from '../core/stats.js';
import { ring } from '../components/charts.js';
import { addBtn, emptyState } from '../components/ui.js';
import { taskRow } from './tasks.js';


function render() {
  const s = State.get(), today = todayStr();
  const tasks = todaysTasks(s), tasksDone = tasks.filter(t => t.done).length;
  const due = habitsDueOn(s, today), habitsDone = due.filter(h => habitDone(s, h.id, today)).length;
  const total = tasks.length + due.length, done = tasksDone + habitsDone;
  const percent = total ? (done / total) * 100 : 0;
  const open = tasks.filter(t => !t.done).sort((a, b) => (a.due || '9').localeCompare(b.due || '9') || (a.dueTime || '').localeCompare(b.dueTime || ''));
  const ov = academicOverview(s);
  const deadlines = ov.upcoming.filter(x => x.due <= addDays(today, 14)).slice(0, 3);
  const empty = !s.tasks.length && !s.habits.length && !s.transactions.length && !s.workoutLogs.length && !s.subjects.length && !s.games.length;

  const schedule = [...s.events.filter(e => e.date === today).map(e => ({ title: e.title, time: e.startTime, sub: e.endTime ? `Until ${fmtTime(e.endTime)}` : 'Event' })), ...s.tasks.filter(t => !t.done && t.due === today && t.dueTime).map(t => ({ title: t.title, time: t.dueTime, sub: 'Task' }))].sort((a, b) => a.time.localeCompare(b.time));
  const summary = !total ? 'Nothing planned yet today.' : done === total ? 'Everything for today is done.' : `${plural(total - done, 'thing')} left today.`;

  return `<header class="page-head home-head" style="--i:0"><div><p class="eyebrow">${esc(fmtLong())}</p><h1 class="t-hero">${esc(greeting())}</h1></div></header>
    <div class="stack-lg">
      <section class="card home-hero" style="--i:1">
        <div class="hero-top">${ring({ value: percent, size: 112, stroke: 10, label: total ? `${Math.round(percent)}%` : '–', sub: 'today', title: `${done} of ${total} done today` })}
          <div class="hero-copy"><p class="t-h2">${esc(summary)}</p>
            ${total ? `<div class="hero-pills"><span class="pill">${icon('check-square', { size: 14 })}${tasksDone}/${tasks.length} tasks</span><span class="pill">${icon('repeat', { size: 14 })}${habitsDone}/${due.length} habits</span></div>` : '<p class="t-small">Add a task or a habit to begin.</p>'}</div></div>
      </section>

      ${schedule.length ? `<section class="card card-flush" style="--i:2"><div class="panel-head"><div class="ph-title"><span class="ph-ico">${icon('clock', { size: 16 })}</span><h2>Schedule</h2></div><a class="link-btn" href="#/calendar">Calendar ${icon('chevron-right', { size: 14 })}</a></div><div class="list">${schedule.map(i => `<a class="row" href="#/calendar"><span class="row-main"><span class="row-title trunc">${esc(i.title)}</span><span class="row-sub">${esc(i.sub)}</span></span><span class="row-end"><span class="badge badge-accent no-dot t-num">${esc(fmtTime(i.time))}</span></span></a>`).join('')}</div></section>` : ''}

      ${empty ? `<section class="card" style="--i:3">${emptyState({ icon: 'sparkles', title: 'A clean start', text: 'Begin with whatever matters most today. Everything you add stays in this browser.', action: `<div class="row-gap" style="justify-content:center">${addBtn('task', 'Add a task')}${addBtn('habit', 'Add a habit', { cls: 'btn btn-sm' })}</div>` })}</section>` : `
      <section class="card card-flush" style="--i:3"><div class="panel-head"><div class="ph-title"><span class="ph-ico">${icon('check-square', { size: 16 })}</span><h2>Today</h2></div><a class="link-btn" href="#/plan">All tasks ${icon('chevron-right', { size: 14 })}</a></div>
        ${open.length || tasksDone ? `<div class="list">${[...open.slice(0, 4), ...tasks.filter(t => t.done).slice(0, Math.max(0, 4 - open.length))].map(t => taskRow(t, { menu: false })).join('')}</div>${open.length > 4 ? `<p class="t-small" style="padding:4px var(--card-p) var(--card-p)">+${open.length - 4} more in Plan</p>` : ''}` : `<p class="t-body" style="padding:0 var(--card-p) var(--card-p)">Nothing due today. ${addBtn('task', 'Add one', { cls: 'link-btn' })}</p>`}</section>

      ${due.length ? `<section class="card card-pad" style="--i:4"><div class="between"><div class="ph-title"><span class="ph-ico">${icon('repeat', { size: 16 })}</span><h2 class="t-h2">Habits</h2></div><a class="link-btn" href="#/habits">Manage ${icon('chevron-right', { size: 14 })}</a></div>
        <div class="habit-chips mt-3">${due.map(h => { const on = habitDone(s, h.id, today); return `<button type="button" class="habit-chip ${on ? 'is-on' : ''}" style="--hc:${esc(h.color || '#5cc28a')}" data-action="habit-toggle" data-id="${esc(h.id)}" data-date="${today}" aria-pressed="${on}"><span>${esc(h.icon || '✦')}</span><b class="trunc">${esc(h.name)}</b>${on ? icon('check', { size: 16 }) : ''}</button>`; }).join('')}</div></section>` : ''}

      ${deadlines.length ? `<section class="card card-flush" style="--i:5"><div class="panel-head"><div class="ph-title"><span class="ph-ico">${icon('graduation', { size: 16 })}</span><div><h2>Upcoming deadlines</h2><p>Next 14 days</p></div></div><a class="link-btn" href="#/academics">Academics ${icon('chevron-right', { size: 14 })}</a></div>
        <div class="list">${deadlines.map(x => `<a class="row" href="#/academics"><span class="row-lead">${icon('graduation', { size: 18 })}</span><span class="row-main"><span class="row-title trunc">${esc(x.title)}</span><span class="row-sub">${esc(x.subject)}</span></span><span class="row-end"><span class="badge ${x.due < today ? 'badge-neg' : 'badge-accent'} no-dot">${esc(relDay(x.due))}${x.dueTime ? `, ${esc(fmtTime(x.dueTime))}` : ''}</span></span></a>`).join('')}</div></section>` : ''}`}
    </div>`;
}

export const route = { id: 'home', render };
