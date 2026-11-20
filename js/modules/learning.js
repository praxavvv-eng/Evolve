/* Books: a digital bookshelf with sharp covers, reading progress from currentPage / totalPages, and "Add pages". */
import * as State from '../core/state.js';
import { registerActions, registerChange, registerInput, emit } from '../core/events.js';
import { updateBookPage, addBookPages, find } from '../core/records.js';
import { esc, fmtNum, fmtDate, plural, num, debounce } from '../core/utils.js';
import { selectHTML } from '../components/dropdown.js';
import { icon } from '../core/icons.js';
import { bookProgress } from '../core/stats.js';
import { pageHead, emptyState, addBtn, badge } from '../components/ui.js';
import { progressBar, ring } from '../components/charts.js';
import { openSheet } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { cover } from './gaming.js';

const ui = { status: 'All', sort: 'recent', q: '' };
const SORTS = [{ value: 'recent', label: 'Recently updated' }, { value: 'title', label: 'Title A–Z' }, { value: 'author', label: 'Author A–Z' }, { value: 'progress', label: 'Progress' }];
const ORDER = ['Reading', 'To read', 'Paused', 'Finished', 'Dropped'];
const KIND = { Reading: 'accent', Finished: 'pos', Paused: 'warn', Dropped: 'neg', 'To read': '' };
const hasPages = b => num(b.totalPages) > 0;

export const bookCover = (b, cls = '') => cover({ title: b.title, cover: b.cover }, cls);

function shelfCard(b) {
  const p = bookProgress(b);
  return `<a class="book-card" href="#/learning/${esc(b.id)}" aria-label="${esc(b.title)}, ${esc(b.status)}">
    <span class="book-cover">${bookCover(b)}${b.status !== 'Reading' ? `<span class="book-tag">${badge(b.status, KIND[b.status])}</span>` : ''}</span>
    <span class="book-meta"><b class="clamp-2">${esc(b.title)}</b><small class="trunc">${esc(b.author || (hasPages(b) ? `${fmtNum(b.currentPage)} / ${fmtNum(b.totalPages)} pages` : b.status))}</small>
    ${hasPages(b) && b.status !== 'To read' ? progressBar(p) : ''}</span></a>`;
}

const ledge = '<span class="shelf-ledge" aria-hidden="true"></span>';
const shelfItem = b => `<a class="shelf-item" href="#/learning/${esc(b.id)}" aria-label="${esc(b.title)}"><span class="book-cover">${bookCover(b)}</span><b class="clamp-2">${esc(b.title)}</b>${hasPages(b) && b.status !== 'To read' ? `<small>${Math.round(bookProgress(b))}%</small>` : `<small class="trunc">${esc(b.author || '')}</small>`}</a>`;
const shelf = (title, sub, list) => (list.length ? `<section class="shelf"><div class="sec-head tight"><div><h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div></div><div class="shelf-row">${list.map(shelfItem).join('')}</div>${ledge}</section>` : '');

function readingCard(b) {
  const known = hasPages(b), p = bookProgress(b), left = known ? Math.max(0, b.totalPages - num(b.currentPage)) : 0;
  return `<article class="reading-card card"><a class="rc-cover" href="#/learning/${esc(b.id)}" aria-label="Open ${esc(b.title)}"><span class="book-cover">${bookCover(b)}</span></a>
    <div class="rc-main"><a href="#/learning/${esc(b.id)}" class="rc-title"><b class="clamp-2">${esc(b.title)}</b><small class="trunc">${esc(b.author || 'Unknown author')}</small></a>
      <div class="rc-prog">${known ? progressBar(p) : ''}<span class="t-small t-num">${known ? `${fmtNum(b.currentPage)} of ${fmtNum(b.totalPages)} pages · ${fmtNum(left)} left` : `${fmtNum(b.currentPage)} pages read`}</span></div>
      <button class="btn btn-soft btn-sm" type="button" data-action="book-add" data-id="${esc(b.id)}">${icon('plus', { size: 15 })} Add pages</button></div></article>`;
}

const sorters = { recent: (a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''), title: (a, b) => a.title.localeCompare(b.title), author: (a, b) => String(a.author || '~').localeCompare(String(b.author || '~')) || a.title.localeCompare(b.title), progress: (a, b) => bookProgress(b) - bookProgress(a) };

function renderList() {
  const s = State.get(), books = s.books;
  const head = pageHead({ title: 'Books', sub: books.length ? plural(books.length, 'book') : 'Your bookshelf', actions: addBtn('book', 'Book') });
  if (!books.length) return `${head}<div class="card" style="--i:1">${emptyState({ icon: 'book', title: 'Your shelf is empty', text: 'Add what you are reading. Add pages as you go and progress follows.', action: addBtn('book', 'Add a book') })}</div>`;
  const q = ui.q.trim().toLowerCase();
  const reading = books.filter(b => b.status === 'Reading'), finished = books.filter(b => b.status === 'Finished');
  const pages = books.reduce((a, b) => a + num(b.currentPage), 0);
  const count = st => (st === 'All' ? books.length : books.filter(b => b.status === st).length);
  const matches = b => !q || `${b.title} ${b.author || ''}`.toLowerCase().includes(q);
  const filters = `<div class="chips" role="group" aria-label="Filter books">${['All', ...ORDER].map(st => `<button type="button" class="chip ${ui.status === st ? 'is-on' : ''}" aria-pressed="${ui.status === st}" data-action="book-filter" data-status="${st}">${st}<span class="count">${count(st)}</span></button>`).join('')}</div>`;
  const search = `<div class="search-field">${icon('search', { size: 18 })}<input type="search" class="input" placeholder="Search title or author" value="${esc(ui.q)}" data-input="bk-q" data-keep="bk-q" aria-label="Search books"></div>`;
  const grouped = ui.status === 'All' && !q;
  let body;
  if (grouped) {
    const by = st => books.filter(b => b.status === st).sort(sorters.recent);
    body = `${reading.length ? `<section><div class="sec-head tight"><div><h2>Currently reading</h2></div></div><div class="stack">${by('Reading').map(readingCard).join('')}</div></section>` : ''}
      ${shelf('Want to read', plural(by('To read').length, 'book'), by('To read'))}
      ${shelf('Completed', plural(finished.length, 'book'), by('Finished'))}
      ${shelf('On hold', '', [...by('Paused'), ...by('Dropped')])}`;
  } else {
    const list = books.filter(b => (ui.status === 'All' || b.status === ui.status) && matches(b)).sort(sorters[ui.sort] || sorters.recent);
    body = `<div class="between"><span class="t-small">${plural(list.length, 'book')}</span>${selectHTML({ value: ui.sort, options: SORTS, label: 'Sort books', compact: true, dataChange: 'bk-sort' })}</div>
      ${list.length ? `<div class="book-grid">${list.map(shelfCard).join('')}</div>` : `<div class="card">${emptyState({ icon: 'book', title: q ? 'No books match' : `No ${ui.status.toLowerCase()} books`, text: q ? 'Try a different title or author.' : 'Change a book’s status to move it here.' })}</div>`}`;
  }
  return `${head}<div class="stack-lg">
    <div class="trio" style="--i:1"><div class="card card-pad stat"><b>${reading.length}</b><span>Reading</span></div><div class="card card-pad stat"><b>${finished.length}</b><span>Finished</span></div><div class="card card-pad stat"><b>${fmtNum(pages)}</b><span>Pages logged</span></div></div>
    <div class="stack" style="--i:2">${search}${filters}</div>
    <div class="stack-lg" style="--i:3">${body}</div></div>`;
}

function renderDetail(id) {
  const b = find('book', id);
  if (!b) return `<div class="card">${emptyState({ icon: 'book', title: 'Book not found', text: 'It may have been deleted.', action: '<a class="btn btn-primary" href="#/learning">Back to Books</a>' })}</div>`;
  const known = hasPages(b), p = bookProgress(b), left = known ? Math.max(0, b.totalPages - num(b.currentPage)) : 0;
  return `<div class="book-detail"><div class="bd-cover" style="--i:0"><span class="book-cover">${bookCover(b)}</span></div>
    <div class="bd-main stack-lg"><header style="--i:1"><div class="row-gap">${badge(b.status, KIND[b.status])}${b.rating ? `<span class="rate">${icon('star', { size: 13 })}<b>${b.rating}</b><small>/5</small></span>` : ''}</div><h1 class="t-title mt-2">${esc(b.title)}</h1><p class="t-body">${esc(b.author || 'Unknown author')}</p></header>
      <section class="card card-pad" style="--i:2"><div class="between" style="align-items:center;gap:18px">${ring({ value: known ? p : 0, size: 96, stroke: 9, label: known || b.status === 'Finished' ? `${p}%` : '–', sub: 'read', title: known ? `${p} percent read` : 'Progress unknown' })}
        <div class="stack" style="gap:6px;flex:1;min-width:0"><p class="t-h2">${known ? `${fmtNum(b.currentPage)} of ${fmtNum(b.totalPages)} pages` : `${fmtNum(b.currentPage)} pages read`}</p>
        <p class="t-small">${known ? (b.status === 'Finished' ? 'Finished' : `${fmtNum(left)} pages to go`) : 'Add the total pages to see progress and pages remaining.'}</p></div></div>
        ${known ? `<div class="mt-4">${progressBar(p, b.status === 'Finished' ? 'is-pos' : '', { pct: true })}</div>` : ''}
        <div class="row-gap mt-4">${b.status !== 'Finished' ? `<button class="btn btn-primary" type="button" data-action="book-add" data-id="${esc(b.id)}">${icon('plus', { size: 18 })} Add pages</button>` : ''}${addBtn('book', known ? 'Edit' : 'Add total pages', { cls: 'btn', id: b.id })}</div></section>
      ${b.notes ? `<section class="card card-pad" style="--i:3"><h2 class="t-h2">Notes</h2><p class="t-body mt-2" style="white-space:pre-wrap">${esc(b.notes)}</p></section>` : ''}
      <dl class="kv card card-pad" style="--i:4"><div><dt>Started</dt><dd>${b.startedAt ? esc(fmtDate(b.startedAt, { day: 'numeric', month: 'short', year: 'numeric' })) : '—'}</dd></div><div><dt>Finished</dt><dd>${b.finishedAt ? esc(fmtDate(b.finishedAt, { day: 'numeric', month: 'short', year: 'numeric' })) : '—'}</dd></div></dl>
      <div style="--i:5"><button class="btn btn-danger" type="button" data-action="delete" data-type="book" data-id="${esc(b.id)}" data-back="#/learning">${icon('trash', { size: 18 })} Delete book</button></div></div></div>`;
}

function openAddPages(id) {
  const b = find('book', id); if (!b) return;
  const known = hasPages(b), cur = num(b.currentPage);
  const api = openSheet({ title: 'Add pages', subtitle: b.title, size: 'narrow',
    body: `<div class="seg" role="tablist" aria-label="Mode"><button type="button" class="is-on" data-mode="add" aria-pressed="true">Add pages</button><button type="button" data-mode="set" aria-pressed="false">Set page</button></div>
      <div class="field field-big mt-4"><label for="bp-n" id="bp-label">Pages read</label><input id="bp-n" type="number" inputmode="numeric" min="0" ${known ? `max="${b.totalPages}"` : ''} placeholder="0" data-autofocus></div>
      <div class="suggest mt-2" data-presets>${[10, 25, 50].map(n => `<button type="button" data-p="${n}">+${n}</button>`).join('')}</div>
      <p class="field-hint mt-3" id="bp-preview" aria-live="polite">Currently on page ${fmtNum(cur)}${known ? ` of ${fmtNum(b.totalPages)}` : ''}.</p><div class="field-error" role="alert" id="bp-err" hidden></div>`,
    footer: '<button class="btn btn-ghost" type="button" data-sheet-close>Cancel</button><button class="btn btn-primary" type="button" data-go>Save</button>' });
  let mode = 'add';
  const input = api.el.querySelector('#bp-n'), prev = api.el.querySelector('#bp-preview'), err = api.el.querySelector('#bp-err');
  const next = () => { const v = Math.max(0, Math.round(num(input.value))); const page = mode === 'add' ? cur + v : v; return known ? Math.min(page, b.totalPages) : page; };
  const draw = () => { const n = next(); prev.textContent = known ? `New page: ${fmtNum(n)} of ${fmtNum(b.totalPages)} · ${Math.round((n / b.totalPages) * 100)}%${n >= b.totalPages ? ' · finishes this book' : ''}` : `New page: ${fmtNum(n)}`; err.hidden = true; };
  input.addEventListener('input', draw);
  api.el.addEventListener('click', e => {
    const m = e.target.closest('[data-mode]'); if (m) { mode = m.dataset.mode; api.el.querySelectorAll('[data-mode]').forEach(x => { x.classList.toggle('is-on', x === m); x.setAttribute('aria-pressed', String(x === m)); }); api.el.querySelector('[data-presets]').hidden = mode === 'set'; api.el.querySelector('#bp-label').textContent = mode === 'add' ? 'Pages read' : 'Current page'; input.value = mode === 'set' ? cur : ''; draw(); }
    const p = e.target.closest('[data-p]'); if (p) { input.value = num(input.value) + Number(p.dataset.p); draw(); }
  });
  api.el.querySelector('[data-go]').addEventListener('click', () => {
    if (input.value === '' || num(input.value) < 0 || (mode === 'add' && !(num(input.value) > 0))) { err.hidden = false; err.textContent = 'Enter a number of pages.'; return; }
    if (known && mode === 'set' && num(input.value) > b.totalPages) { err.hidden = false; err.textContent = `This book has ${b.totalPages} pages.`; return; }
    const before = b.status; if (mode === 'add') addBookPages(id, input.value); else updateBookPage(id, input.value);
    api.close(); toast(find('book', id).status === 'Finished' && before !== 'Finished' ? 'Finished. Well read.' : 'Progress saved');
  });
}

const refreshBooks = debounce(() => emit('view:refresh'), 140);
registerInput({ 'bk-q'(el) { ui.q = el.value; refreshBooks(); } });
registerChange({ 'bk-sort'(el) { ui.sort = el.value; emit('view:refresh'); } });
registerActions({
  'book-filter'(el) { ui.status = el.dataset.status; emit('view:refresh'); },
  'book-add'(el) { openAddPages(el.dataset.id); }
});

export const route = {
  id: 'learning',
  render: parts => (parts[0] ? renderDetail(parts[0]) : renderList()),
  title: parts => (parts[0] ? find('book', parts[0])?.title || 'Book' : 'Books')
};
