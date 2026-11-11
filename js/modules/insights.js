/* Insights: summaries computed only from recorded data, over a chosen range.
 * A section with too little data says what is needed instead of drawing an empty or misleading chart. */
import * as State from '../core/state.js';
import { registerActions, emit } from '../core/events.js';
import { fmtDM, esc, todayStr, addDays, rangeDates, fmtDate, fmtNum, money, num, sum, pct, plural, weekdayInitial, parseDate, dateStr } from '../core/utils.js';
import { isScheduled, habitDone, completedOn, entryVolume, academicOverview, bookProgress } from '../core/stats.js';
import { bars, ring, progressBar, legend, CHART_COLORS } from '../components/charts.js';
import { pageHead } from '../components/ui.js';

const ui = { range: 30 };
const RANGES = [[7, '7 days'], [30, '30 days'], [90, '90 days']];
const C = { tasks: 'var(--accent)', habits: '#94b8d0', workouts: '#d39a6e' };
const weekStart = d => { const dt = parseDate(d); dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7)); return dateStr(dt); };
const need = text => `<p class="t-body mt-3 need">${esc(text)}</p>`;
const card = (title, sub, inner, i) => `<section class="card card-pad" style="--i:${i}"><div class="between"><div><h2 class="t-h2">${esc(title)}</h2>${sub ? `<p class="t-small">${esc(sub)}</p>` : ''}</div></div>${inner}</section>`;

function render() {
  const s = State.get(), today = todayStr(), from = addDays(today, -(ui.range - 1)), days = rangeDates(from, today);
  const inR = d => d >= from && d <= today;

  /* ----- activity ----- */
  const dayData = days.map(d => ({ d, tasks: s.tasks.filter(t => completedOn(t, d)).length, habits: Object.keys(s.habitLogs[d] || {}).length, workouts: s.workoutLogs.filter(w => w.date === d).length }));
  const buckets = ui.range === 90 ? Object.values(dayData.reduce((m, x) => { const k = weekStart(x.d); (m[k] ||= { d: k, tasks: 0, habits: 0, workouts: 0 }); m[k].tasks += x.tasks; m[k].habits += x.habits; m[k].workouts += x.workouts; return m; }, {})) : dayData;
  const actTotal = sum(dayData, x => x.tasks + x.habits + x.workouts), activeDays = dayData.filter(x => x.tasks + x.habits + x.workouts > 0).length;
  const activity = card('Activity', `Completed tasks, habit check-ins and workouts · ${ui.range === 90 ? 'by week' : 'by day'}`,
    activeDays >= 3 ? `<div class="mt-4">${bars({ items: buckets.map(x => ({ label: ui.range === 7 ? weekdayInitial(x.d) : ui.range === 30 ? (Number(x.d.slice(8)) % 5 === 0 ? String(Number(x.d.slice(8))) : '') : fmtDate(x.d, { day: 'numeric' }), today: x.d === today, segments: [{ v: x.tasks, color: C.tasks, name: `${x.tasks} tasks` }, { v: x.habits, color: C.habits, name: `${x.habits} habits` }, { v: x.workouts, color: C.workouts, name: `${x.workouts} workouts` }], title: `${x.d}: ${x.tasks} tasks, ${x.habits} habits, ${x.workouts} workouts` })), height: 140, ariaLabel: 'Activity' })}</div><div class="mt-3">${legend([{ label: 'Tasks', color: C.tasks }, { label: 'Habits', color: C.habits }, { label: 'Workouts', color: C.workouts }])}</div><p class="t-small mt-2">${activeDays} active ${activeDays === 1 ? 'day' : 'days'} · ${actTotal} items</p>` : need('Activity shows once you have entries on at least three different days in this range.'), 2);

  /* ----- tasks ----- */
  const doneInRange = s.tasks.filter(t => t.done && inR(String(t.completedAt || '').slice(0, 10))).length;
  const dueInRange = s.tasks.filter(t => t.due && inR(t.due));
  const dueDone = dueInRange.filter(t => t.done).length;
  const tasksCard = card('Tasks', 'Completed in this range', `<div class="insight-row mt-3"><div class="stat"><b>${doneInRange}</b><span>Completed</span></div>${dueInRange.length >= 3 ? `${ring({ value: pct(dueDone, dueInRange.length), size: 84, stroke: 8, label: `${Math.round(pct(dueDone, dueInRange.length))}%`, sub: 'on time' })}<p class="t-small" style="flex:1">${dueDone} of ${dueInRange.length} tasks due in this range are done.</p>` : `<p class="t-small" style="flex:1">A completion rate appears once at least 3 tasks have due dates in this range.</p>`}</div>`, 3);

  /* ----- habits ----- */
  const habitRows = s.habits.map(h => {
    const start = h.createdAt ? h.createdAt.slice(0, 10) : from, dd = days.filter(d => d >= start && isScheduled(h, d));
    const done = dd.filter(d => habitDone(s, h.id, d)).length;
    return { h, scheduled: dd.length, done, rate: pct(done, dd.length) };
  }).filter(r => r.scheduled >= 3);
  const habitsCard = card('Habit consistency', 'Share of scheduled days you checked in', habitRows.length ? `<div class="stack mt-3" style="gap:14px">${habitRows.sort((a, b) => b.rate - a.rate).map(r => `<div><div class="between"><span class="row-title">${esc(r.h.icon || '✦')} ${esc(r.h.name)}</span><span class="t-small t-num">${r.done}/${r.scheduled} · ${Math.round(r.rate)}%</span></div><div class="mt-2">${progressBar(r.rate)}</div></div>`).join('')}</div>` : need('Add a habit and check in for a few days to see consistency here.'), 4);

  /* ----- academics (current state, not range-based) ----- */
  const ov = academicOverview(s);
  const acCard = card('Academics', 'Current standing (not limited to the range)', s.subjects.length ? `<div class="insight-row mt-3">${ring({ value: ov.progress, size: 84, stroke: 8, label: `${ov.progress}%`, sub: 'overall' })}<div class="stack" style="gap:10px;flex:1">${ov.subs.slice(0, 4).map(x => `<div><div class="between"><span class="t-small trunc">${esc(x.subject.name)}</span><span class="t-small t-num">${x.progress}%</span></div>${progressBar(x.progress)}</div>`).join('')}</div></div><p class="t-small mt-3">${plural(ov.pending.length, 'item')} pending.</p>` : need('Add subjects in Academics to see progress here.'), 5);

  /* ----- finance ----- */
  const tx = s.transactions.filter(t => inR(t.date));
  const income = sum(tx.filter(t => t.type === 'income'), t => t.amount), expense = sum(tx.filter(t => t.type === 'expense'), t => t.amount);
  const byCat = Object.entries(tx.filter(t => t.type === 'expense').reduce((m, t) => { m[t.category] = (m[t.category] || 0) + t.amount; return m; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const finCard = card('Finance', 'Recorded transactions in this range', tx.length >= 3 ? `<div class="trio mt-3"><div class="stat"><b class="pos t-num">${esc(money(income, { compactMode: true }))}</b><span>Income</span></div><div class="stat"><b class="t-num">${esc(money(expense, { compactMode: true }))}</b><span>Spent</span></div><div class="stat"><b class="t-num ${income - expense < 0 ? 'neg' : ''}">${esc(money(income - expense, { compactMode: true }))}</b><span>Net</span></div></div>${byCat.length ? `<div class="stack mt-4" style="gap:12px">${byCat.map(([c, v], i) => `<div><div class="between"><span class="t-small">${esc(c)}</span><span class="t-small t-num">${esc(money(v))}</span></div><div class="bar mt-2"><span style="--w:${pct(v, expense)}%;background:${CHART_COLORS[i]}"></span></div></div>`).join('')}</div>` : ''}` : need('Record at least three transactions in this range to see a summary.'), 6);

  /* ----- workouts ----- */
  const wk = s.workoutLogs.filter(w => inR(w.date)), wDays = new Set(wk.map(w => w.date)).size;
  const weeks = Object.entries(wk.reduce((m, w) => { const k = weekStart(w.date); m[k] = (m[k] || 0) + entryVolume(w); return m; }, {})).sort();
  const fitCard = card('Workouts', 'Training days and volume', wk.length ? `<div class="trio mt-3"><div class="stat"><b>${wDays}</b><span>Training days</span></div><div class="stat"><b>${wk.length}</b><span>Entries</span></div><div class="stat"><b>${fmtNum(sum(wk, entryVolume))}</b><span>kg volume</span></div></div>${weeks.length >= 2 ? `<div class="mt-4">${bars({ items: weeks.map(([k, v]) => ({ label: fmtDM(k), value: v })), height: 110, ariaLabel: 'Weekly volume' })}</div>` : '<p class="t-small mt-3">A weekly volume chart appears once workouts span two weeks.</p>'}` : need('Log workouts to see training days and volume here.'), 7);

  /* ----- reading ----- */
  const reading = s.books.filter(b => b.status === 'Reading'), finishedIn = s.books.filter(b => b.status === 'Finished' && b.finishedAt && inR(b.finishedAt));
  const readCard = card('Reading', 'Books', s.books.length ? `<div class="trio mt-3"><div class="stat"><b>${reading.length}</b><span>Reading now</span></div><div class="stat"><b>${finishedIn.length}</b><span>Finished in range</span></div><div class="stat"><b>${fmtNum(sum(s.books, b => b.currentPage))}</b><span>Pages logged</span></div></div>${reading.length ? `<div class="stack mt-4" style="gap:12px">${reading.slice(0, 3).map(b => `<div><div class="between"><span class="t-small trunc">${esc(b.title)}</span><span class="t-small t-num">${bookProgress(b)}%</span></div>${progressBar(bookProgress(b))}</div>`).join('')}</div>` : ''}` : need('Add books in Learning to see reading progress.'), 8);

  /* ----- gaming ----- */
  const statusCounts = ['Playing', 'Backlog', 'Completed', 'On hold', 'Dropped'].map(st => [st, s.games.filter(g => g.status === st).length]).filter(([, n]) => n);
  const gameCard = card('Gaming', 'Library overview', s.games.length ? `<div class="trio mt-3"><div class="stat"><b>${s.games.length}</b><span>Games</span></div><div class="stat"><b>${fmtNum(sum(s.games, g => g.hours), 1)}</b><span>Total hours</span></div><div class="stat"><b>${s.games.filter(g => g.finishedAt && inR(g.finishedAt)).length}</b><span>Finished in range</span></div></div><div class="row-gap mt-3">${statusCounts.map(([st, n]) => `<span class="badge no-dot">${st} · ${n}</span>`).join('')}</div><p class="t-small mt-3">Playtime is stored as a running total, not per day, so it cannot be charted over time.</p>` : need('Add games to see your library overview.'), 9);

  const totalRecords = s.tasks.length + s.habits.length + s.transactions.length + s.workoutLogs.length + s.academicItems.length + s.games.length + s.books.length;
  return `${pageHead({ title: 'Insights', sub: `${fmtDate(from)} – ${fmtDate(today, { day: 'numeric', month: 'short', year: 'numeric' })}` })}
    <div class="stack-lg"><div class="seg" role="group" aria-label="Date range" style="--i:1">${RANGES.map(([v, l]) => `<button type="button" class="${ui.range === v ? 'is-on' : ''}" aria-pressed="${ui.range === v}" data-action="ins-range" data-range="${v}">${l}</button>`).join('')}</div>
      ${totalRecords < 5 ? `<p class="note-card" style="--i:1"><span class="i-wrap">i</span><span>Insights get useful after about a week of entries. Until then, sections explain what they need.</span></p>` : ''}
      <div class="grid cols-2" style="align-items:start">${activity}${tasksCard}${habitsCard}${acCard}${finCard}${fitCard}${readCard}${gameCard}</div></div>`;
}

registerActions({ 'ins-range'(el) { ui.range = Number(el.dataset.range); emit('view:refresh'); } });
export const route = { id: 'insights', render };
