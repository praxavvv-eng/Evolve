/* Plan: tasks. Open / Today / Upcoming / Done views, grouped by due date, with repeat support. */
import * as State from '../core/state.js';
import { registerActions, registerChange } from '../core/events.js';
import { toggleTask } from '../core/records.js';
import { esc, todayStr, relDay, isDateStr, fmtTime } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { pageHead, emptyState, addBtn, kebab, badge } from '../components/ui.js';
import { selectHTML } from '../components/dropdown.js';
import { toast } from '../components/toast.js';
import { OPTIONS } from '../core/schemas.js';
import { emit } from '../core/events.js';

const ui = { filter: 'open', area: 'All' };
const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 };
const sortTasks = (a, b) => (a.due || '9999').localeCompare(b.due || '9999') || (a.dueTime || '').localeCompare(b.dueTime || '') || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.title.localeCompare(b.title);

/** One task row; shared with Home. */
export function taskRow(t, { menu = true } = {}) {
  const today = todayStr(), overdue = !t.done && isDateStr(t.due) && t.due < today;
  const meta = [t.category, t.due ? `${relDay(t.due, { done: t.done })}${t.dueTime ? `, ${fmtTime(t.dueTime)}` : ''}` : 'No date', t.repeat && t.repeat !== 'None' ? `Repeats ${t.repeat.toLowerCase()}` : ''].filter(Boolean).join(' · ');
  return `<div class="row task-row ${t.done ? 'is-done' : ''}">
    <button type="button" class="check-wrap" data-action="task-toggle" data-id="${esc(t.id)}" role="checkbox" aria-checked="${t.done}" aria-label="${t.done ? 'Mark as not done' : 'Mark as done'}: ${esc(t.title)}"><span class="check ${t.done ? 'is-on' : ''}">${icon('check', { size: 16 })}</span></button>
    <button type="button" class="row-main" data-action="form" data-type="task" data-id="${esc(t.id)}">
      <span class="row-title trunc">${esc(t.title)}</span>
      <span class="row-sub trunc ${overdue ? 'neg' : ''}">${esc(meta)}</span></button>
    <span class="row-end">${t.priority === 'High' && !t.done ? badge('High', 'neg') : ''}${menu ? kebab('task', t.id) : ''}</span></div>`;
}

function group(title, list, tone = '') {
  if (!list.length) return '';
  return `<section class="card card-flush" style="--i:2"><div class="panel-head"><h2 class="${tone}">${title}</h2><span class="t-small t-num">${list.length}</span></div><div class="list">${list.map(t => taskRow(t)).join('')}</div></section>`;
}

function render() {
  const s = State.get(), today = todayStr();
  let tasks = s.tasks.filter(t => ui.area === 'All' || t.category === ui.area);
  const open = tasks.filter(t => !t.done), done = tasks.filter(t => t.done).sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));
  const todayList = open.filter(t => t.due === today).sort(sortTasks);
  const overdue = open.filter(t => isDateStr(t.due) && t.due < today).sort(sortTasks);
  const upcoming = open.filter(t => isDateStr(t.due) && t.due > today).sort(sortTasks);
  const nodate = open.filter(t => !isDateStr(t.due)).sort(sortTasks);
  const counts = { open: open.length, today: todayList.length + overdue.length, upcoming: upcoming.length, done: done.length };
  const chip = (id, label) => `<button type="button" class="chip ${ui.filter === id ? 'is-on' : ''}" data-action="plan-filter" data-filter="${id}" aria-pressed="${ui.filter === id}">${label}<span class="count">${counts[id]}</span></button>`;

  let body;
  if (!s.tasks.length) body = `<div class="card" style="--i:2">${emptyState({ icon: 'check-square', title: 'Nothing planned yet', text: 'Add the first thing you want to get done today.', action: addBtn('task', 'Add a task') })}</div>`;
  else if (ui.filter === 'done') body = done.length ? `<section class="card card-flush"><div class="list">${done.slice(0, 80).map(t => taskRow(t)).join('')}</div></section>` : `<div class="card">${emptyState({ icon: 'check', title: 'No completed tasks', text: 'Finished tasks show up here.' })}</div>`;
  else if (ui.filter === 'today') body = (overdue.length || todayList.length) ? group('Overdue', overdue, 'neg') + group('Today', todayList) : `<div class="card">${emptyState({ icon: 'sparkles', title: 'A clear day', text: 'Nothing is due today or overdue.', action: addBtn('task', 'Add a task') })}</div>`;
  else if (ui.filter === 'upcoming') body = upcoming.length ? group('Upcoming', upcoming) : `<div class="card">${emptyState({ icon: 'calendar', title: 'Nothing scheduled ahead', text: 'Tasks with a future due date appear here.' })}</div>`;
  else body = (open.length ? group('Overdue', overdue, 'neg') + group('Today', todayList) + group('Upcoming', upcoming) + group('No date', nodate) : `<div class="card">${emptyState({ icon: 'sparkles', title: 'All caught up', text: 'No open tasks. Add something new or enjoy the quiet.', action: addBtn('task', 'Add a task') })}</div>`);

  return `${pageHead({ title: 'Plan', sub: s.tasks.length ? `${counts.open} open · ${s.tasks.filter(t => t.done).length} done` : 'Tasks and priorities', actions: addBtn('task', 'Task') })}
    <div class="stack-lg">
      <div class="chips" style="--i:1" role="group" aria-label="Filter tasks">${chip('open', 'Open')}${chip('today', 'Today')}${chip('upcoming', 'Upcoming')}${chip('done', 'Done')}</div>
      <div class="between" style="--i:1"><span class="t-small">Area</span>${selectHTML({ value: ui.area, options: ['All', ...OPTIONS.taskCategory], label: 'Filter by area', compact: true, dataChange: 'plan-area' })}</div>
      <div class="stack">${body}</div></div>`;
}

registerActions({
  'plan-filter'(el) { ui.filter = el.dataset.filter; emit('view:refresh'); },
  'task-toggle'(el) {
    const r = toggleTask(el.dataset.id);
    if (r.done) toast(r.next ? 'Done. Next one scheduled' : 'Task done', { xp: r.xp, action: { label: 'Undo', onClick: () => toggleTask(el.dataset.id) } });
  }
});
registerChange({ 'plan-area'(el) { ui.area = el.value; emit('view:refresh'); } });

export const route = { id: 'plan', render };
