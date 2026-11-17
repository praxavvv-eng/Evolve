/* Habits: a calm checklist, and a detail screen with each habit's own coloured heatmap and statistics.
 * Every habit's history is separate: habitLogs[date][habitId]. Nothing here touches another habit's days. */
import * as State from '../core/state.js';
import { registerActions, emit } from '../core/events.js';
import { toggleHabit, find } from '../core/records.js';
import { esc, todayStr, addDays, fmtDate, rangeDates, readableOn, relDay } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { habitStreak, habitsDueOn, habitDone, isScheduled, habitStats } from '../core/stats.js';
import { pageHead, emptyState, addBtn, kebab } from '../components/ui.js';
import { habitYear, habitWeek, heatLegend, habitDayState } from '../components/heatmap.js';
import { toast } from '../components/toast.js';

const ui = { view: 'year', week: 0, sel: '' };
const tint = h => `--hc:${h.color};--hc-on:${readableOn(h.color)}`;

function row(h, s, today) {
  const done = habitDone(s, h.id, today), sched = isScheduled(h, today), streak = habitStreak(s, h);
  const dots = rangeDates(addDays(today, -6), today).map(d => `<i class="${habitDone(s, h.id, d) ? 'on' : isScheduled(h, d) ? '' : 'off'}"></i>`).join('');
  return `<div class="row habit-row" style="${tint(h)}">
    <a class="habit-glyph" href="#/habits/${esc(h.id)}" aria-label="Open ${esc(h.name)}">${esc(h.icon || '✦')}</a>
    <a class="row-main" href="#/habits/${esc(h.id)}"><span class="row-title trunc">${esc(h.name)}</span><span class="row-sub"><span class="dots7" aria-hidden="true">${dots}</span>${streak ? `${streak} day${streak === 1 ? '' : 's'}` : esc(h.schedule)}</span></a>
    ${sched ? `<button type="button" class="check-wrap" data-action="habit-toggle" data-id="${esc(h.id)}" data-date="${today}" role="checkbox" aria-checked="${done}" aria-label="Check in ${esc(h.name)} for today"><span class="check ${done ? 'is-on' : ''}">${icon('check', { size: 16 })}</span></button>` : '<span class="t-small faint">Rest day</span>'}
    <span class="row-end">${kebab('habit', h.id)}</span></div>`;
}

function renderList() {
  const s = State.get(), today = todayStr();
  const due = habitsDueOn(s, today), done = due.filter(h => habitDone(s, h.id, today)).length;
  const head = pageHead({ title: 'Habits', sub: due.length ? `${done} of ${due.length} done today` : s.habits.length ? 'A rest day. Nothing scheduled.' : 'Small things, done daily', actions: addBtn('habit', 'Habit') });
  if (!s.habits.length) return `${head}<div class="card" style="--i:1">${emptyState({ icon: 'repeat', title: 'Start with one habit', text: 'Pick something small enough to do every day. Each habit gets its own colour and history.', action: addBtn('habit', 'Add a habit') })}</div>`;
  return `${head}<div class="stack-lg">${due.length ? `<div class="day-progress" style="--i:1"><div class="bar bar-lg"><span style="--w:${(done / due.length) * 100}%"></span></div></div>` : ''}
    <section class="card card-flush" style="--i:2"><div class="list">${s.habits.map(h => row(h, s, today)).join('')}</div></section></div>`;
}

function renderDetail(id) {
  const s = State.get(), h = s.habits.find(x => x.id === id);
  if (!h) return `<div class="card">${emptyState({ icon: 'repeat', title: 'Habit not found', text: 'It may have been deleted.', action: '<a class="btn btn-primary" href="#/habits">Back to habits</a>' })}</div>`;
  const today = todayStr(), st = habitStats(s, h), sel = ui.sel || today, selSt = habitDayState(s, h, sel, st.start);
  const msg = { done: 'Done', missed: 'Missed', off: 'Not scheduled', pre: 'Before you started tracking', future: 'Upcoming', open: 'Not done yet' }[selSt];
  const stat = (v, l) => `<div class="stat"><b class="t-num">${v}</b><span>${l}</span></div>`;
  return `<header class="page-head" style="${tint(h)}"><div class="row-gap" style="flex-wrap:nowrap;min-width:0"><span class="habit-glyph is-lg">${esc(h.icon || '✦')}</span><div style="min-width:0"><p class="eyebrow">${esc(h.schedule)} · ${esc(h.target)} ${esc(h.unit)}</p><h1 class="t-title trunc">${esc(h.name)}</h1></div></div><div class="page-head-actions">${addBtn('habit', 'Edit', { cls: 'btn btn-sm', id: h.id })}</div></header>
    <div class="stack-lg" style="${tint(h)}">
      <section style="--i:1"><div class="between"><div class="seg" role="group" aria-label="Heatmap range"><button type="button" class="${ui.view === 'week' ? 'is-on' : ''}" aria-pressed="${ui.view === 'week'}" data-action="hm-view" data-view="week">Week</button><button type="button" class="${ui.view === 'year' ? 'is-on' : ''}" aria-pressed="${ui.view === 'year'}" data-action="hm-view" data-view="year">Year</button></div>
        ${ui.view === 'week' ? `<div class="row-gap" style="gap:2px"><button class="icon-btn" type="button" data-action="hm-week" data-dir="-1" aria-label="Previous week">${icon('chevron-left', { size: 18 })}</button><button class="icon-btn" type="button" data-action="hm-week" data-dir="1" aria-label="Next week" ${ui.week >= 0 ? 'disabled' : ''}>${icon('chevron-right', { size: 18 })}</button></div>` : ''}</div>
        <div class="mt-4">${ui.view === 'year' ? habitYear(s, h, st.start, sel) : habitWeek(s, h, st.start, sel, ui.week)}</div>
        <div class="between mt-3"><div class="hm-sel" aria-live="polite"><b>${esc(fmtDate(sel, { weekday: 'short', day: 'numeric', month: 'short' }))}</b><span>${msg}${sel === today ? ' · today' : ''}</span></div>
          ${selSt !== 'future' && selSt !== 'off' ? `<button type="button" class="btn btn-sm ${selSt === 'done' ? '' : 'btn-primary'}" data-action="habit-toggle" data-id="${esc(h.id)}" data-date="${sel}">${selSt === 'done' ? 'Undo' : 'Mark done'}</button>` : ''}</div>
        <div class="mt-3">${heatLegend()}</div></section>
      <section class="stat-grid" style="--i:2">${stat(st.current, 'Current streak')}${stat(st.longest, 'Longest streak')}${stat(st.totalDone, 'Days completed')}${stat(st.scheduled ? `${Math.round(st.pct)}%` : '–', 'Completion')}${stat(st.weekScheduled ? `${st.weekDone}/${st.weekScheduled}` : '–', 'This week')}</section>
      ${st.recent.length ? `<section style="--i:3"><h2 class="t-micro" style="margin:0 4px 10px">Recent activity</h2><div class="card card-flush"><div class="list">${st.recent.map(d => `<div class="row"><span class="row-main"><span class="row-title">${esc(fmtDate(d, { weekday: 'long', day: 'numeric', month: 'short' }))}</span></span><span class="row-end t-small">${esc(relDay(d, { done: true }))}</span></div>`).join('')}</div></div></section>` : ''}</div>`;
}

registerActions({
  'habit-toggle'(el) { const r = toggleHabit(el.dataset.id, el.dataset.date || todayStr()); if (r.done && r.xp) toast('Habit checked in', { xp: r.xp }); },
  'hm-day'(el) { ui.sel = el.dataset.date; emit('view:refresh'); },
  'hm-view'(el) { ui.view = el.dataset.view; emit('view:refresh'); },
  'hm-week'(el) { ui.week = Math.min(0, ui.week + Number(el.dataset.dir)); ui.sel = ''; emit('view:refresh'); }
});

export const route = {
  id: 'habits',
  render: parts => (parts[0] ? renderDetail(parts[0]) : renderList()),
  mount(view, parts) { if (parts[0]) { const sc = view.querySelector('[data-scrollend]'); if (sc && !sc.dataset.done) { sc.scrollLeft = sc.scrollWidth; sc.dataset.done = '1'; } } },
  title: parts => (parts[0] ? find('habit', parts[0])?.name || 'Habit' : 'Habits')
};
