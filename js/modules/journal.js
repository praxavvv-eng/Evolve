/* Notes & Journal: one list of entries (Note, Journal, Idea, Reflection) with kind filters. */
import * as State from '../core/state.js';
import { registerActions, emit } from '../core/events.js';
import { esc, todayStr, fmtDate, fmtMonth, monthKey, groupBy, plural } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { find } from '../core/records.js';
import { pageHead, emptyState, addBtn, kebab, badge } from '../components/ui.js';
import { OPTIONS } from '../core/schemas.js';

const ui = { kind: 'All' };

function entry(n) {
  const excerpt = (n.body || '').replace(/\s+/g, ' ').slice(0, 140);
  return `<article class="note-card-item"><a class="note-main" href="#/journal/${esc(n.id)}"><div class="between"><span class="t-micro">${esc(n.kind)} · ${esc(fmtDate(n.date, { day: 'numeric', month: 'short' }))}</span></div><h3 class="t-h3 trunc">${esc(n.title)}</h3>${excerpt ? `<p class="t-small clamp-2">${esc(excerpt)}</p>` : ''}${n.tags?.length ? `<div class="row-gap mt-2">${n.tags.slice(0, 4).map(t => badge(`#${t}`, 'accent')).join('')}</div>` : ''}</a>${kebab('note', n.id)}</article>`;
}

/** Reading view: real paragraphs, comfortable measure and serif body text. */
function renderDetail(id) {
  const n = find('note', id);
  if (!n) return `<div class="card">${emptyState({ icon: 'notebook', title: 'Entry not found', text: 'It may have been deleted.', action: '<a class="btn btn-primary" href="#/journal">Back to Notes</a>' })}</div>`;
  const paras = String(n.body || '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  return `<article class="read" style="--i:0"><p class="eyebrow">${esc(n.kind)} · ${esc(fmtDate(n.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</p>
    <h1 class="read-title">${esc(n.title)}</h1>
    ${n.tags?.length ? `<div class="row-gap">${n.tags.map(t => badge(`#${t}`, 'accent')).join('')}</div>` : ''}
    <div class="read-body">${paras.length ? paras.map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('') : '<p class="faint">This entry has only a title.</p>'}</div></article>
    <div class="row-gap read-actions" style="--i:1">${addBtn('note', 'Edit', { cls: 'btn btn-primary', id: n.id })}<button class="btn btn-danger" type="button" data-action="delete" data-type="note" data-id="${esc(n.id)}" data-back="#/journal">${icon('trash', { size: 18 })} Delete</button></div>`;
}

function render() {
  const s = State.get(), notes = s.notes;
  const head = pageHead({ title: 'Notes', sub: notes.length ? plural(notes.length, 'entry', 'entries') : 'Notes, ideas and journal', actions: addBtn('note', 'Entry') });
  if (!notes.length) return `${head}<div class="card" style="--i:1">${emptyState({ icon: 'notebook', title: 'A blank page', text: 'Write a note, an idea, or a few lines about your day.', action: addBtn('note', 'Write something') })}</div>`;
  const count = k => (k === 'All' ? notes.length : notes.filter(n => n.kind === k).length);
  const list = notes.filter(n => ui.kind === 'All' || n.kind === ui.kind).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));
  const byMonth = groupBy(list, n => monthKey(n.date)), months = Object.keys(byMonth).sort().reverse();
  const hasToday = notes.some(n => n.kind === 'Journal' && n.date === todayStr());
  return `${head}<div class="stack-lg">
    ${hasToday ? '' : `<button class="card card-pad today-prompt" type="button" style="--i:1" data-action="form" data-type="note" data-prefill='${esc(JSON.stringify({ kind: 'Journal' }))}'><span class="t-h3">Write today’s journal</span><span class="t-small">A few lines is enough.</span></button>`}
    <div class="chips" style="--i:2" role="group" aria-label="Filter entries">${['All', ...OPTIONS.noteKind].map(k => `<button type="button" class="chip ${ui.kind === k ? 'is-on' : ''}" aria-pressed="${ui.kind === k}" data-action="note-filter" data-kind="${k}">${k}<span class="count">${count(k)}</span></button>`).join('')}</div>
    ${list.length ? months.map(m => `<section style="--i:3"><h2 class="t-micro" style="margin:0 4px 10px">${esc(fmtMonth(m))}</h2><div class="note-grid">${byMonth[m].map(entry).join('')}</div></section>`).join('') : `<div class="card">${emptyState({ icon: 'notebook', title: `No ${ui.kind.toLowerCase()} entries`, text: 'Nothing here yet.' })}</div>`}</div>`;
}

registerActions({ 'note-filter'(el) { ui.kind = el.dataset.kind; emit('view:refresh'); } });
export const route = { id: 'journal', render: parts => (parts[0] ? renderDetail(parts[0]) : render()), title: parts => (parts[0] ? find('note', parts[0])?.title || 'Note' : 'Notes') };
