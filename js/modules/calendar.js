/* Planner calendar: Month, Week and Day views. Timed entries (events, and tasks or academic items that have a time)
 * sit in their real hour slots. Date-only entries stay "all day": no start times are ever invented. */
import * as State from '../core/state.js';
import { registerActions, emit } from '../core/events.js';
import { esc, todayStr, monthKey, addMonths, addDays, fmtDate, fmtTime, isDateStr, parseDate, dateStr, weekdayShort } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { monthGrid } from '../components/calendar.js';
import { pageHead, addBtn } from '../components/ui.js';
import { openForm } from '../components/forms.js';

const ui = { view: 'month', day: todayStr(), month: monthKey(todayStr()) };
const HOUR = 56, MIN = 24 * 60;
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const hourLabel = h => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;
const mondayOf = d => { const x = parseDate(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return dateStr(x); };

/** Everything dated, grouped by date. */
function collect() {
  const s = State.get(), map = {};
  const add = (date, item) => { if (isDateStr(date)) (map[date] ||= []).push(item); };
  s.events.forEach(e => add(e.date, { kind: 'event', id: e.id, type: 'event', title: e.title, time: e.startTime, end: e.endTime, sub: e.endTime ? `${fmtTime(e.startTime)} – ${fmtTime(e.endTime)}` : fmtTime(e.startTime), done: false }));
  s.tasks.forEach(t => add(t.due, { kind: 'task', id: t.id, type: 'task', title: t.title, time: t.dueTime, sub: t.done ? 'Task · done' : 'Task', done: t.done }));
  s.academicItems.forEach(x => add(x.due, { kind: 'academic', id: x.id, type: 'academic', title: x.title, time: x.dueTime, sub: `${x.subject} · ${x.status === 'Completed' ? 'completed' : 'due'}`, done: x.status === 'Completed' }));
  s.goals.forEach(g => add(g.targetDate, { kind: 'goal', id: g.id, type: 'goal', title: g.title, time: '', sub: 'Goal target date', done: g.status === 'Completed' }));
  s.workoutLogs.forEach(w => add(w.date, { kind: 'workout', id: w.id, type: 'workout', title: w.exercise, time: '', sub: 'Workout', done: true }));
  Object.values(map).forEach(l => l.sort((a, b) => (a.time ? 1 : 0) - (b.time ? 1 : 0) || String(a.time).localeCompare(String(b.time))));
  return map;
}
const itemBtn = (i, cls = '') => `<button type="button" class="${cls}" data-action="cal-open" data-type="${i.type}" data-id="${esc(i.id)}">`;

/** Greedy column layout so overlapping entries sit side by side. */
function lay(items) {
  const timed = items.filter(i => i.time).map(i => ({ ...i, a: toMin(i.time), b: Math.max(toMin(i.time) + 30, i.end ? toMin(i.end) : 0) })).sort((x, y) => x.a - y.a || x.b - y.b);
  const out = []; let cluster = [], clusterEnd = -1;
  const flush = () => { const cols = Math.max(1, ...cluster.map(c => c.col + 1)); cluster.forEach(c => out.push({ ...c, cols })); cluster = []; };
  timed.forEach(it => {
    if (it.a >= clusterEnd && cluster.length) flush();
    const used = cluster.filter(c => c.b > it.a).map(c => c.col); let col = 0; while (used.includes(col)) col++;
    cluster.push({ ...it, col }); clusterEnd = Math.max(clusterEnd, it.b);
  });
  if (cluster.length) flush();
  return out;
}
const block = i => `<button type="button" class="tl-ev k-${i.kind} ${i.done ? 'is-done' : ''}" data-action="cal-open" data-type="${i.type}" data-id="${esc(i.id)}" style="top:${(i.a / 60) * HOUR}px;height:${Math.max(26, ((i.b - i.a) / 60) * HOUR - 2)}px;left:calc(${(i.col / i.cols) * 100}% + 2px);width:calc(${100 / i.cols}% - 4px)"><b class="trunc">${esc(i.title)}</b><small class="trunc">${esc(i.sub || fmtTime(i.time))}</small></button>`;
const hoursBg = `<div class="tl-lines" aria-hidden="true">${Array.from({ length: 24 }, (_, h) => `<i style="top:${h * HOUR}px"></i>`).join('')}</div>`;
const nowLine = date => (date === todayStr() ? `<i class="tl-now" style="top:${(new Date().getHours() * 60 + new Date().getMinutes()) / 60 * HOUR}px" aria-hidden="true"></i>` : '');
const gutter = () => `<div class="tl-gutter" aria-hidden="true">${Array.from({ length: 24 }, (_, h) => `<span style="top:${h * HOUR}px">${h === 0 ? '' : hourLabel(h)}</span>`).join('')}</div>`;

function dayView(map) {
  const items = map[ui.day] || [], allDay = items.filter(i => !i.time);
  return `${allDay.length ? `<div class="allday"><p class="t-micro">All day</p>${allDay.map(i => `${itemBtn(i, `ad-item k-${i.kind} ${i.done ? 'is-done' : ''}`)}<b class="trunc">${esc(i.title)}</b><small>${esc(i.sub)}</small></button>`).join('')}</div>` : ''}
    <div class="tl-scroll" data-tl="${ui.day}"><div class="tl" style="height:${24 * HOUR}px">${gutter()}<div class="tl-body">${hoursBg}${lay(items).map(block).join('')}${nowLine(ui.day)}</div></div></div>
    ${!items.some(i => i.time) ? '<p class="t-small" style="text-align:center;margin-top:10px">No timed entries. Add an event to place it on the timeline.</p>' : ''}`;
}

function weekView(map) {
  const mon = mondayOf(ui.day), days = Array.from({ length: 7 }, (_, i) => addDays(mon, i)), today = todayStr();
  return `<div class="wk-scroll" data-tl="${mon}"><div class="wk" style="--hh:${HOUR}px">
    <div class="wk-head"><span></span>${days.map(d => { const n = (map[d] || []).filter(i => !i.time).length; return `<button type="button" class="wk-dh ${d === today ? 'is-today' : ''} ${d === ui.day ? 'is-sel' : ''}" data-action="cal-day" data-date="${d}" data-goto="day"><small>${weekdayShort(d)}</small><b>${parseDate(d).getDate()}</b>${n ? `<i title="${n} all-day">${n}</i>` : ''}</button>`; }).join('')}</div>
    <div class="wk-body" style="height:${24 * HOUR}px">${gutter()}${days.map(d => `<div class="wk-col ${d === today ? 'is-today' : ''}">${hoursBg}${lay(map[d] || []).map(block).join('')}${nowLine(d)}</div>`).join('')}</div></div></div>`;
}

function monthView(map) {
  const dots = Object.fromEntries(Object.entries(map).map(([d, l]) => [d, l.length]));
  const list = map[ui.day] || [];
  return `${monthGrid({ month: ui.month, selected: ui.day, dots, prefix: 'cal', mondayFirst: State.get().settings.weekStartsMonday, head: false })}
    <div class="day-list mt-4"><div class="between"><h2 class="t-h2">${esc(fmtDate(ui.day, { weekday: 'long', day: 'numeric', month: 'long' }))}</h2><button class="link-btn" type="button" data-action="cal-view" data-view="day">Open day ${icon('chevron-right', { size: 14 })}</button></div>
    ${list.length ? `<div class="list mt-2">${list.map(i => `${itemBtn(i, 'row')}<span class="row-main"><span class="row-title trunc ${i.done ? 'faint' : ''}">${esc(i.title)}</span><span class="row-sub">${esc(i.sub)}</span></span>${i.time ? `<span class="row-end"><span class="badge badge-accent no-dot t-num">${esc(fmtTime(i.time))}</span></span>` : ''}</button>`).join('')}</div>` : '<p class="t-body mt-2">Nothing on this day.</p>'}</div>`;
}

function render() {
  const map = collect();
  const title = ui.view === 'month' ? new Date(`${ui.month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : ui.view === 'week' ? `${fmtDate(mondayOf(ui.day), { day: 'numeric', month: 'short' })} – ${fmtDate(addDays(mondayOf(ui.day), 6), { day: 'numeric', month: 'short' })}` : fmtDate(ui.day, { weekday: 'long', day: 'numeric', month: 'long' });
  return `${pageHead({ title: 'Calendar', actions: addBtn('event', 'Event', { prefill: { date: ui.day } }) })}
    <div class="stack" style="gap:14px"><div class="seg" role="group" aria-label="Calendar view" style="--i:1">${['month', 'week', 'day'].map(v => `<button type="button" class="${ui.view === v ? 'is-on' : ''}" aria-pressed="${ui.view === v}" data-action="cal-view" data-view="${v}">${v[0].toUpperCase() + v.slice(1)}</button>`).join('')}</div>
      <div class="cal-nav" style="--i:1"><button class="icon-btn is-solid" type="button" data-action="cal-step" data-dir="-1" aria-label="Previous">${icon('chevron-left', { size: 20 })}</button><button class="cal-title" type="button" data-action="cal-today" title="Jump to today">${esc(title)}</button><button class="icon-btn is-solid" type="button" data-action="cal-step" data-dir="1" aria-label="Next">${icon('chevron-right', { size: 20 })}</button></div>
      <div class="cal-surface" style="--i:2">${ui.view === 'month' ? monthView(map) : ui.view === 'week' ? weekView(map) : dayView(map)}</div></div>`;
}

registerActions({
  'cal-view'(el) { ui.view = el.dataset.view; ui.month = monthKey(ui.day); emit('view:refresh'); },
  'cal-day'(el) { ui.day = el.dataset.date; ui.month = monthKey(ui.day); if (el.dataset.goto) ui.view = el.dataset.goto; emit('view:refresh'); },
  'cal-month'(el) { ui.month = addMonths(ui.month, Number(el.dataset.dir)); emit('view:refresh'); },
  'cal-step'(el) {
    const d = Number(el.dataset.dir);
    if (ui.view === 'month') { ui.month = addMonths(ui.month, d); ui.day = `${ui.month}-01`; } else { ui.day = addDays(ui.day, d * (ui.view === 'week' ? 7 : 1)); ui.month = monthKey(ui.day); }
    emit('view:refresh');
  },
  'cal-today'() { ui.day = todayStr(); ui.month = monthKey(ui.day); emit('view:refresh'); },
  'cal-open'(el) { const { type, id } = el.dataset; if (type === 'workout') location.hash = '#/fitness'; else openForm(type, { id }); }
});

let lastKey = '';
export const route = {
  id: 'calendar',
  render,
  /* Start the timeline near the first entry (or the current hour) once per day/week shown. */
  mount(view) {
    const sc = view.querySelector('[data-tl]'); if (!sc) { lastKey = ''; return; }
    const key = `${ui.view}:${sc.dataset.tl}`; if (key === lastKey) return; lastKey = key;
    const first = [...sc.querySelectorAll('.tl-ev')].map(e => parseFloat(e.style.top)).sort((a, b) => a - b)[0];
    const target = first !== undefined ? first - HOUR : (sc.querySelector('.tl-now') ? parseFloat(sc.querySelector('.tl-now').style.top) - HOUR * 2 : 7 * HOUR);
    sc.scrollTop = Math.max(0, target);
  }
};
