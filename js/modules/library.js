/* Library landing: three shelves, each previewing its own content in its own way.
 * Books and Games show covers; Notes show readable lines. Everything else lives one tap away. */
import * as State from '../core/state.js';
import { esc, fmtDate, plural, fmtNum, num } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { bookProgress } from '../core/stats.js';
import { addBtn } from '../components/ui.js';
import { bookCover } from './learning.js';
import { cover } from './gaming.js';

const shelfHead = (title, sub, href, add) => `<div class="shelf-head"><div><h2>${esc(title)}</h2><p>${esc(sub)}</p></div><div class="row-gap">${add}<a class="link-btn" href="${href}">See all ${icon('chevron-right', { size: 14 })}</a></div></div>`;

function render() {
  const s = State.get();
  const books = s.books.slice().sort((a, b) => (a.status === 'Reading' ? 0 : 1) - (b.status === 'Reading' ? 0 : 1) || (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '')).slice(0, 8);
  const games = s.games.slice().sort((a, b) => (a.status === 'Playing' ? 0 : 1) - (b.status === 'Playing' ? 0 : 1) || (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '')).slice(0, 8);
  const notes = s.notes.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 3);
  const reading = s.books.filter(b => b.status === 'Reading').length, playing = s.games.filter(g => g.status === 'Playing').length;
  const empty = text => `<p class="shelf-empty">${esc(text)}</p>`;

  return `<header class="page-head lib-head" style="--i:0"><div><h1 class="t-title">Library</h1><p class="t-body">Books, games and notes.</p></div></header>
    <div class="stack-xl">
      <section data-shelf="books" style="--i:1">${shelfHead('Books', s.books.length ? `${reading} reading · ${plural(s.books.length, 'book')}` : 'Your bookshelf', '#/learning', addBtn('book', 'Add', { cls: 'btn btn-sm btn-soft' }))}
        ${books.length ? `<div class="shelf-row">${books.map(b => `<a class="shelf-item" href="#/learning/${esc(b.id)}" aria-label="${esc(b.title)}"><span class="book-cover">${bookCover(b)}</span><b class="clamp-2">${esc(b.title)}</b>${num(b.totalPages) > 0 && b.status !== 'To read' ? `<small>${bookProgress(b)}%</small>` : `<small>${esc(b.status)}</small>`}</a>`).join('')}</div>` : empty('Add a book to start your shelf.')}</section>
      <section data-shelf="games" style="--i:2">${shelfHead('Games', s.games.length ? `${playing} playing · ${plural(s.games.length, 'game')}` : 'Your game collection', '#/gaming', addBtn('game', 'Add', { cls: 'btn btn-sm btn-soft' }))}
        ${games.length ? `<div class="shelf-row">${games.map(g => `<a class="shelf-item is-poster" href="#/gaming/${esc(g.id)}" aria-label="${esc(g.title)}"><span class="poster">${cover(g)}</span><b class="clamp-2">${esc(g.title)}</b><small>${esc(g.status)}${num(g.hours) ? ` · ${fmtNum(g.hours, 1)} h` : ''}</small></a>`).join('')}</div>` : empty('Add the games you play or plan to play.')}</section>
      <section data-shelf="notes" style="--i:3">${shelfHead('Notes', s.notes.length ? plural(s.notes.length, 'entry', 'entries') : 'Notes and journal', '#/journal', addBtn('note', 'Write', { cls: 'btn btn-sm btn-soft' }))}
        ${notes.length ? `<div class="note-lines">${notes.map(n => `<a class="note-line" href="#/journal/${esc(n.id)}"><span class="t-micro">${esc(n.kind)} · ${esc(fmtDate(n.date, { day: 'numeric', month: 'short' }))}</span><b class="trunc">${esc(n.title)}</b><span class="clamp-2">${esc((n.body || '').replace(/\s+/g, ' ').slice(0, 160))}</span></a>`).join('')}</div>` : empty('Write a note or a few lines about your day.')}</section>
    </div>`;
}
export const route = { id: 'library', render };
