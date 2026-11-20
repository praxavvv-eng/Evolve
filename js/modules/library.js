/* Library landing: a personal collection overview. Collection tiles, "continue reading" and "now playing" for what is
 * in progress, shelves of covers and posters, and recent notes. Sections with no data are not shown. */
import * as State from '../core/state.js';
import { esc, fmtDate, plural, fmtNum, num } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { bookProgress, gameProgress } from '../core/stats.js';
import { addBtn } from '../components/ui.js';
import { progressBar } from '../components/charts.js';
import { bookCover } from './learning.js';
import { cover } from './gaming.js';

const shelfHead = (title, sub, href, add) => `<div class="sec-head tight"><div><h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div><div class="row-gap">${add}<a class="link-btn" href="${href}">See all ${icon('chevron-right', { size: 14 })}</a></div></div>`;
const recent = (a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '');

function render() {
  const s = State.get();
  const books = s.books.slice().sort((a, b) => (a.status === 'Reading' ? 0 : 1) - (b.status === 'Reading' ? 0 : 1) || recent(a, b)).slice(0, 8);
  const games = s.games.slice().sort((a, b) => (a.status === 'Playing' ? 0 : 1) - (b.status === 'Playing' ? 0 : 1) || recent(a, b)).slice(0, 8);
  const notes = s.notes.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 3);
  const reading = s.books.filter(b => b.status === 'Reading'), playing = s.games.filter(g => g.status === 'Playing');
  const rb = reading.sort(recent)[0], pg = playing.sort(recent)[0];
  const hours = s.games.reduce((a, g) => a + num(g.hours), 0), finished = s.books.filter(b => b.status === 'Finished').length;
  const empty = text => `<p class="shelf-empty">${esc(text)}</p>`;
  const tile = (href, ico, label, value, sub) => `<a class="card lib-tile" href="${href}"><span class="snap-ico">${icon(ico, { size: 18 })}</span><b class="t-num">${value}</b><span class="lt-label">${label}</span><small class="trunc">${esc(sub)}</small></a>`;

  return `<header class="page-head lib-head" style="--i:0"><div><h1 class="t-title">Library</h1><p class="t-body">Books, games and notes.</p></div></header>
    <div class="stack-lg">
      <div class="lib-tiles" style="--i:1">${tile('#/learning', 'book', 'Books', s.books.length, s.books.length ? `${finished} finished` : 'Start a shelf')}${tile('#/gaming', 'gamepad', 'Games', s.games.length, s.games.length ? `${fmtNum(hours, 0)} h played` : 'Start a library')}${tile('#/journal', 'notebook', 'Notes', s.notes.length, s.notes.length ? 'entries' : 'Write something')}</div>

      ${rb ? `<a class="card continue-card" href="#/learning/${esc(rb.id)}" style="--i:2"><span class="book-cover">${bookCover(rb)}</span><span class="cc-main"><span class="t-micro">Continue reading</span><b class="clamp-2">${esc(rb.title)}</b><small class="trunc">${esc(rb.author || '')}</small>${num(rb.totalPages) > 0 ? `${progressBar(bookProgress(rb))}<small class="t-num">${fmtNum(rb.currentPage)} of ${fmtNum(rb.totalPages)} pages</small>` : `<small class="t-num">${fmtNum(rb.currentPage)} pages read</small>`}</span></a>` : ''}
      ${pg ? `<a class="now-playing" href="#/gaming/${esc(pg.id)}" style="--i:2"><span class="np-art">${cover(pg)}</span><span class="np-shade"></span><span class="np-body"><span class="badge badge-accent">Now playing</span><b>${esc(pg.title)}</b><small>${esc(pg.platform)} · ${fmtNum(pg.hours, 1)} h${gameProgress(pg).value !== null ? ` · ${Math.round(gameProgress(pg).value)}%` : ''}</small></span></a>` : ''}

      <section data-shelf="books" style="--i:3">${shelfHead('Books', s.books.length ? `${reading.length} reading · ${plural(s.books.length, 'book')}` : '', '#/learning', addBtn('book', 'Add', { cls: 'btn btn-sm btn-soft' }))}
        ${books.length ? `<div class="shelf-row">${books.map(b => `<a class="shelf-item" href="#/learning/${esc(b.id)}" aria-label="${esc(b.title)}"><span class="book-cover">${bookCover(b)}</span><b class="clamp-2">${esc(b.title)}</b>${num(b.totalPages) > 0 && b.status !== 'To read' ? `<small>${Math.round(bookProgress(b))}%</small>` : `<small>${esc(b.status)}</small>`}</a>`).join('')}</div><span class="shelf-ledge" aria-hidden="true"></span>` : empty('Add the books you are reading or want to read.')}</section>

      <section data-shelf="games" style="--i:4">${shelfHead('Games', s.games.length ? `${playing.length} playing · ${plural(s.games.length, 'game')}` : '', '#/gaming', addBtn('game', 'Add', { cls: 'btn btn-sm btn-soft' }))}
        ${games.length ? `<div class="shelf-row">${games.map(g => `<a class="shelf-item is-poster" href="#/gaming/${esc(g.id)}" aria-label="${esc(g.title)}"><span class="poster">${cover(g)}</span><b class="clamp-2">${esc(g.title)}</b><small>${esc(g.status)}${num(g.hours) ? ` · ${fmtNum(g.hours, 1)} h` : ''}</small></a>`).join('')}</div>` : empty('Add the games you play or plan to play.')}</section>

      <section data-shelf="notes" style="--i:5">${shelfHead('Notes', s.notes.length ? plural(s.notes.length, 'entry', 'entries') : '', '#/journal', addBtn('note', 'Write', { cls: 'btn btn-sm btn-soft' }))}
        ${notes.length ? `<div class="card card-flush"><div class="list">${notes.map(n => `<a class="row note-row" href="#/journal/${esc(n.id)}"><span class="row-main"><span class="t-micro">${esc(n.kind)} · ${esc(fmtDate(n.date, { day: 'numeric', month: 'short' }))}</span><b class="row-title trunc">${esc(n.title)}</b><span class="row-sub clamp-2">${esc((n.body || '').replace(/\s+/g, ' ').slice(0, 120))}</span></span></a>`).join('')}</div></div>` : empty('Notes, ideas and journal entries live here.')}</section>
    </div>`;
}
export const route = { id: 'library', render };
