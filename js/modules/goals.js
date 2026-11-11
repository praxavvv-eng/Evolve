/* Goals: longer-term aims with optional milestones. With milestones, progress follows what is checked. */
import * as State from '../core/state.js';
import { registerActions, emit } from '../core/events.js';
import { toggleMilestone } from '../core/records.js';
import { esc, fmtDate, relDay, todayStr } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { pageHead, emptyState, addBtn, kebab, badge } from '../components/ui.js';
import { progressBar } from '../components/charts.js';
import { OPTIONS } from '../core/schemas.js';

const ui = { status: 'In progress' };

function card(g) {
  const done = g.status === 'Completed';
  return `<article class="card card-pad goal-card ${done ? 'is-done' : ''}"><div class="between"><div style="min-width:0"><p class="t-micro">${esc(g.area)}</p><h3 class="t-h2">${esc(g.title)}</h3></div>${kebab('goal', g.id)}</div>
    <div class="between mt-3"><span class="t-small">${g.targetDate ? esc(g.targetDate < todayStr() && !done ? `${relDay(g.targetDate)}` : `By ${fmtDate(g.targetDate, { day: 'numeric', month: 'short', year: 'numeric' })}`) : 'No target date'}</span><b class="t-num">${g.progress}%</b></div><div class="mt-2">${progressBar(g.progress, done ? 'is-pos' : '')}</div>
    ${g.milestones?.length ? `<ul class="milestones mt-3">${g.milestones.map((m, i) => `<li><button type="button" class="ms ${g.milestoneDone[i] ? 'is-on' : ''}" data-action="goal-ms" data-id="${esc(g.id)}" data-i="${i}" role="checkbox" aria-checked="${Boolean(g.milestoneDone[i])}"><span class="check ${g.milestoneDone[i] ? 'is-on' : ''}">${icon('check', { size: 14 })}</span><span>${esc(m)}</span></button></li>`).join('')}</ul>` : ''}
    ${done ? `<div class="mt-3">${badge('Completed', 'pos')}</div>` : ''}</article>`;
}

function render() {
  const s = State.get(), goals = s.goals;
  const head = pageHead({ title: 'Goals', sub: goals.length ? `${goals.filter(g => g.status !== 'Completed').length} active` : 'Where you are heading', actions: addBtn('goal', 'Goal') });
  if (!goals.length) return `${head}<div class="card" style="--i:1">${emptyState({ icon: 'target', title: 'Set a goal worth working towards', text: 'Break it into milestones and watch progress follow your check-offs.', action: addBtn('goal', 'Add a goal') })}</div>`;
  const count = st => goals.filter(g => g.status === st).length;
  const list = goals.filter(g => g.status === ui.status);
  return `${head}<div class="stack-lg"><div class="chips" style="--i:1" role="group" aria-label="Filter goals">${OPTIONS.goalStatus.map(st => `<button type="button" class="chip ${ui.status === st ? 'is-on' : ''}" aria-pressed="${ui.status === st}" data-action="goal-filter" data-status="${st}">${st}<span class="count">${count(st)}</span></button>`).join('')}</div>
    ${list.length ? `<div class="grid auto-grid" style="--i:2">${list.map(card).join('')}</div>` : `<div class="card">${emptyState({ icon: 'target', title: `No goals ${ui.status.toLowerCase()}`, text: 'Nothing here right now.' })}</div>`}</div>`;
}

registerActions({
  'goal-filter'(el) { ui.status = el.dataset.status; emit('view:refresh'); },
  'goal-ms'(el) { toggleMilestone(el.dataset.id, Number(el.dataset.i)); }
});
export const route = { id: 'goals', render };
