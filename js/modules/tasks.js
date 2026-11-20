/* Planner: tasks. Compact rows, grouped by due date, with filters, sorting, a quick-add field and a detail sheet. */
import * as State from '../core/state.js';
import { registerActions, registerChange, emit } from '../core/events.js';
import { toggleTask } from '../core/records.js';
import { todaysTasks } from '../core/stats.js';
import { esc, todayStr, relDay, isDateStr, fmtTime, fmtDate, plural } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { pageHead, emptyState, addBtn } from '../components/ui.js';
import { selectHTML } from '../components/dropdown.js';
import { openSheet } from '../components/modal.js';
import { openForm, deleteWithUndo } from '../components/forms.js';
import { saveRecord } from '../core/records.js';
import { toast } from '../components/toast.js';
import { OPTIONS } from '../core/schemas.js';

const ui = { filter: 'open', area: 'All', priority: 'All', sort: 'due' };
const RANK = { High: 0, Medium: 1, Low: 2 };
const SORTS = [{ value: 'due', label: 'Due date' }, { value: 'priority', label: 'Priority' }, { value: 'newest', label: 'Newest first' }, { value: 'alpha', label: 'A to Z' }];
const byDue = (a, b) => (a.due || '9999').localeCompare(b.due || '9999') || (a.dueTime || '').localeCompare(b.dueTime || '') || RANK[a.priority] - RANK[b.priority] || a.title.localeCompare(b.title);
const SORT_FN = {
  due: byDue,
  priority: (a, b) => RANK[a.priority] - RANK[b.priority] || byDue(a, b),
  newest: (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '') || byDue(a, b),
  alpha: (a, b) => a.title.localeCompare(b.title)
};
const pcls = p => (p === 'High' ? 'p-high' : p === 'Low' ? 'p-low' : 'p-med');

const dueText = t => (t.due ? `${relDay(t.due, { done: t.done })}${t.dueTime ? `, ${fmtTime(t.dueTime)}` : ''}` : 'No date');

/** One task row; shared with Home. */
export function taskRow(t, { compact = false } = {}) {
  const today = todayStr(), overdue = !t.done && isDateStr(t.due) && t.due < today;
  const meta = [dueText(t), compact ? '' : t.category, t.repeat && t.repeat !== 'None' ? t.repeat.toLowerCase() : ''].filter(Boolean).join(' · ');
  return `<div class="row task-row ${t.done ? 'is-done' : ''}" data-id="${esc(t.id)}">
    <button type="button" class="check-wrap" data-action="task-toggle" data-id="${esc(t.id)}" role="checkbox" aria-checked="${t.done}" aria-label="${t.done ? 'Mark as not done' : 'Mark as done'}: ${esc(t.title)}"><span class="check ${pcls(t.priority)} ${t.done ? 'is-on' : ''}">${icon('check', { size: 15 })}</span></button>
    <button type="button" class="row-main" data-action="task-open" data-id="${esc(t.id)}">
      <span class="row-title trunc">${esc(t.title)}</span>
      <span class="row-sub trunc ${overdue ? 'neg' : ''}">${esc(meta)}</span></button>
    ${!t.done && t.priority === 'High' ? `<span class="pdot p-high" title="High priority" aria-label="High priority"></span>` : ''}</div>`;
}

function group(title, list, tone = '') {
  if (!list.length) return '';
  return `<section><div class="grp-head"><h2 class="${tone}">${title}</h2><span class="t-num">${list.length}</span></div><div class="card card-flush"><div class="list">${list.map(t => taskRow(t)).join('')}</div></div></section>`;
}

function render() {
  const s = State.get(), today = todayStr();
  const sorter = SORT_FN[ui.sort] || byDue;
  let tasks = s.tasks.filter(t => (ui.area === 'All' || t.category === ui.area) && (ui.priority === 'All' || t.priority === ui.priority));
  const open = tasks.filter(t => !t.done), done = tasks.filter(t => t.done).sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));
  const todayList = open.filter(t => t.due === today).sort(sorter);
  const overdue = open.filter(t => isDateStr(t.due) && t.due < today).sort(byDue);
  const upcoming = open.filter(t => isDateStr(t.due) && t.due > today).sort(sorter);
  const nodate = open.filter(t => !isDateStr(t.due)).sort(sorter);
  const counts = { open: open.length, today: todayList.length, upcoming: upcoming.length, overdue: overdue.length, done: done.length };
  if (ui.filter === 'overdue' && !counts.overdue) ui.filter = 'open';
  const chip = (id, label) => `<button type="button" class="chip ${ui.filter === id ? 'is-on' : ''}" data-action="plan-filter" data-filter="${id}" aria-pressed="${ui.filter === id}">${label}<span class="count">${counts[id]}</span></button>`;

  let body;
  if (!s.tasks.length) body = `<div class="card">${emptyState({ icon: 'check-square', title: 'Nothing planned yet', text: 'Type above to add your first task.' })}</div>`;
  else if (ui.filter === 'done') body = done.length ? `<div class="card card-flush"><div class="list">${done.slice(0, 80).map(t => taskRow(t)).join('')}</div></div>` : `<div class="card">${emptyState({ icon: 'check', title: 'No completed tasks', text: 'Finished tasks show up here.' })}</div>`;
  else if (ui.filter === 'today') body = todayList.length || overdue.length ? group('Overdue', overdue, 'neg') + group('Today', todayList) : `<div class="card">${emptyState({ icon: 'sparkles', title: 'A clear day', text: 'Nothing is due today.' })}</div>`;
  else if (ui.filter === 'upcoming') body = upcoming.length ? group('Upcoming', upcoming) : `<div class="card">${emptyState({ icon: 'calendar', title: 'Nothing scheduled ahead', text: 'Tasks with a future date appear here.' })}</div>`;
  else if (ui.filter === 'overdue') body = group('Overdue', overdue, 'neg');
  else body = open.length ? group('Overdue', overdue, 'neg') + group('Today', todayList) + group('Upcoming', upcoming) + group('No date', nodate) : `<div class="card">${emptyState({ icon: 'sparkles', title: 'All caught up', text: 'No open tasks. Enjoy the quiet.' })}</div>`;

  const dayTasks = todaysTasks(s), n = dayTasks.filter(t => t.done).length;
  const filtered = ui.area !== 'All' || ui.priority !== 'All';
  return `${pageHead({ title: 'Tasks', sub: s.tasks.length ? `${plural(counts.open, 'open task')}${n || dayTasks.length ? ` · ${n}/${dayTasks.length} done today` : ''}` : 'Tasks and priorities', actions: addBtn('task', 'Task') })}
    <div class="stack-lg">
      <div class="quick-task" style="--i:1"><span class="qt-ico">${icon('plus', { size: 18 })}</span><input type="text" data-quick-task data-keep placeholder="Add a task for today…" maxlength="150" enterkeyhint="done" autocomplete="off" aria-label="Quick add a task"><button type="button" class="btn btn-soft btn-sm" data-action="task-quick">Add</button></div>
      <div class="stack" style="--i:2">
        <div class="chips" role="group" aria-label="Filter tasks">${chip('open', 'Open')}${chip('today', 'Today')}${chip('upcoming', 'Upcoming')}${counts.overdue ? chip('overdue', 'Overdue') : ''}${chip('done', 'Done')}</div>
        <div class="filter-row">
          ${selectHTML({ value: ui.area, options: [{ value: 'All', label: 'All areas' }, ...OPTIONS.taskCategory], label: 'Filter by area', compact: true, dataChange: 'plan-area' })}
          ${selectHTML({ value: ui.priority, options: [{ value: 'All', label: 'Any priority' }, ...OPTIONS.priority.map(p => ({ value: p, label: `${p} priority` }))], label: 'Filter by priority', compact: true, dataChange: 'plan-priority' })}
          <span class="spacer"></span>
          ${selectHTML({ value: ui.sort, options: SORTS, label: 'Sort tasks', compact: true, dataChange: 'plan-sort' })}
        </div>
        ${filtered ? `<button type="button" class="link-btn" data-action="plan-reset">Clear filters</button>` : ''}
      </div>
      <div class="stack-lg" style="--i:3">${body}</div></div>`;
}

/* ---------- detail sheet ---------- */
export function openTaskDetail(id) {
  const t = State.get().tasks.find(x => x.id === id); if (!t) return;
  const today = todayStr(), overdue = !t.done && isDateStr(t.due) && t.due < today;
  const api = openSheet({
    title: 'Task',
    body: `<div class="td">
      <div class="td-badges">${t.done ? '<span class="badge badge-pos no-dot">Completed</span>' : overdue ? '<span class="badge badge-neg no-dot">Overdue</span>' : ''}<span class="badge ${t.priority === 'High' ? 'badge-neg' : t.priority === 'Low' ? 'badge-info' : 'badge-warn'}">${esc(t.priority)} priority</span><span class="badge no-dot">${esc(t.category)}</span></div>
      <h3 class="td-title ${t.done ? 'is-done' : ''}">${esc(t.title)}</h3>
      <dl class="td-meta">
        <div><dt>${icon('calendar', { size: 16 })} Due</dt><dd class="${overdue ? 'neg' : ''}">${t.due ? `${esc(fmtDate(t.due, { weekday: 'short', day: 'numeric', month: 'long' }))}${t.dueTime ? ` · ${esc(fmtTime(t.dueTime))}` : ''}` : 'No date'}</dd></div>
        ${t.repeat && t.repeat !== 'None' ? `<div><dt>${icon('repeat', { size: 16 })} Repeats</dt><dd>${esc(t.repeat)}</dd></div>` : ''}
        ${t.done && t.completedAt ? `<div><dt>${icon('check', { size: 16 })} Completed</dt><dd>${esc(fmtDate(t.completedAt.slice(0, 10)))}</dd></div>` : ''}
      </dl>
      ${t.notes ? `<p class="td-notes">${esc(t.notes)}</p>` : ''}</div>`,
    footer: `<button class="btn btn-ghost btn-danger" type="button" data-td-del aria-label="Delete task">${icon('trash', { size: 18 })}</button><button class="btn" type="button" data-td-edit>${icon('edit', { size: 16 })} Edit</button><button class="btn btn-primary" type="button" data-td-toggle>${t.done ? 'Reopen' : 'Mark done'}</button>`,
    onMount(root) {
      root.querySelector('[data-td-edit]').addEventListener('click', () => { api.close(); openForm('task', { id }); });
      root.querySelector('[data-td-del]').addEventListener('click', () => deleteWithUndo('task', id, { onDone: () => api.close() }));
      root.querySelector('[data-td-toggle]').addEventListener('click', () => { const r = toggleTask(id); api.close(); if (r.done) toast('Task done', { xp: r.xp, action: { label: 'Undo', onClick: () => toggleTask(id) } }); });
    }
  });
}

registerActions({
  'plan-filter'(el) { ui.filter = el.dataset.filter; emit('view:refresh'); },
  'plan-reset'() { ui.area = 'All'; ui.priority = 'All'; emit('view:refresh'); },
  'task-open'(el) { openTaskDetail(el.dataset.id); },
  'task-toggle'(el) {
    const id = el.dataset.id, row = el.closest('.row');
    const finish = () => { const r = toggleTask(id); if (r.done) toast(r.next ? 'Done. Next one scheduled' : 'Task done', { xp: r.xp, action: { label: 'Undo', onClick: () => toggleTask(id) } }); };
    const hides = ['open', 'today', 'upcoming', 'overdue'].includes(ui.filter) && !State.get().tasks.find(t => t.id === id)?.done && document.getElementById('view')?.contains(row) && row.closest('.card-flush')?.closest('#view') && location.hash.startsWith('#/plan');
    if (hides && document.documentElement.dataset.motion !== 'reduce') { row.querySelector('.check')?.classList.add('is-on'); row.classList.add('is-leaving'); setTimeout(finish, 210); } else finish();
  },
  'task-quick'(el) {
    const input = el.closest('.quick-task')?.querySelector('input'); if (!input) return;
    const title = input.value.trim();
    if (!title) { input.focus(); return; }
    const res = saveRecord('task', { title, due: todayStr(), priority: 'Medium', category: ui.area !== 'All' ? ui.area : 'Personal', repeat: 'None' }, '');
    if (res.ok) { input.value = ''; toast('Task added', { xp: res.xp }); input.focus(); } else toast(Object.values(res.errors)[0] || 'Could not add that task.', { type: 'error' });
  }
});
registerChange({
  'plan-area'(el) { ui.area = el.value; emit('view:refresh'); },
  'plan-priority'(el) { ui.priority = el.value; emit('view:refresh'); },
  'plan-sort'(el) { ui.sort = el.value; emit('view:refresh'); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target instanceof Element && e.target.matches('[data-quick-task]')) { e.preventDefault(); e.target.closest('.quick-task')?.querySelector('[data-action="task-quick"]')?.click(); }
});

export const route = { id: 'plan', render };
