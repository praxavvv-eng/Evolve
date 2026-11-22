/* Gaming: a visual game library. Real cover art only if the person chose an image; otherwise a designed,
 * deterministic placeholder (never fake artwork). Detail view shows status history recorded by the app. */
import * as State from '../core/state.js';
import { registerActions, registerChange, emit } from '../core/events.js';
import { saveRecord, find } from '../core/records.js';
import { esc, hashStr, initials, fmtNum, fmtDate, plural, num } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { pageHead, emptyState, addBtn, badge } from '../components/ui.js';
import { selectHTML } from '../components/dropdown.js';
import { progressBar } from '../components/charts.js';
import { gameProgress } from '../core/stats.js';
import { OPTIONS } from '../core/schemas.js';
import { toast } from '../components/toast.js';

const ui = { status: 'All', sort: 'recent' };
const recent = (a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '');
const PALETTES = [['#17323a', '#2f6f73'], ['#3a2314', '#a2622f'], ['#16263b', '#43698f'], ['#3a1a1c', '#9b4a46'], ['#1d3321', '#4f8458'], ['#262a33', '#6b7587'], ['#3a2f14', '#a8893a'], ['#1a3330', '#3f8f80']];
const STATUS_KIND = { Playing: 'accent', Completed: 'pos', Backlog: '', 'On hold': 'warn', Dropped: 'neg' };
const SORTS = [{ value: 'recent', label: 'Recently updated' }, { value: 'title', label: 'Title A–Z' }, { value: 'hours', label: 'Most played' }, { value: 'rating', label: 'Highest rated' }];

export function cover(g, cls = '') {
  const [a, b] = PALETTES[hashStr(g.title) % PALETTES.length];
  const art = g.cover ? `<img src="${esc(g.cover)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : '';
  return `<div class="cover ${cls}" style="--c1:${a};--c2:${b}"><span class="cover-initials" aria-hidden="true">${esc(initials(g.title))}</span>${art}</div>`;
}

/** Landscape artwork for featured areas. Uses the landscape image when there is one. Otherwise the poster is shown undistorted
 *  over a blurred, darkened copy of itself, or a designed gradient when there is no image at all. */
export function heroArt(g) {
  if (g.banner) return `<div class="hero-art has-banner"><img class="ha-img" src="${esc(g.banner)}" alt="" loading="lazy" decoding="async" onerror="this.remove()"></div>`;
  if (g.cover) return `<div class="hero-art is-fallback"><img class="ha-blur" src="${esc(g.cover)}" alt="" decoding="async" onerror="this.remove()"><img class="ha-poster" src="${esc(g.cover)}" alt="" decoding="async" onerror="this.remove()"></div>`;
  return `<div class="hero-art">${cover(g)}</div>`;
}

const stars = r => (num(r) ? `<span class="rate">${icon('star', { size: 13 })}<b>${num(r)}</b><small>/10</small></span>` : '');

function card(g) {
  return `<a class="game-card" href="#/gaming/${esc(g.id)}" aria-label="${esc(g.title)}, ${esc(g.status)}">
    ${cover(g)}<div class="game-top">${badge(g.status, STATUS_KIND[g.status])}${stars(g.rating)}</div>
    <div class="game-info"><h3 class="trunc">${esc(g.title)}</h3><p class="trunc">${esc(g.platform)}${num(g.hours) ? ` · ${fmtNum(g.hours, 1)} h` : ''}</p>${(() => { const p = gameProgress(g); return p.value !== null && g.status !== 'Completed' ? progressBar(p.value) : ''; })()}</div></a>`;
}

/** Full-width cinematic banner for the game being played right now. */
function hero(g) {
  const p = gameProgress(g);
  return `<article class="game-hero"><div class="gh-art">${heroArt(g)}</div><div class="gh-shade"></div>
    <a class="gh-link" href="#/gaming/${esc(g.id)}" aria-label="Open ${esc(g.title)}"></a>
    <div class="gh-body"><span class="badge badge-accent">Now playing</span><h2>${esc(g.title)}</h2><p>${esc(g.platform)} · ${fmtNum(g.hours, 1)} h played${num(g.estimatedHours) > 0 ? ` of about ${fmtNum(g.estimatedHours, 1)} h` : ''}</p>
      ${p.value !== null ? `<div class="gh-prog">${progressBar(p.value)}<b class="t-num">${Math.round(p.value)}%</b></div>` : ''}
      <div class="row-gap"><button class="btn btn-sm gh-btn" type="button" data-action="game-time" data-id="${esc(g.id)}" data-h="0.5">+30 min</button><button class="btn btn-sm gh-btn" type="button" data-action="game-time" data-id="${esc(g.id)}" data-h="1">+1 h</button><button class="btn btn-sm gh-btn" type="button" data-action="game-time" data-id="${esc(g.id)}" data-h="2">+2 h</button></div></div></article>`;
}
const posterItem = g => `<a class="shelf-item is-poster" href="#/gaming/${esc(g.id)}" aria-label="${esc(g.title)}"><span class="poster">${cover(g)}</span><b class="clamp-2">${esc(g.title)}</b><small class="trunc">${esc(g.platform)}${num(g.hours) ? ` · ${fmtNum(g.hours, 1)} h` : ''}</small></a>`;
const posterShelf = (title, sub, list) => (list.length ? `<section><div class="sec-head tight"><div><h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div></div><div class="shelf-row">${list.map(posterItem).join('')}</div></section>` : '');

function renderList() {
  const s = State.get(), games = s.games;
  const totalH = games.reduce((a, g) => a + num(g.hours), 0);
  const head = pageHead({ title: 'Gaming', sub: games.length ? `${plural(games.length, 'game')} · ${fmtNum(totalH, 1)} hours` : 'Your game library', actions: addBtn('game', 'Game') });
  if (!games.length) return `${head}<div class="card" style="--i:1">${emptyState({ icon: 'gamepad', title: 'Your library is empty', text: 'Add the games you play, plan to play or have finished. Posters are optional.', action: addBtn('game', 'Add a game') })}</div>`;
  const count = st => (st === 'All' ? games.length : games.filter(g => g.status === st).length);
  const filters = `<div class="chips" role="group" aria-label="Filter by status">${['All', ...OPTIONS.gameStatus].map(st => `<button type="button" class="chip ${ui.status === st ? 'is-on' : ''}" aria-pressed="${ui.status === st}" data-action="game-filter" data-status="${st}">${st}<span class="count">${count(st)}</span></button>`).join('')}</div>`;
  const playing = games.filter(g => g.status === 'Playing').sort(recent), backlog = games.filter(g => g.status === 'Backlog').sort(recent), done = games.filter(g => g.status === 'Completed').sort(recent);
  const recentlyPlayed = games.filter(g => g.status !== 'Playing' && num(g.hours) > 0).sort(recent).slice(0, 8);
  const remaining = games.filter(g => g.status !== 'Completed' && g.status !== 'Dropped' && num(g.estimatedHours) > 0).reduce((a, g) => a + Math.max(0, num(g.estimatedHours) - num(g.hours)), 0);
  let body;
  if (ui.status === 'All') {
    body = `${playing[0] ? hero(playing[0]) : ''}
      ${posterShelf('Currently playing', '', playing.slice(playing[0] ? 1 : 0))}
      ${posterShelf('Recently played', '', recentlyPlayed)}
      ${posterShelf('Backlog', plural(backlog.length, 'game'), backlog)}
      ${posterShelf('Completed', plural(done.length, 'game'), done)}
      ${posterShelf('On hold', '', games.filter(g => g.status === 'On hold').sort(recent))}
      ${posterShelf('Dropped', '', games.filter(g => g.status === 'Dropped').sort(recent))}`;
  } else {
    let list = games.filter(g => g.status === ui.status);
    const cmp = { recent, title: (a, b) => a.title.localeCompare(b.title), hours: (a, b) => num(b.hours) - num(a.hours), rating: (a, b) => num(b.rating) - num(a.rating) }[ui.sort] || recent;
    list = list.slice().sort(cmp);
    body = `<div class="between"><span class="t-small">${plural(list.length, 'game')}</span>${selectHTML({ value: ui.sort, options: SORTS, label: 'Sort games', compact: true, dataChange: 'game-sort' })}</div>
      ${list.length ? `<div class="game-grid">${list.map(card).join('')}</div>` : `<div class="card">${emptyState({ icon: 'gamepad', title: `Nothing in ${ui.status}`, text: 'Change a game’s status to move it here.' })}</div>`}`;
  }
  return `${head}<div class="stack-lg gaming-page">
    <div class="trio" style="--i:1"><div class="card card-pad stat"><b>${fmtNum(totalH, 0)}<small> h</small></b><span>Total playtime</span></div><div class="card card-pad stat"><b>${done.length}</b><span>Completed</span></div><div class="card card-pad stat"><b>${remaining ? `${fmtNum(remaining, 0)}<small> h</small>` : '–'}</b><span>Est. left to play</span></div></div>
    <div style="--i:2">${filters}</div><div class="stack-lg" style="--i:3">${body}</div></div>`;
}

function progressBlock(g) {
  const p = gameProgress(g);
  if (p.source === 'completed') return `<div><div class="between"><span class="field-label">Progress</span><b class="t-num pos">100%</b></div><div class="mt-2">${progressBar(100, 'is-pos')}</div><p class="field-hint mt-2">Marked completed.</p></div>`;
  if (p.source === 'estimate' && p.value >= 100) return `<div><div class="between"><span class="field-label">Playtime progress</span><b class="t-num">100%</b></div><div class="mt-2">${progressBar(100)}</div><p class="field-hint mt-2">${fmtNum(p.hours, 1)} h reached the estimated ${fmtNum(p.est, 1)} h. This is playtime progress, not story completion.</p><div class="mt-2"><button class="btn btn-sm btn-soft" type="button" data-action="game-complete" data-id="${esc(g.id)}">Mark as completed</button></div></div>`;
  if (p.source === 'estimate') return `<div><div class="between"><span class="field-label">Playtime progress</span><b class="t-num">${Math.round(p.value)}%</b></div><div class="mt-2">${progressBar(p.value)}</div><p class="field-hint mt-2">${fmtNum(p.hours, 1)} h of an estimated ${fmtNum(p.est, 1)} h. This is playtime progress, not story completion.</p></div>`;
  if (p.source === 'manual') return `<div><div class="between"><span class="field-label">Progress (manual)</span><b class="t-num">${Math.round(p.value)}%</b></div><div class="mt-2">${progressBar(p.value)}</div><p class="field-hint mt-2">Set by hand. ${addBtn('game', 'Add an estimated total', { cls: 'link-btn', id: g.id })} to calculate it from playtime.</p></div>`;
  return `<div class="progress-unset"><div class="between"><span class="field-label">Progress</span><span class="t-small">Not set</span></div><p class="t-small mt-2">Add the estimated total hours to see progress from your playtime.</p><div class="mt-2">${addBtn('game', 'Add estimated hours', { cls: 'btn btn-sm btn-soft', id: g.id })}</div></div>`;
}

function renderDetail(id) {
  const g = find('game', id);
  if (!g) return `<div class="card">${emptyState({ icon: 'gamepad', title: 'Game not found', text: 'It may have been deleted.', action: '<a class="btn btn-primary" href="#/gaming">Back to library</a>' })}</div>`;
  const hist = (g.history || []).slice().reverse();
  const facts = [['Platform', g.platform], ['Playtime', `${fmtNum(g.hours, 1)} h`], ...(num(g.estimatedHours) > 0 ? [['Estimated total', `${fmtNum(g.estimatedHours, 1)} h`]] : []), ['Rating', num(g.rating) ? `${num(g.rating)} / 10` : 'Not rated'], ['Started', g.startedAt ? fmtDate(g.startedAt, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'], ['Finished', g.finishedAt ? fmtDate(g.finishedAt, { day: 'numeric', month: 'short', year: 'numeric' }) : '—']];
  return `<div class="gd-banner" style="--i:0">${heroArt(g)}<span class="gd-shade"></span></div>
  <div class="game-detail"><div class="gd-cover" style="--i:0">${cover(g)}</div>
    <div class="gd-main stack-lg"><header style="--i:1"><div class="row-gap">${badge(g.status, STATUS_KIND[g.status])}${stars(g.rating)}</div><h1 class="t-title mt-2">${esc(g.title)}</h1><p class="t-body">${esc(g.platform)}</p></header>
      <section class="card card-pad stack" style="--i:2"><div class="between"><span class="field-label">Status</span>${selectHTML({ value: g.status, options: OPTIONS.gameStatus, label: 'Change status', compact: true, dataChange: 'game-status', extra: `data-id="${esc(g.id)}"` })}</div>
        ${progressBlock(g)}
        <div class="between"><span class="field-label">Playtime</span><div class="row-gap"><b class="t-num">${fmtNum(g.hours, 1)} h</b><button class="btn btn-sm btn-ghost" type="button" data-action="form" data-type="game" data-id="${esc(g.id)}" aria-label="Edit logged hours">${icon('edit', { size: 14 })}</button><button class="btn btn-sm" type="button" data-action="game-hours" data-id="${esc(g.id)}" data-add="0.5">+30 min</button><button class="btn btn-sm" type="button" data-action="game-hours" data-id="${esc(g.id)}" data-add="1">+1 h</button></div></div></section>
      <section class="card card-pad" style="--i:3"><dl class="kv">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></section>
      ${g.notes ? `<section class="card card-pad" style="--i:4"><h2 class="t-h2">Notes</h2><p class="t-body mt-2" style="white-space:pre-wrap">${esc(g.notes)}</p></section>` : ''}
      ${hist.length ? `<section class="card card-flush" style="--i:5"><div class="panel-head"><div><h2>History</h2><p>Status changes recorded by the app</p></div></div><div class="list">${hist.map(h => `<div class="row"><span class="row-main"><span class="row-title">${esc(h.status)}</span></span><span class="row-end t-small">${esc(fmtDate(h.date, { day: 'numeric', month: 'short', year: 'numeric' }))}</span></div>`).join('')}</div></section>` : ''}
      <div class="row-gap" style="--i:6">${addBtn('game', 'Edit game', { cls: 'btn btn-primary', id: g.id })}<button class="btn btn-danger" type="button" data-action="delete" data-type="game" data-id="${esc(g.id)}" data-back="#/gaming">${icon('trash', { size: 18 })} Delete</button></div></div></div>`;
}

registerActions({
  'game-time'(el) {
    const g = find('game', el.dataset.id); if (!g) return;
    const res = saveRecord('game', { ...g, hours: Math.round((num(g.hours) + Number(el.dataset.h)) * 100) / 100 }, g.id);
    if (res.ok) toast(`Logged ${Number(el.dataset.h) === 0.5 ? '30 min' : `${el.dataset.h} h`} of ${g.title}`, { xp: res.xp });
  },
  'game-complete'(el) { const g = find('game', el.dataset.id); if (g && saveRecord('game', { ...g, status: 'Completed' }, g.id).ok) toast('Marked as completed'); },
  'game-filter'(el) { ui.status = el.dataset.status; emit('view:refresh'); },
  'game-hours'(el) {
    const g = find('game', el.dataset.id); if (!g) return;
    const res = saveRecord('game', { ...g, hours: num(g.hours) + Number(el.dataset.add) }, g.id);
    if (res.ok) toast('Playtime updated');
  }
});
registerChange({
  'game-sort'(el) { ui.sort = el.value; emit('view:refresh'); },
  'game-status'(el) {
    const g = find('game', el.dataset.id); if (!g || g.status === el.value) return;
    const res = saveRecord('game', { ...g, status: el.value }, g.id);
    if (res.ok) toast(`Moved to ${el.value}`, { xp: res.xp });
  }
});

export const route = {
  id: 'gaming',
  render: parts => (parts[0] ? renderDetail(parts[0]) : renderList()),
  title: parts => (parts[0] ? find('game', parts[0])?.title || 'Game' : 'Gaming')
};
