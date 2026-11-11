/* Habits: calm daily check-ins, 7-day strips, and a per-habit detail with a 5-week consistency grid. */
import * as State from '../core/state.js';
import { registerActions } from '../core/events.js';
import { toggleHabit, find } from '../core/records.js';
import { esc, todayStr, addDays, weekdayInitial, parseDate, plural, rangeDates } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { habitStreak, habitDone, isScheduled, habitsDueOn } from '../core/stats.js';
import { pageHead, emptyState, addBtn, kebab } from '../components/ui.js';
import { ring } from '../components/charts.js';
import { toast } from '../components/toast.js';

function bestStreakOf(state, h) {
  const days = Object.keys(state.habitLogs).filter(d => state.habitLogs[d][h.id]).sort();
  let best = 0, run = 0, prev = '';
  days.forEach(d => { run = prev && isConsecutive(h, prev, d) ? run + 1 : 1; best = Math.max(best, run); prev = d; });
  return best;
}
function isConsecutive(h, a, b) { let c = addDays(a, 1); while (c < b) { if (isScheduled(h, c)) return false; c = addDays(c, 1); } return true; }

function weekStrip(h, state) {
  const today = todayStr();
  return `<div class="week-strip" role="group" aria-label="Last 7 days for ${esc(h.name)}">${rangeDates(addDays(today, -6), today).map(d => {
    const on = habitDone(state, h.id, d), sched = isScheduled(h, d);
    return `<button type="button" class="wd ${on ? 'is-on' : ''} ${d === today ? 'is-today' : ''} ${sched ? '' : 'is-off'}" data-action="habit-toggle" data-id="${esc(h.id)}" data-date="${d}" aria-pressed="${on}" aria-label="${esc(h.name)} on ${d}${on ? ', done' : ''}"><small>${weekdayInitial(d)}</small><i>${on ? icon('check', { size: 12 }) : ''}</i></button>`;
  }).join('')}</div>`;
}

function habitCard(h, state) {
  const today = todayStr(), done = habitDone(state, h.id, today), sched = isScheduled(h, today), streak = habitStreak(state, h);
  return `<article class="card habit-card ${done ? 'is-done' : ''}">
    <div class="habit-top">
      <a class="habit-glyph" href="#/habits/${esc(h.id)}" aria-label="Open ${esc(h.name)}">${esc(h.icon || '✦')}</a>
      <a class="row-main" href="#/habits/${esc(h.id)}"><span class="row-title trunc">${esc(h.name)}</span><span class="row-sub">${esc(h.schedule)} · ${esc(h.target)} ${esc(h.unit)}${streak ? ` · ${icon('flame', { size: 12 })} ${streak}` : ''}</span></a>
      ${sched ? `<button type="button" class="check-wrap" data-action="habit-toggle" data-id="${esc(h.id)}" data-date="${today}" role="checkbox" aria-checked="${done}" aria-label="Check in ${esc(h.name)} for today"><span class="check ${done ? 'is-on' : ''}">${icon('check', { size: 16 })}</span></button>` : `<span class="badge no-dot">Rest day</span>`}
      ${kebab('habit', h.id)}
    </div>${weekStrip(h, state)}</article>`;
}

function renderList() {
  const s = State.get(), today = todayStr();
  const due = habitsDueOn(s, today), done = due.filter(h => habitDone(s, h.id, today)).length;
  const best = Math.max(0, ...s.habits.map(h => habitStreak(s, h)));
  if (!s.habits.length) return `${pageHead({ title: 'Habits', sub: 'Small things, done daily', actions: addBtn('habit', 'Habit') })}<div class="card" style="--i:1">${emptyState({ icon: 'repeat', title: 'Start with one habit', text: 'Pick something small enough to do every day. You can add more later.', action: addBtn('habit', 'Add a habit') })}</div>`;
  return `${pageHead({ title: 'Habits', sub: due.length ? `${done} of ${due.length} done today` : 'A rest day. Nothing scheduled.', actions: addBtn('habit', 'Habit') })}
    <div class="stack-lg">
      <section class="card card-pad habit-summary" style="--i:1">${ring({ value: due.length ? (done / due.length) * 100 : 0, size: 96, stroke: 9, label: due.length ? `${done}/${due.length}` : '–', sub: 'today', title: `${done} of ${due.length} habits done today` })}
        <div class="stack" style="gap:6px;min-width:0"><p class="t-h2">${due.length && done === due.length ? 'Everything checked in' : done ? 'Good progress' : 'A fresh day'}</p><p class="t-small">${best ? `Longest current streak: ${plural(best, 'day')}` : 'Your streaks will appear as you check in.'}</p></div></section>
      <div class="stack" style="--i:2">${s.habits.map(h => habitCard(h, s)).join('')}</div></div>`;
}

function renderDetail(id) {
  const s = State.get(), h = s.habits.find(x => x.id === id);
  if (!h) return `<div class="card">${emptyState({ icon: 'repeat', title: 'Habit not found', text: 'It may have been deleted.', action: '<a class="btn btn-primary" href="#/habits">Back to habits</a>' })}</div>`;
  const today = todayStr();
  const start = addDays(today, -34 - ((parseDate(today).getDay() + 6) % 7)), cells = rangeDates(start, today);
  const last30 = rangeDates(addDays(today, -29), today).filter(d => isScheduled(h, d) && (!h.createdAt || d >= h.createdAt.slice(0, 10)));
  const doneN = last30.filter(d => habitDone(s, h.id, d)).length;
  const total = Object.values(s.habitLogs).filter(l => l[h.id]).length;
  return `<header class="page-head"><div style="min-width:0"><p class="eyebrow">${esc(h.schedule)} · ${esc(h.target)} ${esc(h.unit)}</p><h1 class="t-title trunc">${esc(h.icon || '✦')} ${esc(h.name)}</h1></div><div class="page-head-actions">${addBtn('habit', 'Edit', { cls: 'btn btn-sm', id: h.id })}</div></header>
    <div class="stack-lg">
      <div class="trio" style="--i:1"><div class="card card-pad stat"><b>${habitStreak(s, h)}</b><span>Current streak</span></div><div class="card card-pad stat"><b>${bestStreakOf(s, h)}</b><span>Best streak</span></div><div class="card card-pad stat"><b>${total}</b><span>Total check-ins</span></div></div>
      <section class="card card-pad" style="--i:2"><div class="between"><h2 class="t-h2">Last five weeks</h2><span class="t-small">${last30.length ? `${doneN} of ${last30.length} scheduled days (30d)` : 'Not enough days yet'}</span></div>
        <div class="heat mt-4" role="group" aria-label="Check-in history"><div class="heat-head">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => `<span>${d}</span>`).join('')}</div><div class="heat-grid">${cells.map(d => { const on = habitDone(s, h.id, d); return `<button type="button" class="heat-cell ${on ? 'is-on' : ''} ${isScheduled(h, d) ? '' : 'is-off'} ${d === today ? 'is-today' : ''}" data-action="habit-toggle" data-id="${esc(h.id)}" data-date="${d}" aria-pressed="${on}" aria-label="${d}${on ? ', done' : ''}" title="${d}"></button>`; }).join('')}</div></div>
        <p class="t-small mt-3">Tap a day to correct it. Only today's check-in earns XP.</p></section></div>`;
}

registerActions({
  'habit-toggle'(el) {
    const r = toggleHabit(el.dataset.id, el.dataset.date || todayStr());
    if (r.done && r.xp) toast('Habit checked in', { xp: r.xp });
  }
});

export const route = {
  id: 'habits',
  render: parts => (parts[0] ? renderDetail(parts[0]) : renderList()),
  title: parts => (parts[0] ? find('habit', parts[0])?.name || 'Habit' : 'Habits')
};
