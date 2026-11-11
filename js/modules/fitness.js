/* Fitness: overview, history, exercise library + detail, plans (templates) with a session logger, and body measurements.
 * Workout performance and body measurements are separate on purpose: lifting numbers never imply body change. */
import * as State from '../core/state.js';
import { registerActions, emit } from '../core/events.js';
import { saveRecord, find } from '../core/records.js';
import { fmtDM, esc, todayStr, addDays, parseDate, dateStr, fmtDate, fmtNum, num, sum, groupBy, plural, monthKey, addMonths, weekdayInitial, rangeDates, relDay } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { exerciseSummaries, entryVolume, personalRecord, norm } from '../core/stats.js';
import { bars, lineChart } from '../components/charts.js';
import { monthGrid } from '../components/calendar.js';
import { pageHead, emptyState, addBtn, kebab, sectionHead } from '../components/ui.js';
import { openSheet } from '../components/modal.js';
import { toast } from '../components/toast.js';

const ui = { tab: 'overview', month: monthKey(todayStr()), day: todayStr() };
const TABS = [['overview', 'Overview'], ['history', 'History'], ['exercises', 'Exercises'], ['plans', 'Plans'], ['body', 'Body']];

const weekStart = d => { const dt = parseDate(d); dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7)); return dateStr(dt); };
const vol = list => sum(list, entryVolume);
const setLine = x => `${num(x.sets)}×${num(x.reps)}${num(x.weight) ? ` · ${fmtNum(x.weight, 1)} kg` : ''}`;

function entryRow(x) {
  return `<div class="row"><button type="button" class="row-main" data-action="form" data-type="workout" data-id="${esc(x.id)}"><span class="row-title trunc">${esc(x.exercise)}</span><span class="row-sub trunc">${esc(setLine(x))}${num(x.duration) ? ` · ${fmtNum(x.duration)} min` : ''}${entryVolume(x) ? ` · ${fmtNum(entryVolume(x))} kg volume` : ''}</span></button><span class="row-end">${kebab('workout', x.id)}</span></div>`;
}

/* ---------------- tabs ---------------- */
function overview(s) {
  const today = todayStr(), ws = weekStart(today), week = rangeDates(ws, addDays(ws, 6));
  const inWeek = s.workoutLogs.filter(x => x.date >= ws && x.date <= addDays(ws, 6));
  const days = new Set(inWeek.map(x => x.date)).size;
  const byDay = groupBy(s.workoutLogs, x => x.date);
  const weekly = Array.from({ length: 8 }, (_, i) => { const start = addDays(ws, (i - 7) * 7); const list = s.workoutLogs.filter(x => x.date >= start && x.date <= addDays(start, 6)); return { start, v: vol(list), n: list.length }; });
  const weeksWithData = weekly.filter(w => w.n > 0).length;
  const prs = exerciseSummaries(s).slice(0, 5);
  const dots = Object.fromEntries(Object.entries(byDay).map(([d, l]) => [d, l.length]));
  const dayList = (byDay[ui.day] || []);
  return `<div class="stack-lg">
    <section class="card card-pad fit-hero" style="--i:2"><div class="fit-week">${week.map(d => { const on = (byDay[d] || []).length > 0; return `<div class="fw ${on ? 'is-on' : ''} ${d === today ? 'is-today' : ''}"><i>${on ? icon('check', { size: 14 }) : ''}</i><small>${weekdayInitial(d)}</small></div>`; }).join('')}</div>
      <div class="trio mt-4"><div class="stat"><b>${days}</b><span>Training days</span></div><div class="stat"><b>${fmtNum(sum(inWeek, x => num(x.sets)))}</b><span>Sets</span></div><div class="stat"><b>${fmtNum(vol(inWeek))}</b><span>kg volume</span></div></div></section>
    <section class="card card-pad" style="--i:3"><div class="between"><div><h2 class="t-h2">Weekly training volume</h2><p class="t-small">Sets × reps × weight, last 8 weeks</p></div></div>
      ${weeksWithData >= 2 ? `<div class="mt-4">${bars({ items: weekly.map((w, i) => ({ label: fmtDM(w.start), value: w.v, today: i === 7, title: `Week of ${w.start}: ${fmtNum(w.v)} kg` })), height: 120, ariaLabel: 'Weekly training volume' })}</div>` : '<p class="t-body mt-3">The chart appears after workouts in at least two different weeks. Weighted sets count towards volume.</p>'}</section>
    <section class="card card-flush" style="--i:4"><div class="panel-head"><div><h2>Personal records</h2><p>Heaviest set per exercise</p></div><button class="link-btn" type="button" data-action="fit-tab" data-tab="exercises">All ${icon('chevron-right', { size: 14 })}</button></div>
      ${prs.length ? `<div class="list">${prs.map(e => { const pr = personalRecord(e); return `<a class="row" href="#/fitness/exercise/${encodeURIComponent(e.key)}"><span class="row-lead">${icon('award', { size: 18 })}</span><span class="row-main"><span class="row-title trunc">${esc(e.name)}</span><span class="row-sub">${esc(fmtDate(pr.date))} · ${esc(pr.detail)}</span></span><span class="row-end"><b class="t-num">${fmtNum(pr.value, 1)} <small class="muted">${pr.unit}</small></b></span></a>`; }).join('')}</div>` : '<p class="t-body" style="padding:0 var(--card-p) var(--card-p)">Records appear as you log exercises.</p>'}</section>
    <section class="card card-pad" style="--i:5"><h2 class="t-h2 mb-2">Training calendar</h2><div class="mt-3">${monthGrid({ month: ui.month, selected: ui.day, dots, prefix: 'fit' })}</div>
      <div class="mt-4"><p class="t-micro">${esc(relDay(ui.day, { done: true }))} · ${esc(fmtDate(ui.day))}</p>${dayList.length ? `<div class="list mt-2" style="margin-inline:calc(var(--card-p)*-1)">${dayList.map(entryRow).join('')}</div>` : `<div class="row-gap mt-2"><span class="t-body">No workout logged.</span>${addBtn('workout', 'Log for this day', { cls: 'link-btn', prefill: { date: ui.day } })}</div>`}</div></section></div>`;
}

function history(s) {
  const byDate = groupBy(s.workoutLogs, x => x.date), dates = Object.keys(byDate).sort().reverse();
  if (!dates.length) return `<div class="card" style="--i:2">${emptyState({ icon: 'dumbbell', title: 'No workouts yet', text: 'Log your first exercise and your history builds here.', action: addBtn('workout', 'Log a workout') })}</div>`;
  return `<div class="stack" style="--i:2">${dates.slice(0, 60).map(d => { const list = byDate[d];
    return `<section class="card card-flush"><div class="day-head"><span>${esc(fmtDate(d, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }))}</span><span class="t-small t-num">${plural(list.length, 'exercise')}${vol(list) ? ` · ${fmtNum(vol(list))} kg` : ''}${sum(list, x => num(x.duration)) ? ` · ${fmtNum(sum(list, x => num(x.duration)))} min` : ''}</span></div><div class="list">${list.map(entryRow).join('')}</div></section>`; }).join('')}</div>`;
}

function exercises(s) {
  const list = exerciseSummaries(s);
  if (!list.length) return `<div class="card" style="--i:2">${emptyState({ icon: 'list', title: 'Your exercise library is empty', text: 'It is built from the exercises you log, so every entry is real. Log one to start.', action: addBtn('workout', 'Log a workout') })}</div>`;
  return `<section class="card card-flush" style="--i:2"><div class="list">${list.map(e => { const pr = personalRecord(e); return `<a class="row" href="#/fitness/exercise/${encodeURIComponent(e.key)}"><span class="row-lead">${icon('dumbbell', { size: 18 })}</span><span class="row-main"><span class="row-title trunc">${esc(e.name)}</span><span class="row-sub">${plural(e.count, 'entry', 'entries')} · last ${esc(fmtDate(e.last.date))}</span></span><span class="row-end"><span class="t-small t-num">Best ${fmtNum(pr.value, 1)} ${pr.unit}</span>${icon('chevron-right', { size: 16 })}</span></a>`; }).join('')}</div></section>`;
}

function plans(s) {
  const head = sectionHead('Workout plans', 'Reusable exercise lists', addBtn('workoutTemplate', 'Plan', { cls: 'btn btn-sm' }));
  if (!s.workoutTemplates.length) return `<div style="--i:2">${head}<div class="card">${emptyState({ icon: 'list', title: 'No plans yet', text: 'Save a routine like Push day, then log a whole session from it in one go.', action: addBtn('workoutTemplate', 'Create a plan') })}</div></div>`;
  return `<div style="--i:2">${head}<div class="grid auto-grid">${s.workoutTemplates.map(t => `<article class="card card-pad plan-card"><div class="between"><div style="min-width:0"><p class="t-micro">${esc(t.focus)}</p><h3 class="t-h2 trunc">${esc(t.name)}</h3></div>${kebab('workoutTemplate', t.id)}</div>
    <ul class="plan-ex">${t.exercises.slice(0, 5).map(x => `<li>${esc(x)}</li>`).join('')}${t.exercises.length > 5 ? `<li class="faint">+${t.exercises.length - 5} more</li>` : ''}</ul>
    <button class="btn btn-soft btn-block" type="button" data-action="fit-session" data-id="${esc(t.id)}">${icon('play', { size: 16 })} Log a session</button></article>`).join('')}</div></div>`;
}

function body(s) {
  const list = s.bodyMetrics.slice().sort((a, b) => b.date.localeCompare(a.date));
  const weights = list.filter(x => x.weight > 0).slice().reverse();
  const latest = list[0];
  return `<div class="stack-lg" style="--i:2"><p class="note-card">${icon('info', { size: 18 })}<span>Body measurements are recorded separately from training. Evolve never estimates body changes from your workouts.</span></p>
    ${latest ? `<section class="card card-pad"><div class="between"><h2 class="t-h2">Latest</h2><span class="t-small">${esc(fmtDate(latest.date))}</span></div><div class="trio mt-4" style="grid-template-columns:repeat(2,1fr)">${[['weight', 'Weight', 'kg'], ['waist', 'Waist', 'cm'], ['chest', 'Chest', 'cm'], ['arms', 'Arm', 'cm']].filter(([k]) => latest[k] > 0).map(([k, l, u]) => `<div class="stat"><b>${fmtNum(latest[k], 1)} <small class="muted">${u}</small></b><span>${l}</span></div>`).join('')}</div></section>` : ''}
    ${weights.length >= 2 ? `<section class="card card-pad"><h2 class="t-h2">Weight over time</h2><div class="mt-4">${lineChart({ points: weights.map(x => ({ x: fmtDate(x.date), y: x.weight })), fmt: v => fmtNum(v, 1), ariaLabel: 'Body weight over time' })}</div></section>` : ''}
    <section>${sectionHead('Measurements', '', addBtn('bodyMetric', 'Measure', { cls: 'btn btn-sm' }))}
      ${list.length ? `<div class="card card-flush"><div class="list">${list.map(x => `<div class="row"><button type="button" class="row-main" data-action="form" data-type="bodyMetric" data-id="${esc(x.id)}"><span class="row-title">${esc(fmtDate(x.date, { day: 'numeric', month: 'short', year: 'numeric' }))}</span><span class="row-sub trunc">${[['weight', 'kg'], ['waist', 'cm waist'], ['chest', 'cm chest'], ['arms', 'cm arm']].filter(([k]) => x[k] > 0).map(([k, u]) => `${fmtNum(x[k], 1)} ${u}`).join(' · ')}</span></button><span class="row-end">${kebab('bodyMetric', x.id)}</span></div>`).join('')}</div></div>` : `<div class="card">${emptyState({ icon: 'trending-up', title: 'No measurements', text: 'Optional. Add weight or tape measurements whenever you like.', action: addBtn('bodyMetric', 'Add measurement') })}</div>`}</section></div>`;
}

/* ---------------- exercise detail ---------------- */
function exerciseDetail(key) {
  const s = State.get(), ex = exerciseSummaries(s).find(e => e.key === norm(key));
  if (!ex) return `<div class="card">${emptyState({ icon: 'dumbbell', title: 'Exercise not found', text: 'No entries exist for it.', action: '<a class="btn btn-primary" href="#/fitness">Back to Fitness</a>' })}</div>`;
  const pr = personalRecord(ex), entries = ex.entries.slice().reverse();
  const pts = ex.hasWeight ? ex.entries.filter(x => num(x.weight) > 0).map(x => ({ x: fmtDate(x.date), y: num(x.weight) })) : ex.entries.map(x => ({ x: fmtDate(x.date), y: num(x.reps) }));
  const dayMax = Object.values(groupBy(ex.entries, x => x.date)).length;
  return `<header class="page-head"><div style="min-width:0"><p class="eyebrow">Exercise</p><h1 class="t-title trunc">${esc(ex.name)}</h1></div><div class="page-head-actions">${addBtn('workout', 'Log', { prefill: { exercise: ex.name } })}</div></header>
    <div class="stack-lg"><div class="trio" style="--i:1"><div class="card card-pad stat"><b>${fmtNum(pr.value, 1)}<small class="muted"> ${pr.unit}</small></b><span>Personal record</span></div><div class="card card-pad stat"><b>${dayMax}</b><span>Sessions</span></div><div class="card card-pad stat"><b>${fmtNum(entryVolume(ex.bestVolume))}</b><span>Best set volume (kg)</span></div></div>
      <section class="card card-pad" style="--i:2"><h2 class="t-h2">${ex.hasWeight ? 'Weight lifted over time' : 'Reps per set over time'}</h2><p class="t-small">${ex.hasWeight ? `Record: ${fmtNum(pr.value, 1)} kg for ${esc(pr.detail)} on ${esc(fmtDate(pr.date))}` : 'No weight recorded, so reps are shown.'}</p>
        ${pts.length >= 2 ? `<div class="mt-4">${lineChart({ points: pts, fmt: v => fmtNum(v, 1), ariaLabel: `${ex.name} progress` })}</div>` : '<p class="t-body mt-3">A chart needs at least two entries.</p>'}</section>
      <section class="card card-flush" style="--i:3"><div class="panel-head"><h2>History</h2></div><div class="list">${entries.map(x => `<div class="row"><button type="button" class="row-main" data-action="form" data-type="workout" data-id="${esc(x.id)}"><span class="row-title">${esc(setLine(x))}</span><span class="row-sub">${esc(fmtDate(x.date, { day: 'numeric', month: 'short', year: 'numeric' }))}${x.notes ? ` · ${esc(x.notes)}` : ''}</span></button><span class="row-end">${kebab('workout', x.id)}</span></div>`).join('')}</div></section></div>`;
}

/* ---------------- session logger (from a plan) ---------------- */
function openSession(id) {
  const t = find('workoutTemplate', id); if (!t) return;
  const rows = t.exercises.map((name, i) => {
    const last = exerciseSummaries(State.get()).find(e => e.key === norm(name))?.last;
    return `<div class="sess-row" data-name="${esc(name)}"><div class="sess-name"><b class="trunc">${esc(name)}</b>${last ? `<small>Last: ${esc(setLine(last))}</small>` : ''}</div>
      <div class="sess-in"><label><span class="sr-only">Sets</span><input type="number" inputmode="numeric" min="0" placeholder="Sets" value="${last ? num(last.sets) : 3}" data-f="sets" aria-label="${esc(name)} sets"></label><label><span class="sr-only">Reps</span><input type="number" inputmode="numeric" min="0" placeholder="Reps" value="${last ? num(last.reps) : 10}" data-f="reps" aria-label="${esc(name)} reps"></label><label><span class="sr-only">Weight</span><input type="number" inputmode="decimal" min="0" step="any" placeholder="kg" value="${last && num(last.weight) ? num(last.weight) : ''}" data-f="weight" aria-label="${esc(name)} weight in kilograms"></label></div>
      <button type="button" class="icon-btn" data-skip aria-label="Skip ${esc(name)}">${icon('x', { size: 16 })}</button></div>`;
  }).join('');
  const api = openSheet({ title: t.name, subtitle: 'Adjust the numbers, skip what you did not do', size: 'wide', body: `<div class="field" style="margin-bottom:14px"><label for="sess-date">Date</label><input id="sess-date" type="date" value="${todayStr()}"></div><div class="sess-head"><span>Exercise</span><span>Sets · Reps · kg</span></div>${rows}`, footer: '<button class="btn btn-ghost" type="button" data-sheet-close>Cancel</button><button class="btn btn-primary" type="button" data-save>Save session</button>' });
  api.el.addEventListener('click', e => { const b = e.target.closest('[data-skip]'); if (b) b.closest('.sess-row').classList.toggle('is-skipped'); });
  api.el.querySelector('[data-save]').addEventListener('click', () => {
    const date = api.el.querySelector('#sess-date').value; let saved = 0, xp = 0, failed = '';
    api.el.querySelectorAll('.sess-row:not(.is-skipped)').forEach(r => {
      const v = f => r.querySelector(`[data-f="${f}"]`).value;
      if (!(num(v('sets')) > 0 && num(v('reps')) > 0)) return;
      const res = saveRecord('workout', { exercise: r.dataset.name, date, sets: v('sets'), reps: v('reps'), weight: v('weight'), duration: 0, notes: `From plan: ${t.name}` });
      if (res.ok) { saved++; xp += res.xp; } else failed = Object.values(res.errors)[0];
    });
    if (!saved) { toast(failed || 'Enter sets and reps for at least one exercise.', { type: 'error' }); return; }
    api.close(); toast(`${plural(saved, 'exercise')} logged`, { xp });
  });
}

registerActions({
  'fit-tab'(el) { ui.tab = el.dataset.tab; emit('view:refresh'); },
  'fit-day'(el) { ui.day = el.dataset.date; emit('view:refresh'); },
  'fit-month'(el) { ui.month = addMonths(ui.month, Number(el.dataset.dir)); emit('view:refresh'); },
  'fit-session'(el) { openSession(el.dataset.id); }
});

function render() {
  const s = State.get();
  const tabs = `<div class="seg seg-fit" role="tablist" aria-label="Fitness sections" style="--i:1">${TABS.map(([id, label]) => `<button type="button" role="tab" aria-selected="${ui.tab === id}" aria-pressed="${ui.tab === id}" class="${ui.tab === id ? 'is-on' : ''}" data-action="fit-tab" data-tab="${id}">${label}</button>`).join('')}</div>`;
  const content = { overview, history, exercises, plans, body }[ui.tab](s);
  return `${pageHead({ title: 'Fitness', sub: s.workoutLogs.length ? `${plural(s.workoutLogs.length, 'entry', 'entries')} logged` : 'Train, record, improve', actions: addBtn('workout', 'Log') })}<div class="stack-lg">${tabs}${content}</div>`;
}

export const route = {
  id: 'fitness',
  render: parts => (parts[0] === 'exercise' && parts[1] ? exerciseDetail(parts[1]) : render()),
  title: parts => (parts[0] === 'exercise' ? 'Exercise' : 'Fitness')
};
