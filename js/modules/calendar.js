/* Calendar: one month grid showing dated records across modules. Tapping a day lists what belongs to it. */
import * as State from '../core/state.js';
import { registerActions, emit } from '../core/events.js';
import { esc, todayStr, monthKey, addMonths, fmtDate, isDateStr, relDay, fmtTime } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { monthGrid } from '../components/calendar.js';
import { pageHead, addBtn } from '../components/ui.js';

const ui = { month: monthKey(todayStr()), day: todayStr() };

function itemsByDate() {
  const s = State.get(), map = {};
  const add = (date, item) => { if (isDateStr(date)) (map[date] ||= []).push(item); };
  s.tasks.forEach(t => add(t.due, { icon: 'check-square', title: t.title, sub: t.done ? 'Task · done' : 'Task due', href: '#/plan', done: t.done, time: t.dueTime }));
  s.academicItems.forEach(x => add(x.due, { icon: 'graduation', title: x.title, sub: `${x.subject} · ${x.status === 'Completed' ? 'completed' : 'due'}`, href: '#/academics', done: x.status === 'Completed', time: x.dueTime }));
  s.goals.forEach(g => add(g.targetDate, { icon: 'target', title: g.title, sub: 'Goal target date', href: '#/goals', done: g.status === 'Completed' }));
  s.workoutLogs.forEach(w => add(w.date, { icon: 'dumbbell', title: w.exercise, sub: 'Workout', href: '#/fitness', done: true }));
  s.savingsGoals.forEach(g => add(g.targetDate, { icon: 'piggy', title: g.name, sub: 'Savings target date', href: '#/finance', done: g.savedAmount >= g.targetAmount }));
  Object.values(map).forEach(list => list.sort((a, b) => (a.time ? 1 : 0) - (b.time ? 1 : 0) || String(a.time || '').localeCompare(String(b.time || ''))));   // all-day first, then by time
  return map;
}

function render() {
  const map = itemsByDate();
  const dots = Object.fromEntries(Object.entries(map).map(([d, l]) => [d, l.length]));
  const list = map[ui.day] || [];
  const monthCount = Object.entries(map).filter(([d]) => monthKey(d) === ui.month).reduce((a, [, l]) => a + l.length, 0);
  return `${pageHead({ title: 'Calendar', sub: `${monthCount} dated ${monthCount === 1 ? 'item' : 'items'} this month`, actions: addBtn('task', 'Task', { prefill: { due: ui.day } }) })}
    <div class="grid split" style="align-items:start"><section class="card card-pad" style="--i:1">${monthGrid({ month: ui.month, selected: ui.day, dots, prefix: 'cal', mondayFirst: State.get().settings.weekStartsMonday })}
        <div class="row-gap mt-3"><button class="link-btn" type="button" data-action="cal-today">Jump to today</button></div></section>
      <section class="card card-flush" style="--i:2"><div class="panel-head"><div><h2>${esc(fmtDate(ui.day, { weekday: 'long', day: 'numeric', month: 'long' }))}</h2><p>${esc(relDay(ui.day, { done: true }))}</p></div></div>
        ${list.length ? `<div class="list">${list.map(i => `<a class="row" href="${i.href}"><span class="row-lead">${icon(i.icon, { size: 18 })}</span><span class="row-main"><span class="row-title trunc ${i.done ? 'faint' : ''}">${esc(i.title)}</span><span class="row-sub">${esc(i.sub)}</span></span>${i.time ? `<span class="row-end"><span class="badge badge-accent no-dot t-num">${esc(fmtTime(i.time))}</span></span>` : ''}</a>`).join('')}</div>` : `<div class="empty" style="padding:24px"><p>Nothing on this day.</p>${addBtn('task', 'Add a task', { cls: 'btn btn-sm', prefill: { due: ui.day } })}</div>`}</section></div>`;
}

registerActions({
  'cal-day'(el) { ui.day = el.dataset.date; emit('view:refresh'); },
  'cal-month'(el) { ui.month = addMonths(ui.month, Number(el.dataset.dir)); emit('view:refresh'); },
  'cal-today'() { ui.month = monthKey(todayStr()); ui.day = todayStr(); emit('view:refresh'); }
});
export const route = { id: 'calendar', render };
