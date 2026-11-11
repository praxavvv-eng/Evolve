/* Learning: books and reading progress (restored from the V6 archive during migration). */
import * as State from '../core/state.js';
import { registerActions, emit } from '../core/events.js';
import { updateBookPage, find } from '../core/records.js';
import { esc, fmtNum, fmtDate, plural, num } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { bookProgress } from '../core/stats.js';
import { pageHead, emptyState, addBtn, kebab, badge } from '../components/ui.js';
import { progressBar, ring } from '../components/charts.js';
import { toast } from '../components/toast.js';

const ui = { status: 'All' };
const ORDER = ['Reading', 'To read', 'Paused', 'Finished', 'Dropped'];
const KIND = { Reading: 'accent', Finished: 'pos', Paused: 'warn', Dropped: 'neg', 'To read': '' };

function bookRow(b) {
  const p = bookProgress(b);
  return `<div class="row"><a class="row-lead" href="#/learning/${esc(b.id)}" aria-label="Open ${esc(b.title)}">${icon('book', { size: 18 })}</a>
    <a class="row-main" href="#/learning/${esc(b.id)}"><span class="row-title trunc">${esc(b.title)}</span><span class="row-sub trunc">${esc([b.author, b.totalPages ? `${fmtNum(b.currentPage)} / ${fmtNum(b.totalPages)} pages` : ''].filter(Boolean).join(' · ') || b.status)}</span>${b.totalPages && b.status !== 'To read' ? progressBar(p) : ''}</a>
    <span class="row-end">${badge(b.status, KIND[b.status])}${kebab('book', b.id)}</span></div>`;
}

function renderList() {
  const s = State.get(), books = s.books;
  const head = pageHead({ title: 'Learning', sub: books.length ? `${plural(books.length, 'book')}` : 'Books and reading', actions: addBtn('book', 'Book') });
  if (!books.length) return `${head}<div class="card" style="--i:1">${emptyState({ icon: 'book', title: 'No books yet', text: 'Track what you are reading, how far you are, and what you took from it.', action: addBtn('book', 'Add a book') })}</div>`;
  const reading = books.filter(b => b.status === 'Reading'), finished = books.filter(b => b.status === 'Finished');
  const pages = books.reduce((a, b) => a + num(b.currentPage), 0);
  const count = st => (st === 'All' ? books.length : books.filter(b => b.status === st).length);
  const list = books.filter(b => ui.status === 'All' || b.status === ui.status).sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || a.title.localeCompare(b.title));
  return `${head}<div class="stack-lg">
    <div class="trio" style="--i:1"><div class="card card-pad stat"><b>${reading.length}</b><span>Reading</span></div><div class="card card-pad stat"><b>${finished.length}</b><span>Finished</span></div><div class="card card-pad stat"><b>${fmtNum(pages)}</b><span>Pages read</span></div></div>
    <div class="chips" style="--i:2" role="group" aria-label="Filter books">${['All', ...ORDER].map(st => `<button type="button" class="chip ${ui.status === st ? 'is-on' : ''}" aria-pressed="${ui.status === st}" data-action="book-filter" data-status="${st}">${st}<span class="count">${count(st)}</span></button>`).join('')}</div>
    ${list.length ? `<section class="card card-flush" style="--i:3"><div class="list">${list.map(bookRow).join('')}</div></section>` : `<div class="card">${emptyState({ icon: 'book', title: `No ${ui.status.toLowerCase()} books`, text: 'Change a book’s status to move it here.' })}</div>`}</div>`;
}

function renderDetail(id) {
  const b = find('book', id);
  if (!b) return `<div class="card">${emptyState({ icon: 'book', title: 'Book not found', text: 'It may have been deleted.', action: '<a class="btn btn-primary" href="#/learning">Back to Learning</a>' })}</div>`;
  const p = bookProgress(b);
  return `<header class="page-head"><div style="min-width:0"><p class="eyebrow">${esc(b.author || 'Book')}</p><h1 class="t-title">${esc(b.title)}</h1></div><div class="page-head-actions">${addBtn('book', 'Edit', { cls: 'btn btn-sm', id: b.id })}</div></header>
    <div class="stack-lg"><section class="card card-pad ac-hero" style="--i:1">${ring({ value: p, size: 104, stroke: 10, label: b.totalPages || b.status === 'Finished' ? `${p}%` : '–', sub: 'read' })}<div class="stack" style="gap:8px;min-width:0">${badge(b.status, KIND[b.status])}<p class="t-body">${b.totalPages ? `${fmtNum(b.currentPage)} of ${fmtNum(b.totalPages)} pages` : `${fmtNum(b.currentPage)} pages read`}</p>${b.rating ? `<p class="rate">${icon('star', { size: 14 })}<b>${b.rating}</b><small>/5</small></p>` : ''}</div></section>
      ${b.status !== 'Finished' ? `<section class="card card-pad stack" style="--i:2"><h2 class="t-h2">Update progress</h2><div class="page-update"><input class="input" id="pg-now" type="number" inputmode="numeric" min="0" ${b.totalPages ? `max="${b.totalPages}"` : ''} value="${num(b.currentPage)}" aria-label="Current page"><button class="btn btn-primary" type="button" data-action="book-page" data-id="${esc(b.id)}">Save page</button></div></section>` : ''}
      ${b.notes ? `<section class="card card-pad" style="--i:3"><h2 class="t-h2">Notes</h2><p class="t-body mt-2" style="white-space:pre-wrap">${esc(b.notes)}</p></section>` : ''}
      <dl class="kv card card-pad" style="--i:4"><div><dt>Started</dt><dd>${b.startedAt ? esc(fmtDate(b.startedAt, { day: 'numeric', month: 'short', year: 'numeric' })) : '—'}</dd></div><div><dt>Finished</dt><dd>${b.finishedAt ? esc(fmtDate(b.finishedAt, { day: 'numeric', month: 'short', year: 'numeric' })) : '—'}</dd></div></dl>
      <div style="--i:5"><button class="btn btn-danger" type="button" data-action="delete" data-type="book" data-id="${esc(b.id)}" data-back="#/learning">${icon('trash', { size: 18 })} Delete book</button></div></div>`;
}

registerActions({
  'book-filter'(el) { ui.status = el.dataset.status; emit('view:refresh'); },
  'book-page'(el) {
    const v = document.getElementById('pg-now')?.value;
    if (v === '' || v == null || Number(v) < 0) { toast('Enter a page number.', { type: 'error' }); return; }
    updateBookPage(el.dataset.id, v);
    toast('Progress saved');
  }
});

export const route = {
  id: 'learning',
  render: parts => (parts[0] ? renderDetail(parts[0]) : renderList()),
  title: parts => (parts[0] ? find('book', parts[0])?.title || 'Book' : 'Learning')
};
