/* Evolve V7 bootstrap.
 * Order: delegation -> load state (never overwrite unreadable data) -> appearance -> chrome -> routes -> router. */
import * as State from './core/state.js';
import { initDelegation, registerActions, on } from './core/events.js';
import { initAppearance } from './core/appearance.js';
import { checkProgress } from './core/xp.js';
import { icon } from './core/icons.js';
import { esc, $, downloadFile, todayStr } from './core/utils.js';
import { NAV, GROUPS, navById } from './nav.js';
import * as Router from './router.js';
import { toast } from './components/toast.js';
import { confirmDialog } from './components/modal.js';
import './components/celebrate.js';
import './components/dropdown.js';
import './components/ui.js';
import { validateBackup } from './storage/backup.js';
import { openSearch, openQuickAdd } from './modules/search.js';

import { route as home } from './modules/home.js';
import { route as plan } from './modules/tasks.js';
import { route as habits } from './modules/habits.js';
import { route as academics } from './modules/academics.js';
import { route as finance } from './modules/finance.js';
import { route as fitness } from './modules/fitness.js';
import { route as gaming } from './modules/gaming.js';
import { route as learning } from './modules/learning.js';
import { route as journal } from './modules/journal.js';
import { route as goals } from './modules/goals.js';
import { route as calendar } from './modules/calendar.js';
import { route as discipline } from './modules/discipline.js';
import { route as levels } from './modules/levels.js';
import { route as insights } from './modules/insights.js';
import { route as settings } from './modules/settings.js';

/* ---------------- chrome: sidebar, tab bar, top bar ---------------- */
const TABS = ['home', 'plan', '__add', 'insights', 'library'];

function buildSidebar() {
  const sb = $('#sidebar');
  const item = n => `<a class="sb-item" href="#/${n.id}" data-nav="${n.id}" title="${esc(n.label)}"><span class="i-wrap">${icon(n.icon, { size: 20 })}</span><span>${esc(n.label)}</span></a>`;
  sb.innerHTML = `
    <div class="sb-brand"><img src="assets/logo/mark.svg" alt="" width="34" height="34"><span class="spacer"></span>
      <button class="icon-btn" type="button" data-action="sidebar-toggle" aria-label="Collapse sidebar" id="sbToggle">${icon('chevron-left', { size: 18 })}</button></div>
    <div class="sb-scroll">${GROUPS.filter(g => g !== 'System').map(g => `<div class="sb-group"><div class="sb-label">${g}</div>${NAV.filter(n => n.group === g).map(item).join('')}</div>`).join('')}</div>
    <div class="sb-foot">${NAV.filter(n => n.group === 'System').map(item).join('')}</div>`;
}

function buildTabbar() {
  const tab = id => {
    if (id === '__add') return `<button class="tab-add" type="button" data-action="quick-add" aria-label="Quick add"><span class="fab">${icon('plus', { size: 26 })}</span></button>`;
    const n = id === 'library' ? { id: 'library', label: 'Library', icon: 'grid' } : navById(id);
    return `<a class="tab" href="#/${n.id}" data-tab="${n.id}"><span>${icon(n.icon, { size: 22 })}</span><span>${esc(n.label)}</span></a>`;
  };
  $('#tabbar').innerHTML = `<span class="tab-indicator" id="tabInd"></span>${TABS.map(tab).join('')}`;
}

function moveIndicator() {
  const bar = $('#tabbar'), ind = $('#tabInd'), active = bar.querySelector('.tab[aria-current="page"]');
  if (!active || !bar.offsetWidth) { ind.style.setProperty('--o', 0); return; }
  const inset = 4;
  ind.style.setProperty('--w', `${active.offsetWidth - inset * 2}px`);
  ind.style.setProperty('--x', `${active.offsetLeft + inset}px`);
  ind.style.setProperty('--o', 1);
}

function updateChrome({ id, parts, route }) {
  const tabId = TABS.includes(id) ? id : 'library';
  document.querySelectorAll('.tab').forEach(t => { if (t.dataset.tab === tabId) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current'); });
  document.querySelectorAll('.sb-item').forEach(t => { if (t.dataset.nav === id) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current'); });
  moveIndicator();
  const label = id === 'library' ? 'Library' : navById(id)?.label || '';
  const title = route.title?.(parts) || label;
  $('#topbarTitle').textContent = title;
  document.title = title && title !== 'Home' ? `${title} · Evolve` : 'Evolve';
  const detail = parts.length > 0;
  const back = $('#backBtn'); back.hidden = !detail; $('#topMark').hidden = detail;
  back.dataset.to = `#/${id}`;
  onScroll();
}

function onScroll() { $('#topbar').classList.toggle('is-scrolled', window.scrollY > 24); }

/* ---------------- banners ---------------- */
function banner(html, { kind = '', dismiss = '' } = {}) {
  const el = $('#banner');
  el.className = `banner ${kind}`; el.hidden = false;
  el.innerHTML = `${icon(kind === 'is-info' ? 'info' : 'alert', { size: 18 })}<div>${html}</div>${dismiss ? `<button type="button" data-action="dismiss-banner" data-flag="${dismiss}">Dismiss</button>` : ''}`;
}
const hideBanner = () => { $('#banner').hidden = true; };

/* ---------------- recovery screen (unreadable stored data) ---------------- */
function renderRecovery() {
  const info = State.loadInfo;
  $('#sidebar').hidden = true; $('#tabbar').hidden = true; $('#topbar').hidden = true;
  $('#view').innerHTML = `<div class="stack" style="max-width:560px;margin:8vh auto 0">
    <div class="empty-art" style="align-self:flex-start">${icon('alert', { size: 28 })}</div>
    <h1 class="t-title">Your saved data could not be read</h1>
    <p class="t-body">Evolve found data from ${esc(info.source || 'a previous version')}, but it looks damaged (${esc(info.error)}). Nothing has been changed or deleted, and Evolve will not overwrite it until you decide.</p>
    <div class="card card-pad stack">
      <button class="btn btn-primary" type="button" data-action="recover-download">${icon('download', { size: 18 })} Download the raw data</button>
      <label class="btn" for="recoverFile">${icon('upload', { size: 18 })} Restore from a backup file</label>
      <input class="sr-only" id="recoverFile" type="file" accept=".json,application/json" data-recover-file>
      <button class="btn btn-ghost" type="button" data-action="recover-empty">Start with an empty workspace</button>
    </div>
    <p class="t-small">Starting empty keeps a copy of the unreadable data in this browser, so a developer or a later version can still try to recover it.</p></div>`;
  registerActions({
    'recover-download': () => downloadFile(`evolve-unreadable-data-${todayStr()}.txt`, info.raw || '', 'text/plain'),
    async 'recover-empty'() {
      if (!await confirmDialog({ title: 'Start with an empty workspace?', message: 'The unreadable data stays stored in this browser as a recovery copy, but the app will use a new empty workspace.', confirmLabel: 'Start empty', danger: true })) return;
      try { State.startEmpty(); location.reload(); } catch (e) { toast(e.message, { type: 'error' }); }
    }
  });
  document.addEventListener('change', async e => {
    const f = e.target.closest('[data-recover-file]'); if (!f || !f.files[0]) return;
    const res = validateBackup(await f.files[0].text());
    if (!res.ok) { toast(res.error, { type: 'error' }); return; }
    try { State.replaceAll(res.state, { keepSnapshot: false }); toast('Backup restored'); setTimeout(() => location.reload(), 600); } catch (err) { toast(err.message, { type: 'error' }); }
  });
}

/* ---------------- library page (phones) ---------------- */
const library = {
  id: 'library',
  render() {
    const tile = n => `<a class="lib-tile" href="#/${n.id}"><span class="lib-icon">${icon(n.icon, { size: 22 })}</span><span><b>${esc(n.label)}</b><small>${esc(n.blurb)}</small></span></a>`;
    return `<header class="page-head"><div><h1 class="t-title">Library</h1><p class="t-body">Everything in one place.</p></div></header>
      ${GROUPS.map(g => `<section class="lib-group"><h2 class="t-micro" style="margin:0 4px 10px">${g}</h2><div class="lib-grid">${NAV.filter(n => n.group === g).map(tile).join('')}</div></section>`).join('')}`;
  }
};

/* ---------------- actions ---------------- */
registerActions({
  back(el) { location.hash = el.dataset.to || '#/home'; },
  search() { openSearch(); },
  'quick-add'() { openQuickAdd(); },
  'sidebar-toggle'() {
    const app = $('#app'), collapsed = app.dataset.sidebar !== 'collapsed';
    app.dataset.sidebar = collapsed ? 'collapsed' : 'expanded';
    $('#sbToggle').innerHTML = icon(collapsed ? 'chevron-right' : 'chevron-left', { size: 18 });
    $('#sbToggle').setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    State.update(s => { s.ui.sidebarCollapsed = collapsed; }, { silent: true });
  },
  'dismiss-banner'(el) { State.update(s => { s.ui[el.dataset.flag] = true; }, { silent: true }); hideBanner(); }
});

/* ---------------- boot ---------------- */
function boot() {
  initDelegation();
  const res = State.init();
  initAppearance();
  if (res.status === 'corrupt') { renderRecovery(); return; }

  buildSidebar(); buildTabbar();
  $('#searchIcon').innerHTML = icon('search', { size: 20 });
  $('#searchPillIcon').innerHTML = icon('search', { size: 18 });
  $('#backBtn').innerHTML = icon('chevron-left', { size: 22 });
  $('#addPill').innerHTML = `${icon('plus', { size: 16 })} Add`;
  if (State.get().ui.sidebarCollapsed) { $('#app').dataset.sidebar = 'collapsed'; $('#sbToggle').innerHTML = icon('chevron-right', { size: 18 }); }

  [home, plan, habits, academics, finance, fitness, gaming, learning, journal, goals, calendar, discipline, levels, insights, settings, library].forEach(Router.register);
  checkProgress({ quiet: true });

  const ui = State.get().ui;
  if (res.status === 'migrated' && !ui.migrationNoticeSeen) banner(`Your V${res.from} data was copied into V7. The original V6 data is untouched, so you can still open V6.`, { kind: 'is-info', dismiss: 'migrationNoticeSeen' });
  else if (res.status === 'fresh' && !ui.freshNoticeSeen) banner('Moving over from V6 on a different address? Export a backup from V6 and import it in Settings → Data.', { kind: 'is-info', dismiss: 'freshNoticeSeen' });
  if (res.status === 'unavailable') banner('Browser storage is unavailable here, so changes will be lost when you close this tab.');

  on('storage:error', d => banner(esc(d.message)));
  on('storage:ok', hideBanner);
  on('state:changed', () => checkProgress());

  Router.start($('#view'), { onRoute: updateChrome });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', moveIndicator);
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); }
  });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('service-worker.js').catch(() => { /* offline support is optional */ });
}

boot();
