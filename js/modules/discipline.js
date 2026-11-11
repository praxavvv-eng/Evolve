/* Discipline: a permanent daily tracker plus a separate challenge lifecycle (same rules as V6).
 *  - The daily record is permanent. Completing or ending a challenge never resets it.
 *  - A day with no record is simply "not recorded"; it is never turned into a setback automatically.
 *  - Corrections are explicit, never award XP, and keep history. Language is supportive on purpose. */
import * as State from '../core/state.js';
import { registerActions, emit } from '../core/events.js';
import { award, checkProgress } from '../core/xp.js';
import { currentStreak, bestStreak, streakFrom, logsOf } from '../core/stats.js';
import { esc, todayStr, addDays, uid, fmtDate, monthKey, addMonths, isDateStr } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { CHALLENGE_DAYS } from '../storage/migration.js';
import { pageHead, emptyState, badge } from '../components/ui.js';
import { ring, progressBar } from '../components/charts.js';
import { monthGrid } from '../components/calendar.js';
import { openSheet, confirmDialog } from '../components/modal.js';
import { toast } from '../components/toast.js';

const ui = { month: monthKey(todayStr()) };
const MILESTONES = [1, 3, 7, 14, 21, 30, 45, 60, 75, 90];
const MILESTONE_XP = { 1: 10, 3: 15, 7: 30, 14: 50, 21: 75, 30: 150, 45: 100, 60: 200, 75: 250, 90: 300 };

const nf = () => State.get().nofap;
const challengeStreak = n => (n.active && n.startedAt ? streakFrom(logsOf(n), logsOf(n)[todayStr()]?.status === 'on-track' ? todayStr() : addDays(todayStr(), -1), n.startedAt) : 0);

function recomputeBest(logs) {
  let best = 0, run = 0, prev = '';
  Object.keys(logs).sort().forEach(d => { if (logs[d]?.status !== 'on-track') { run = 0; prev = d; return; } run = prev && addDays(prev, 1) === d && run > 0 ? run + 1 : 1; best = Math.max(best, run); prev = d; });
  return best;
}

/* ---------------- actions on the tracker ---------------- */
function checkIn() {
  const today = todayStr(), note = (document.getElementById('disc-note')?.value || '').trim().slice(0, 400);
  if (logsOf(nf())[today]?.status === 'on-track') { toast('Today is already recorded'); return; }
  let xp = 0;
  State.update(s => {
    const n = s.nofap; n.dailyLogs = n.dailyLogs || {};
    n.dailyLogs[today] = { status: 'on-track', challengeId: n.active ? n.challengeId : '', note, recordedAt: new Date().toISOString() };
    n.logs = { ...n.dailyLogs };
    n.bestStreak = Math.max(Number(n.bestStreak) || 0, streakFrom(n.dailyLogs, today));
    xp += award(s, `nofap:daily:${today}`, 5, 'personal', 'Discipline day recorded').points;
    if (n.active && n.challengeId && n.startedAt) {
      const cs = streakFrom(n.dailyLogs, today, n.startedAt);
      MILESTONES.filter(m => m <= Number(n.targetDays) && cs >= m).forEach(m => { xp += award(s, `nofap:milestone:${n.challengeId}:${m}`, MILESTONE_XP[m], 'personal', `Discipline day ${m} milestone`).points; });
      if (cs >= Number(n.targetDays)) {
        n.active = false; n.completedAt = today;
        n.history.push({ challengeId: n.challengeId, startedAt: n.startedAt, endedAt: today, targetDays: Number(n.targetDays), finalStreak: cs, outcome: 'completed' });
      }
    }
  });
  checkProgress();
  toast('Day recorded. Well done.', { xp });
}

async function logSetback() {
  const today = todayStr();
  if (logsOf(nf())[today]?.status === 'slip') { toast('Today is already marked'); return; }
  const wasActive = nf().active;
  if (!await confirmDialog({ title: 'Record today as a setback?', message: `That is okay, and it takes honesty to log it. Your earlier days and best streak stay saved.${wasActive ? ' Your current challenge will end so you can begin a new one when you are ready.' : ''}`, confirmLabel: 'Record setback' })) return;
  State.update(s => {
    const n = s.nofap, prevDay = addDays(today, -1);
    n.bestStreak = Math.max(Number(n.bestStreak) || 0, streakFrom(n.dailyLogs, prevDay));
    n.dailyLogs[today] = { status: 'slip', challengeId: n.active ? n.challengeId : '', recordedAt: new Date().toISOString() };
    n.logs = { ...n.dailyLogs };
    if (n.active && n.challengeId) {
      n.history.push({ challengeId: n.challengeId, startedAt: n.startedAt, endedAt: today, targetDays: Number(n.targetDays), finalStreak: streakFrom(n.dailyLogs, prevDay, n.startedAt), outcome: 'reset' });
      n.active = false;
    }
  });
  toast('Recorded. Your history is still here.');
}

async function startChallenge() {
  const n = nf();
  if (n.active) { toast('A challenge is already active'); return; }
  const target = CHALLENGE_DAYS.includes(Number(document.getElementById('disc-target')?.value)) ? Number(document.getElementById('disc-target').value) : n.targetDays;
  const reward = (document.getElementById('disc-reward')?.value || '').trim().slice(0, 120);
  if (n.challengeId && !await confirmDialog({ title: 'Start a fresh challenge?', message: 'Your daily calendar, best streak and earlier challenge history stay saved.', confirmLabel: 'Start' })) return;
  State.update(s => {
    const x = s.nofap, today = todayStr();
    x.targetDays = target; x.personalReward = reward;
    x.startedAt = today; x.challengeId = uid('challenge'); x.active = true; x.completedAt = '';
    if (x.dailyLogs[today]?.status === 'on-track') {          // today was already recorded: it counts towards the new challenge
      x.dailyLogs[today].challengeId = x.challengeId; x.logs = { ...x.dailyLogs };
      award(s, `nofap:milestone:${x.challengeId}:1`, 10, 'personal', 'Discipline day 1 milestone');
    }
  });
  checkProgress();
  toast('Your challenge has started');
}

async function endChallenge() {
  if (!await confirmDialog({ title: 'End this challenge?', message: 'This only ends the challenge. No setback is recorded and your daily calendar and best streak are untouched.', confirmLabel: 'End challenge' })) return;
  State.update(s => {
    const n = s.nofap, today = todayStr();
    n.history.push({ challengeId: n.challengeId, startedAt: n.startedAt, endedAt: today, targetDays: Number(n.targetDays), finalStreak: streakFrom(n.dailyLogs, logsOf(n)[today]?.status === 'on-track' ? today : addDays(today, -1), n.startedAt), outcome: 'reset', endedByUser: true });
    n.active = false;
  });
  toast('Challenge ended. Your record is intact.');
}

function openCorrection(date) {
  if (!isDateStr(date) || date > todayStr()) return;
  const entry = logsOf(nf())[date], cur = entry?.status || 'unrecorded';
  const opt = (v, l) => `<label><input type="radio" name="st" value="${v}" ${cur === v ? 'checked' : ''}>${l}</label>`;
  const api = openSheet({ title: entry ? 'Correct this day' : 'Record this day', subtitle: fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), size: 'narrow',
    body: `<form class="stack" id="disc-fix"><div class="seg" role="radiogroup" aria-label="Status" style="flex-wrap:wrap">${opt('on-track', 'On track')}${opt('slip', 'Setback')}${opt('unrecorded', 'No record')}</div>
      <div class="field"><label for="disc-fix-note">Reflection (optional)</label><textarea id="disc-fix-note" maxlength="400" rows="3">${esc(entry?.note || '')}</textarea></div><p class="field-hint">Corrections update your calendar and streaks. They never award XP.</p></form>`,
    footer: '<button class="btn btn-ghost" type="button" data-sheet-close>Cancel</button><button class="btn btn-primary" type="button" data-save>Save</button>' });
  api.el.querySelector('[data-save]').addEventListener('click', () => {
    const status = api.el.querySelector('input[name=st]:checked')?.value || 'unrecorded', note = api.el.querySelector('#disc-fix-note').value.trim().slice(0, 400);
    State.update(s => {
      const n = s.nofap, prev = n.dailyLogs[date] || {};
      if (status === 'unrecorded') delete n.dailyLogs[date]; else n.dailyLogs[date] = { ...prev, status, note, correctedAt: new Date().toISOString() };
      n.logs = { ...n.dailyLogs };
      n.bestStreak = recomputeBest(n.dailyLogs);
      n.history.forEach(h => { if (h.startedAt && h.endedAt) h.finalStreak = streakFrom(n.dailyLogs, h.outcome === 'completed' ? h.endedAt : addDays(h.endedAt, -1), h.startedAt); });
    });
    api.close(); toast('Correction saved');
  });
}

/* ---------------- view ---------------- */
function render() {
  const s = State.get(), n = s.nofap, logs = logsOf(n), today = todayStr();
  const cur = currentStreak(n), best = bestStreak(n), cs = challengeStreak(n), todayEntry = logs[today];
  const marks = Object.fromEntries(Object.entries(logs).map(([d, e]) => [d, e.status === 'on-track' ? 'on' : e.status === 'slip' ? 'slip' : '']));
  const target = Number(n.targetDays) || 30;
  const history = (n.history || []).slice().reverse();
  const recorded = Object.keys(logs).length;

  const todayCard = todayEntry
    ? `<section class="card card-pad stack" style="--i:2"><div class="between"><h2 class="t-h2">Today</h2>${badge(todayEntry.status === 'on-track' ? 'On track' : 'Setback logged', todayEntry.status === 'on-track' ? 'pos' : 'warn')}</div>
        <p class="t-body">${todayEntry.status === 'on-track' ? 'Today is recorded. Rest well.' : 'Today is logged honestly. Tomorrow is a fresh page.'}</p>${todayEntry.note ? `<p class="t-small">“${esc(todayEntry.note)}”</p>` : ''}
        <button class="link-btn" type="button" data-action="disc-fix" data-date="${today}" style="align-self:flex-start">Correct today’s entry</button></section>`
    : `<section class="card card-pad stack" style="--i:2"><h2 class="t-h2">Today</h2><p class="t-body">Not recorded yet. Check in when the day is going the way you intended, or log honestly if it was not.</p>
        <div class="field"><label for="disc-note">Reflection (optional)</label><textarea id="disc-note" rows="2" maxlength="400" placeholder="How did today feel?" data-keep="disc-note"></textarea></div>
        <div class="row-gap"><button class="btn btn-primary" type="button" data-action="disc-checkin" style="flex:1">${icon('check', { size: 18 })} Stayed on track</button><button class="btn" type="button" data-action="disc-slip">Log a setback</button></div></section>`;

  const challengeCard = n.active
    ? `<section class="card card-pad stack" style="--i:3"><div class="between"><h2 class="t-h2">Challenge</h2>${badge(`${target} days`, 'accent')}</div>
        <div><div class="between"><span class="t-small">Day ${Math.min(cs, target)} of ${target}</span><b class="t-num">${Math.round(Math.min(100, (cs / target) * 100))}%</b></div><div class="mt-2">${progressBar((cs / target) * 100)}</div></div>
        <div class="ms-row">${MILESTONES.filter(m => m <= target).map(m => `<span class="ms-pill ${cs >= m ? 'is-on' : ''}" title="Day ${m}">${cs >= m ? icon('check', { size: 12 }) : ''}${m}</span>`).join('')}</div>
        ${n.personalReward ? `<p class="t-small">Your reward: <b>${esc(n.personalReward)}</b></p>` : ''}
        <button class="btn btn-ghost" type="button" data-action="disc-end" style="align-self:flex-start">End challenge</button></section>`
    : `<section class="card card-pad stack" style="--i:3"><h2 class="t-h2">Challenge</h2>${n.completedAt ? `<p class="t-body pos">Your last challenge was completed on ${esc(fmtDate(n.completedAt, { day: 'numeric', month: 'short', year: 'numeric' }))}. Your daily tracker carries on.</p>` : '<p class="t-body">A challenge is an optional goal on top of your daily tracker.</p>'}
        <div class="field"><span class="field-label">Length</span><div class="seg" role="radiogroup" aria-label="Challenge length">${CHALLENGE_DAYS.map(d => `<label><input type="radio" name="disc-target-r" value="${d}" ${d === target ? 'checked' : ''}>${d}</label>`).join('')}</div><input type="hidden" id="disc-target" value="${target}"></div>
        <div class="field"><label for="disc-reward">Personal reward (optional)</label><input id="disc-reward" maxlength="120" value="${esc(n.personalReward || '')}" placeholder="Something to look forward to"></div>
        <button class="btn btn-primary" type="button" data-action="disc-start">${icon('play', { size: 16 })} Start a ${target}-day challenge</button></section>`;

  return `${pageHead({ title: 'Discipline', sub: 'One day at a time. Honest, steady, kind to yourself.' })}
    <div class="stack-lg">
      <section class="card disc-hero" style="--i:1">${ring({ value: n.active ? (cs / target) * 100 : Math.min(100, (cur / 30) * 100), size: 128, stroke: 11, label: String(cur), sub: cur === 1 ? 'day' : 'days', title: `Current streak ${cur} days` })}
        <div class="disc-stats"><div class="stat"><b>${best}</b><span>Best streak</span></div><div class="stat"><b>${recorded}</b><span>Days recorded</span></div><div class="stat"><b>${(n.history || []).filter(h => h.outcome === 'completed').length}</b><span>Challenges</span></div></div></section>
      <div class="grid cols-2">${todayCard}${challengeCard}</div>
      <section class="card card-pad" style="--i:4"><h2 class="t-h2 mb-2">Calendar</h2><div class="mt-3">${monthGrid({ month: ui.month, selected: '', marks, prefix: 'disc', mondayFirst: s.settings.weekStartsMonday })}</div>
        <div class="legend mt-3"><span><i style="--c:var(--accent)"></i>On track</span><span><i style="--c:var(--warn)"></i>Setback</span><span><i style="--c:var(--surface-3)"></i>Not recorded</span></div><p class="t-small mt-2">Tap a day to record or correct it. Unrecorded days are never counted as setbacks.</p></section>
      <section style="--i:5"><h2 class="t-micro" style="margin:0 4px 10px">Challenge history</h2>${history.length ? `<div class="card card-flush"><div class="list">${history.slice(0, 20).map(h => `<div class="row"><span class="row-lead">${icon(h.outcome === 'completed' ? 'award' : 'refresh', { size: 18 })}</span><span class="row-main"><span class="row-title">${h.outcome === 'completed' ? 'Challenge completed' : 'Challenge ended'}</span><span class="row-sub">${esc(fmtDate(h.startedAt, { day: 'numeric', month: 'short' }))} – ${esc(fmtDate(h.endedAt, { day: 'numeric', month: 'short', year: 'numeric' }))}</span></span><span class="row-end t-num t-small">${h.finalStreak}/${h.targetDays} days</span></div>`).join('')}</div></div>` : `<div class="card">${emptyState({ icon: 'shield', title: 'No challenges yet', text: 'Completed and ended challenges are kept here.' })}</div>`}</section>
      ${(s.disciplineLogs || []).length ? `<section style="--i:6"><h2 class="t-micro" style="margin:0 4px 10px">Earlier reflections (from V6)</h2><div class="card card-flush"><div class="list">${s.disciplineLogs.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 20).map(l => `<div class="row"><span class="row-main"><span class="row-title">${esc(fmtDate(l.date, { day: 'numeric', month: 'short', year: 'numeric' }))} · ${esc(l.status || 'Reflection')}</span><span class="row-sub">${esc([l.trigger, l.response].filter(Boolean).join(' · '))}</span></span></div>`).join('')}</div></div></section>` : ''}
    </div>`;
}

registerActions({
  'disc-checkin': checkIn, 'disc-slip': logSetback, 'disc-start': startChallenge, 'disc-end': endChallenge,
  'disc-fix'(el) { openCorrection(el.dataset.date); },
  'disc-day'(el) { openCorrection(el.dataset.date); },
  'disc-month'(el) { ui.month = addMonths(ui.month, Number(el.dataset.dir)); emit('view:refresh'); }
});
document.addEventListener('change', e => {
  if (e.target.matches?.('input[name="disc-target-r"]')) { const h = document.getElementById('disc-target'); if (h) h.value = e.target.value; const b = document.querySelector('[data-action="disc-start"]'); if (b) b.lastChild.textContent = ` Start a ${e.target.value}-day challenge`; }
});

export const route = { id: 'discipline', render };
