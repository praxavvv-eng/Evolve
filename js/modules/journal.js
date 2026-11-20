/* Notes & Journal: a landing page with search, kind and tag filters and recent notes; a comfortable reading view
 * (reading a note never drops you into the editor); and the full-screen writing sheet from the form builder. */
import * as State from '../core/state.js';
import { registerActions, registerInput, emit } from '../core/events.js';
import { esc, todayStr, fmtDate, fmtMonth, monthKey, groupBy, plural, debounce } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { find } from '../core/records.js';
import { pageHead, emptyState, addBtn, kebab, badge } from '../components/ui.js';
import { OPTIONS } from '../core/schemas.js';

const ui = { kind: 'All', tag: '', q: '' };
const words = t => (String(t || '').trim().match(/\S+/g) || []).length;
const excerpt = (n, len = 140) => (n.body || '').replace(/\s+/g, ' ').slice(0, len);
const KIND_ICON = { Note: 'notebook', Journal: 'edit', Idea: 'sparkles', Reflection: 'moon' };

function tile(n) {
  return `<a class="note-tile" href="#/journal/${esc(n.id)}"><span class="t-micro">${esc(n.kind)}</span><b class="clamp-2">${esc(n.title)}</b><p class="clamp-3">${esc(excerpt(n, 160)) || 'Only a title.'}</p><small>${esc(fmtDate(n.date, { day: 'numeric', month: 'short' }))}</small></a>`;
}
function entry(n) {
  const ex = excerpt(n);
  return `<article class="note-card-item" data-id="${esc(n.id)}"><a class="note-main" href="#/journal/${esc(n.id)}"><span class="t-micro">${esc(n.kind)} · ${esc(fmtDate(n.date, { day: 'numeric', month: 'short' }))}</span><h3 class="t-h3 trunc">${esc(n.title)}</h3>${ex ? `<p class="t-small clamp-2">${esc(ex)}</p>` : ''}${n.tags?.length ? `<div class="row-gap mt-2">${n.tags.slice(0, 4).map(t => badge(`#${t}`, 'accent')).join('')}</div>` : ''}</a>${kebab('note', n.id)}</article>`;
}

/** Reading view: real paragraphs, comfortable measure and serif body text. */
function renderDetail(id) {
  const n = find('note', id);
  if (!n) return `<div class="card">${emptyState({ icon: 'notebook', title: 'Entry not found', text: 'It may have been deleted.', action: '<a class="btn btn-primary" href="#/journal">Back to Notes</a>' })}</div>`;
  const paras = String(n.body || '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean), w = words(n.body);
  return `<article class="read" style="--i:0"><p class="eyebrow">${esc(n.kind)} · ${esc(fmtDate(n.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}${w ? ` · ${Math.max(1, Math.round(w / 200))} min read` : ''}</p>
    <h1 class="read-title">${esc(n.title)}</h1>
    ${n.tags?.length ? `<div class="row-gap">${n.tags.map(t => badge(`#${t}`, 'accent')).join('')}</div>` : ''}
    <div class="read-body">${paras.length ? paras.map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('') : '<p class="faint">This entry has only a title.</p>'}</div></article>
    <div class="row-gap read-actions" style="--i:1">${addBtn('note', 'Edit', { cls: 'btn btn-primary', id: n.id })}<button class="btn btn-danger" type="button" data-action="delete" data-type="note" data-id="${esc(n.id)}" data-back="#/journal">${icon('trash', { size: 18 })} Delete</button></div>`;
}

function render() {
  const s = State.get(), notes = s.notes;
  const head = pageHead({ title: 'Notes', sub: notes.length ? plural(notes.length, 'entry', 'entries') : 'Notes, ideas and journal', actions: addBtn('note', 'Note') });
  if (!notes.length) return `${head}<div class="card" style="--i:1">${emptyState({ icon: 'notebook', title: 'A blank page', text: 'Write a note, an idea, or a few lines about your day.', action: addBtn('note', 'Write something') })}</div>`;
  const q = ui.q.trim().toLowerCase();
  const count = k => (k === 'All' ? notes.length : notes.filter(n => n.kind === k).length);
  const allTags = [...new Set(notes.flatMap(n => n.tags || []))].sort();
  if (ui.tag && !allTags.includes(ui.tag)) ui.tag = '';
  const sorted = notes.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));
  const list = sorted.filter(n => (ui.kind === 'All' || n.kind === ui.kind) && (!ui.tag || (n.tags || []).includes(ui.tag)) && (!q || `${n.title} ${n.body} ${(n.tags || []).join(' ')}`.toLowerCase().includes(q)));
  const filtering = ui.kind !== 'All' || ui.tag || q;
  const byMonth = groupBy(list, n => monthKey(n.date)), months = Object.keys(byMonth).sort().reverse();
  const hasToday = notes.some(n => n.kind === 'Journal' && n.date === todayStr());
  return `${head}<div class="stack-lg">
    <div class="stack" style="--i:1"><div class="search-field">${icon('search', { size: 18 })}<input type="search" class="input" placeholder="Search notes" value="${esc(ui.q)}" data-input="note-q" data-keep="note-q" aria-label="Search notes"></div>
      <div class="chips" role="group" aria-label="Filter by type">${['All', ...OPTIONS.noteKind].map(k => `<button type="button" class="chip ${ui.kind === k ? 'is-on' : ''}" aria-pressed="${ui.kind === k}" data-action="note-filter" data-kind="${k}">${k}<span class="count">${count(k)}</span></button>`).join('')}</div>
      ${allTags.length ? `<div class="chips tags" role="group" aria-label="Filter by tag">${allTags.map(t => `<button type="button" class="chip ${ui.tag === t ? 'is-on' : ''}" aria-pressed="${ui.tag === t}" data-action="note-tag" data-tag="${esc(t)}">#${esc(t)}</button>`).join('')}</div>` : ''}</div>
    ${!filtering ? `${hasToday ? '' : `<button class="card card-pad today-prompt" type="button" style="--i:2" data-action="form" data-type="note" data-prefill='${esc(JSON.stringify({ kind: 'Journal' }))}'><span class="tp-ico">${icon('edit', { size: 18 })}</span><span><span class="t-h3">Write today’s journal</span><span class="t-small">A few lines is enough.</span></span></button>`}
      <section style="--i:2"><div class="sec-head tight"><h2>Recent</h2></div><div class="hscroll note-tiles">${sorted.slice(0, 6).map(tile).join('')}</div></section>` : ''}
    ${list.length ? months.map((m, i) => `<section style="--i:${3 + i}"><h2 class="t-micro" style="margin:0 4px 10px">${esc(fmtMonth(m))}</h2><div class="note-grid">${byMonth[m].map(entry).join('')}</div></section>`).join('') : `<div class="card">${emptyState({ icon: 'search', title: 'No notes found', text: 'Try a different word, type or tag.' })}</div>`}</div>`;
}

const refreshNotes = debounce(() => emit('view:refresh'), 140);
registerInput({ 'note-q'(el) { ui.q = el.value; refreshNotes(); } });
registerActions({
  'note-filter'(el) { ui.kind = el.dataset.kind; emit('view:refresh'); },
  'note-tag'(el) { ui.tag = ui.tag === el.dataset.tag ? '' : el.dataset.tag; emit('view:refresh'); }
});
export const route = { id: 'journal', render: parts => (parts[0] ? renderDetail(parts[0]) : render()), title: parts => (parts[0] ? find('note', parts[0])?.title || 'Note' : 'Notes') };
