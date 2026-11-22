/* Discipline: your own challenges. Each challenge keeps its own day records, so a miss in one never touches another.
 * A day with no record is "not recorded", never a miss. Language stays supportive on purpose. */
import * as State from '../core/state.js';
import { itemIcon } from '../core/itemicons.js';
import { registerActions } from '../core/events.js';
import { setChallengeDay, find } from '../core/records.js';
import { challengeStats } from '../core/stats.js';
import { esc, todayStr, fmtDate, plural, isDateStr } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { pageHead, emptyState, addBtn, kebab } from '../components/ui.js';
import { ring } from '../components/charts.js';
import { challengeDots } from '../components/heatmap.js';
import { openSheet, confirmDialog } from '../components/modal.js';
import { toast } from '../components/toast.js';

function listRow(c) {
  const st = challengeStats(c), done = st.todayStatus === 'done';
  return `<div class="row ch-row"><a class="item-ico" href="#/discipline/${esc(c.id)}" aria-label="Open ${esc(c.name)}">${itemIcon(c, 'challenge', 22)}</a>
    <a class="row-main" href="#/discipline/${esc(c.id)}"><span class="row-title trunc">${esc(c.name)}</span><span class="row-sub">${c.status === 'completed' ? 'Completed' : st.notStarted ? `Starts ${esc(fmtDate(c.startDate))}` : `${plural(st.current, 'day')} streak · target ${c.targetDays}`}</span></a>
    ${!st.notStarted && c.status !== 'completed' ? `<button type="button" class="check-wrap" data-action="ch-today" data-id="${esc(c.id)}" role="checkbox" aria-checked="${done}" aria-label="${done ? 'Undo' : 'Mark'} ${esc(c.name)} done today"><span class="check ${done ? 'is-on' : ''}">${icon('check', { size: 16 })}</span></button>` : ''}
    <span class="row-end"><a class="ch-ring" href="#/discipline/${esc(c.id)}" tabindex="-1" aria-hidden="true">${ring({ value: st.progress, size: 38, stroke: 4, label: String(st.current), title: `${c.name}: streak ${st.current}` })}</a>${kebab('challenge', c.id)}</span></div>`;
}

function renderList() {
  const s = State.get(), list = s.challenges;
  const head = pageHead({ title: 'Discipline', sub: list.length ? plural(list.filter(c => c.status !== 'completed').length, 'active challenge') : 'Challenges you set for yourself', actions: addBtn('challenge', 'Challenge') });
  if (!list.length) return `${head}<div class="card" style="--i:1">${emptyState({ icon: 'shield', title: 'Set your first challenge', text: 'Read every day, work out, wake early. Each challenge keeps its own streak and history.', action: addBtn('challenge', 'Create a challenge') })}</div>`;
  const active = list.filter(c => c.status !== 'completed'), completed = list.filter(c => c.status === 'completed');
  return `${head}<div class="stack-lg">${active.length ? `<section class="card card-flush" style="--i:1"><div class="list">${active.map(listRow).join('')}</div></section>` : ''}
    ${completed.length ? `<section style="--i:2"><h2 class="t-micro" style="margin:0 4px 10px">Completed</h2><div class="card card-flush"><div class="list">${completed.map(listRow).join('')}</div></div></section>` : ''}
    ${(s.disciplineLogs || []).length ? `<section style="--i:3"><h2 class="t-micro" style="margin:0 4px 10px">Earlier reflections</h2><div class="card card-flush"><div class="list">${s.disciplineLogs.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 10).map(l => `<div class="row"><span class="row-main"><span class="row-title">${esc(fmtDate(l.date, { day: 'numeric', month: 'short', year: 'numeric' }))} · ${esc(l.status || 'Reflection')}</span><span class="row-sub">${esc([l.trigger, l.response].filter(Boolean).join(' · '))}</span></span></div>`).join('')}</div></div></section>` : ''}</div>`;
}

function renderDetail(id) {
  const c = find('challenge', id);
  if (!c) return `<div class="card">${emptyState({ icon: 'shield', title: 'Challenge not found', text: 'It may have been deleted.', action: '<a class="btn btn-primary" href="#/discipline">Back to Discipline</a>' })}</div>`;
  const st = challengeStats(c), today = st.todayStatus, running = c.status !== 'completed' && !st.notStarted;
  const stat = (v, l) => `<div class="stat"><b class="t-num">${v}</b><span>${l}</span></div>`;
  return `<header class="page-head"><div class="row-gap" style="flex-wrap:nowrap;min-width:0"><span class="item-ico is-lg">${itemIcon(c, 'challenge', 28)}</span><div style="min-width:0"><p class="eyebrow">${c.status === 'completed' ? 'Completed' : st.notStarted ? `Starts ${esc(fmtDate(c.startDate))}` : `Day ${Math.min(c.targetDays, Math.max(1, Math.round((new Date(todayStr()) - new Date(c.startDate)) / 864e5) + 1))} of ${c.targetDays}`}</p><h1 class="t-title">${esc(c.name)}</h1></div></div><div class="page-head-actions">${addBtn('challenge', 'Edit', { cls: 'btn btn-sm', id: c.id })}</div></header>
    <div class="stack-lg">
      <section class="ch-hero" style="--i:1">${ring({ value: st.progress, size: 132, stroke: 11, label: String(st.current), sub: st.current === 1 ? 'day' : 'days', title: `Current streak ${st.current} days` })}
        <div class="stat-grid is-3">${stat(st.longest, 'Longest')}${stat(st.done, 'Completed')}${stat(`${Math.round(st.progress)}%`, 'Of target')}</div></section>
      ${running ? `<section class="card card-pad stack" style="--i:2"><h2 class="t-h2">Today</h2>${today === 'done' ? '<p class="t-body">Recorded as done. Rest well.</p>' : today === 'slip' ? '<p class="t-body">Logged honestly. Tomorrow is a fresh page.</p>' : '<p class="t-body">Not recorded yet.</p>'}
        <div class="row-gap"><button class="btn ${today === 'done' ? '' : 'btn-primary'}" type="button" data-action="ch-today" data-id="${esc(c.id)}" style="flex:1">${icon('check', { size: 18 })} ${today === 'done' ? 'Undo today' : 'Done today'}</button>${today === 'slip' ? '' : `<button class="btn btn-ghost" type="button" data-action="ch-slip" data-id="${esc(c.id)}">Log a miss</button>`}</div></section>` : ''}
      <section class="card card-pad" style="--i:3"><div class="between"><h2 class="t-h2">History</h2><span class="t-small">Tap a day to correct it</span></div><div class="mt-4">${challengeDots(c)}</div>
        <div class="hm-legend mt-3" aria-hidden="true"><span><i class="lg-done"></i>Done</span><span><i class="lg-slip"></i>Missed</span><span><i class="lg-future"></i>Not recorded</span></div></section>
      ${c.reward ? `<p class="t-body" style="--i:4">Your reward: <b>${esc(c.reward)}</b></p>` : ''}
      <div style="--i:5"><button class="btn btn-danger" type="button" data-action="delete" data-type="challenge" data-id="${esc(c.id)}" data-back="#/discipline">${icon('trash', { size: 18 })} Delete challenge</button></div></div>`;
}

function openDay(id, date) {
  const c = find('challenge', id); if (!c || !isDateStr(date) || date > todayStr()) return;
  const entry = c.logs?.[date], cur = entry?.status || '';
  const opt = (v, l) => `<label><input type="radio" name="st" value="${v}" ${cur === v ? 'checked' : ''}>${l}</label>`;
  const api = openSheet({ title: 'Correct this day', subtitle: fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), size: 'narrow',
    body: `<div class="seg" role="radiogroup" aria-label="Status">${opt('done', 'Done')}${opt('slip', 'Missed')}${opt('', 'No record')}</div><div class="field mt-4"><label for="chn">Note (optional)</label><textarea id="chn" rows="3" maxlength="400">${esc(entry?.note || '')}</textarea></div><p class="field-hint mt-2">Corrections update streaks and never award XP.</p>`,
    footer: '<button class="btn btn-ghost" type="button" data-sheet-close>Cancel</button><button class="btn btn-primary" type="button" data-save>Save</button>' });
  api.el.querySelector('[data-save]').addEventListener('click', () => {
    const status = api.el.querySelector('input[name=st]:checked')?.value || '';
    setChallengeDay(id, date, status === 'done' && date === todayStr() ? 'done' : status, api.el.querySelector('#chn').value);
    api.close(); toast('Saved');
  });
}

registerActions({
  'ch-today'(el) {
    const c = find('challenge', el.dataset.id); if (!c) return;
    const done = c.logs?.[todayStr()]?.status === 'done';
    const xp = setChallengeDay(c.id, todayStr(), done ? '' : 'done');
    toast(done ? 'Undone' : 'Day recorded. Well done.', { xp });
  },
  async 'ch-slip'(el) {
    if (!await confirmDialog({ title: 'Log a miss for today?', message: 'That is okay, and it takes honesty to log it. Your other days and longest streak stay saved.', confirmLabel: 'Log a miss' })) return;
    setChallengeDay(el.dataset.id, todayStr(), 'slip'); toast('Logged. Tomorrow is a fresh start.');
  },
  'ch-day'(el) { openDay(el.dataset.id, el.dataset.date); }
});

export const route = {
  id: 'discipline',
  render: parts => (parts[0] ? renderDetail(parts[0]) : renderList()),
  title: parts => (parts[0] ? find('challenge', parts[0])?.name || 'Challenge' : 'Discipline')
};
