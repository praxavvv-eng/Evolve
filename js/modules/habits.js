/* Habits: a daily checklist with a combined consistency graph, and a detail screen per habit with its own coloured
 * yearly contribution graph, weekly history and statistics. Every habit's history is separate: habitLogs[date][habitId].
 * All streak rules live in core/stats.js (rest days, unscheduled days, weekly targets, future dates). */
import * as State from '../core/state.js';
import { registerActions, emit } from '../core/events.js';
import { toggleHabit, toggleHabitRest, find } from '../core/records.js';
import { esc, todayStr, addDays, fmtDate, rangeDates, readableOn, relDay, plural } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { habitStreakInfo, habitsDueOn, habitDone, habitStats, habitDayState, habitMode, habitPerWeek, isRest, isScheduled } from '../core/stats.js';
import { pageHead, emptyState, addBtn } from '../components/ui.js';
import { habitYear, habitWeek, heatLegend, habitOverview } from '../components/heatmap.js';
import { bars } from '../components/charts.js';
import { openMenu } from '../components/dropdown.js';
import { openForm, deleteWithUndo } from '../components/forms.js';
import { toast } from '../components/toast.js';

const ui = { view: 'year', week: 0, sel: '', year: 0 };
const tint = h => `--hc:${h.color};--hc-on:${readableOn(h.color)}`;
const monday = () => State.get().settings.weekStartsMonday !== false;
const streakLabel = (s, h) => { const i = habitStreakInfo(s, h); return i.value ? `${i.value}-${i.unit} streak` : ''; };

function row(h, s, today) {
  const done = habitDone(s, h.id, today), rest = isRest(h, today), weekly = habitMode(h) === 'weekly';
  const st = habitStats(s, h), start = st.start;
  const dots = rangeDates(addDays(today, -6), today).map(d => `<i class="${habitDayState(s, h, d, start) === 'done' ? 'on' : habitDayState(s, h, d, start) === 'rest' ? 'rest' : habitDayState(s, h, d, start) === 'missed' ? 'miss' : 'off'}"></i>`).join('');
  const streak = streakLabel(s, h);
  const sub = weekly ? `${st.weekDone}/${st.weekScheduled} this week` : (streak || (h.schedule === 'Custom' ? 'Custom days' : h.schedule));
  const offToday = !weekly && !isScheduled(h, today);
  return `<div class="row habit-row ${offToday ? 'is-off' : ''}" style="${tint(h)}" data-id="${esc(h.id)}">
    <a class="habit-glyph" href="#/habits/${esc(h.id)}" aria-label="Open ${esc(h.name)}">${esc(h.icon || '✦')}</a>
    <a class="row-main" href="#/habits/${esc(h.id)}"><span class="row-title trunc">${esc(h.name)}</span><span class="row-sub"><span class="dots7" aria-hidden="true">${dots}</span><span class="trunc">${esc(rest ? 'Resting today' : offToday ? 'Not today' : sub)}</span></span></a>
    ${rest ? `<button type="button" class="rest-chip" data-action="habit-rest" data-id="${esc(h.id)}" data-date="${today}" aria-label="Remove rest day for ${esc(h.name)}">${icon('rest', { size: 15 })}Rest</button>`
      : `<button type="button" class="check-wrap" data-action="habit-toggle" data-id="${esc(h.id)}" data-date="${today}" role="checkbox" aria-checked="${done}" aria-label="Check in ${esc(h.name)} for today"><span class="check ${done ? 'is-on' : ''}">${icon('check', { size: 16 })}</span></button>`}
    <button type="button" class="icon-btn" data-action="habit-menu" data-id="${esc(h.id)}" aria-haspopup="menu" aria-label="More actions for ${esc(h.name)}">${icon('more', { size: 20 })}</button></div>`;
}

function renderList() {
  const s = State.get(), today = todayStr();
  const due = habitsDueOn(s, today), done = due.filter(h => habitDone(s, h.id, today)).length;
  const head = pageHead({ title: 'Habits', sub: due.length ? `${done} of ${due.length} done today` : s.habits.length ? 'A rest day. Nothing scheduled.' : 'Small things, done daily', actions: addBtn('habit', 'Habit') });
  if (!s.habits.length) return `${head}<div class="card" style="--i:1">${emptyState({ icon: 'repeat', title: 'Start with one habit', text: 'Pick something small enough to do every day. Each habit gets its own colour and history.', action: addBtn('habit', 'Add a habit') })}</div>`;
  const dueIds = new Set(due.map(h => h.id));
  const ordered = [...s.habits.filter(h => dueIds.has(h.id)), ...s.habits.filter(h => !dueIds.has(h.id))];
  const best = s.habits.map(h => ({ h, i: habitStreakInfo(s, h) })).filter(x => x.i.value).sort((a, b) => (b.i.unit === 'week' ? b.i.value * 7 : b.i.value) - (a.i.unit === 'week' ? a.i.value * 7 : a.i.value))[0];
  return `${head}<div class="stack-lg">
    ${due.length ? `<div class="day-progress" style="--i:1"><div class="bar bar-lg"><span style="--w:${(done / due.length) * 100}%"></span></div></div>` : ''}
    <section class="card card-pad overview" style="--i:2"><div class="between"><div><h2 class="t-h3">Consistency</h2><p class="t-small faint">All habits, last 18 weeks</p></div>${best ? `<span class="badge badge-accent no-dot">${icon('flame', { size: 13 })} ${best.i.value}-${best.i.unit} · ${esc(best.h.name)}</span>` : ''}</div>
      <div class="mt-3">${habitOverview(s, 18, monday())}</div>
      <div class="ov-legend" aria-hidden="true"><span>Less</span><i class="ov-0"></i><i class="ov-1"></i><i class="ov-2"></i><i class="ov-3"></i><i class="ov-4"></i><span>More</span></div></section>
    <section class="card card-flush" style="--i:3"><div class="list">${ordered.map(h => row(h, s, today)).join('')}</div></section></div>`;
}

function weeklyHistory(s, h, start, monday) {
  const today = todayStr(), items = [];
  const weekMon = d => { const x = new Date(`${d}T00:00:00`); x.setDate(x.getDate() - (monday ? (x.getDay() + 6) % 7 : x.getDay())); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  const thisWeek = weekMon(today);
  for (let i = 7; i >= 0; i--) {
    const w = addDays(thisWeek, -i * 7), days = rangeDates(w, addDays(w, 6)).filter(d => d <= today);
    const n = days.filter(d => habitDone(s, h.id, d)).length;
    items.push({ label: i === 0 ? 'Now' : fmtDate(w, { day: 'numeric', month: 'short' }).replace(' ', '\u00a0'), value: n, today: i === 0, on: n > 0 });
  }
  const max = habitMode(h) === 'weekly' ? Math.max(habitPerWeek(h), ...items.map(i => i.value)) : 7;
  return bars({ items, height: 96, max, showValues: true, ariaLabel: `${h.name}: days completed per week` });
}

function renderDetail(id) {
  const s = State.get(), h = s.habits.find(x => x.id === id);
  if (!h) return `<div class="card">${emptyState({ icon: 'repeat', title: 'Habit not found', text: 'It may have been deleted.', action: '<a class="btn btn-primary" href="#/habits">Back to habits</a>' })}</div>`;
  const today = todayStr(), st = habitStats(s, h), sel = ui.sel || today, selSt = habitDayState(s, h, sel, st.start), weekly = habitMode(h) === 'weekly';
  const year = ui.year || new Date().getFullYear(), firstYear = Number(st.start.slice(0, 4)), thisYear = new Date().getFullYear();
  const msg = { done: 'Done', missed: 'Missed', rest: 'Rest day', off: 'Not scheduled', pre: 'Before you started tracking', future: 'Upcoming', open: 'Not done yet' }[selSt];
  const stat = (v, l) => `<div class="stat"><b class="t-num">${v}</b><span>${l}</span></div>`;
  const unit = st.unit === 'week' ? 'weeks' : 'days';
  const canMark = selSt !== 'future', canRest = !weekly && canMark && selSt !== 'done';
  const sched = weekly ? `${habitPerWeek(h)} days a week` : h.schedule === 'Custom' ? (h.days?.length ? h.days.slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ') : 'Every day') : h.schedule;
  return `<header class="page-head habit-hero" style="${tint(h)}"><div class="row-gap" style="flex-wrap:nowrap;min-width:0"><span class="habit-glyph is-lg">${esc(h.icon || '✦')}</span><div style="min-width:0"><p class="eyebrow">${esc(sched)}</p><h1 class="t-title trunc">${esc(h.name)}</h1></div></div><div class="page-head-actions">${addBtn('habit', 'Edit', { cls: 'btn btn-sm', id: h.id })}</div></header>
    ${h.description ? `<p class="t-body" style="margin:-8px 0 18px">${esc(h.description)}</p>` : ''}
    <div class="stack-lg" style="${tint(h)}">
      <section class="stat-grid card card-pad" style="--i:1">${stat(`${st.current}<small> ${st.current === 1 ? st.unit : unit}</small>`, 'Current streak')}${stat(`${st.longest}<small> ${st.longest === 1 ? st.unit : unit}</small>`, 'Longest streak')}${stat(st.totalDone, 'Days completed')}${stat(st.scheduled ? `${Math.round(st.pct)}%` : '–', 'Completion')}</section>
      <section style="--i:2"><div class="between"><div class="seg" role="group" aria-label="Graph range"><button type="button" class="${ui.view === 'year' ? 'is-on' : ''}" aria-pressed="${ui.view === 'year'}" data-action="hm-view" data-view="year">Year</button><button type="button" class="${ui.view === 'week' ? 'is-on' : ''}" aria-pressed="${ui.view === 'week'}" data-action="hm-view" data-view="week">Week</button></div>
        ${ui.view === 'week' ? `<div class="row-gap" style="gap:2px"><button class="icon-btn" type="button" data-action="hm-week" data-dir="-1" aria-label="Previous week">${icon('chevron-left', { size: 18 })}</button><button class="icon-btn" type="button" data-action="hm-week" data-dir="1" aria-label="Next week" ${ui.week >= 0 ? 'disabled' : ''}>${icon('chevron-right', { size: 18 })}</button></div>`
          : `<div class="row-gap" style="gap:2px"><button class="icon-btn" type="button" data-action="hm-year" data-dir="-1" aria-label="Previous year" ${year <= firstYear ? 'disabled' : ''}>${icon('chevron-left', { size: 18 })}</button><b class="t-num year-label">${year}</b><button class="icon-btn" type="button" data-action="hm-year" data-dir="1" aria-label="Next year" ${year >= thisYear ? 'disabled' : ''}>${icon('chevron-right', { size: 18 })}</button></div>`}</div>
        <div class="card card-pad mt-3">${ui.view === 'year' ? habitYear(s, h, st.start, sel, year, monday()) : habitWeek(s, h, st.start, sel, ui.week, monday())}
          <div class="mt-3">${heatLegend()}</div></div>
        <div class="card card-pad mt-3 sel-panel"><div class="hm-sel" aria-live="polite"><b>${esc(fmtDate(sel, { weekday: 'long', day: 'numeric', month: 'short' }))}</b><span>${msg}${sel === today ? ' · today' : ''}</span></div>
          <div class="sel-actions">${canRest ? `<button type="button" class="btn btn-sm" data-action="habit-rest" data-id="${esc(h.id)}" data-date="${sel}">${icon('rest', { size: 15 })}${selSt === 'rest' ? 'Remove rest' : 'Rest day'}</button>` : selSt === 'rest' ? `<button type="button" class="btn btn-sm" data-action="habit-rest" data-id="${esc(h.id)}" data-date="${sel}">Remove rest</button>` : ''}
          ${canMark && selSt !== 'rest' ? `<button type="button" class="btn btn-sm ${selSt === 'done' ? '' : 'btn-primary'}" data-action="habit-toggle" data-id="${esc(h.id)}" data-date="${sel}">${selSt === 'done' ? 'Undo' : 'Mark done'}</button>` : ''}</div></div></section>
      <section style="--i:3"><div class="sec-head tight"><div><h2>Weekly history</h2><p>${weekly ? `Goal: ${habitPerWeek(h)} days` : 'Days completed per week'} · this week ${st.weekDone}/${st.weekScheduled || (weekly ? habitPerWeek(h) : 0)}</p></div></div><div class="card card-pad">${weeklyHistory(s, h, st.start, monday())}</div></section>
      ${st.recent.length ? `<section style="--i:4"><div class="sec-head tight"><h2>Recent check-ins</h2>${st.restDays ? `<span class="t-small faint">${plural(st.restDays, 'rest day')}</span>` : ''}</div><div class="card card-flush"><div class="list">${st.recent.map(d => `<div class="row"><span class="row-main"><span class="row-title">${esc(fmtDate(d, { weekday: 'long', day: 'numeric', month: 'short' }))}</span></span><span class="row-end t-small">${esc(relDay(d, { done: true }))}</span></div>`).join('')}</div></div></section>` : ''}</div>`;
}

registerActions({
  'habit-toggle'(el) {
    const r = toggleHabit(el.dataset.id, el.dataset.date || todayStr());
    if (r.done && r.xp) toast('Habit checked in', { xp: r.xp });
  },
  'habit-rest'(el) { const on = toggleHabitRest(el.dataset.id, el.dataset.date || todayStr()); toast(on ? 'Rest day set. Your streak is safe.' : 'Rest day removed'); },
  'habit-menu'(el) {
    const id = el.dataset.id, h = State.get().habits.find(x => x.id === id), today = todayStr(); if (!h) return;
    const items = [{ label: 'Edit', icon: 'edit', onClick: () => openForm('habit', { id }) }];
    if (habitMode(h) !== 'weekly') items.push({ label: isRest(h, today) ? 'Remove rest today' : 'Rest today', icon: 'rest', onClick: () => emit('habit:rest', { id, date: today }) });
    items.push('sep', { label: 'Delete', icon: 'trash', danger: true, onClick: () => deleteWithUndo('habit', id, { onDone: () => emit('state:changed') }) });
    openMenu(el, items);
  },
  'hm-day'(el) { ui.sel = el.dataset.date; emit('view:refresh'); },
  'hm-view'(el) { ui.view = el.dataset.view; emit('view:refresh'); },
  'hm-week'(el) { ui.week = Math.min(0, ui.week + Number(el.dataset.dir)); ui.sel = ''; emit('view:refresh'); },
  'hm-year'(el) { const y = (ui.year || new Date().getFullYear()) + Number(el.dataset.dir); ui.year = Math.min(new Date().getFullYear(), y); ui.sel = ''; const sc = document.querySelector('[data-scrollend]'); if (sc) delete sc.dataset.done; emit('view:refresh'); }
});
import { on } from '../core/events.js';
on('habit:rest', ({ id, date }) => { const r = toggleHabitRest(id, date); toast(r ? 'Rest day set. Your streak is safe.' : 'Rest day removed'); });

export const route = {
  id: 'habits',
  render: parts => (parts[0] ? renderDetail(parts[0]) : renderList()),
  /* Scroll the graph to the current month the first time it is shown (and to the start for past years). */
  mount(view) {
    view.querySelectorAll('[data-scrollend]').forEach(sc => {
      if (sc.dataset.done) return; sc.dataset.done = '1';
      const yr = Number(sc.dataset.year);
      const t = sc.querySelector('.is-today');
      if (t && (!yr || yr === new Date().getFullYear())) sc.scrollLeft = Math.max(0, t.offsetLeft - sc.clientWidth + 90);   // show the current month near the right edge
      else if (sc.classList.contains('hm-overview')) sc.scrollLeft = sc.scrollWidth; else sc.scrollLeft = 0;
    });
  },
  title: parts => (parts[0] ? find('habit', parts[0])?.name || 'Habit' : 'Habits')
};
