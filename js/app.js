/* Evolve V7 bootstrap.
 * Order: delegation -> load state (never overwrite unreadable data) -> appearance -> chrome -> routes -> router. */
import * as State from './core/state.js';
import { initDelegation, registerActions, on } from './core/events.js';
import { initAppearance } from './core/appearance.js';
import { checkProgress } from './core/xp.js';
import { icon } from './core/icons.js';
import { esc, $, downloadFile, todayStr } from './core/utils.js';
import { HUBS, MORE, navById, hubOf } from './nav.js';
import * as Router from './router.js';
import { toast } from './components/toast.js';
import { confirmDialog } from './components/modal.js';
import { openMenu } from './components/dropdown.js';
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
import { route as library } from './modules/library.js';

/* ---------------- chrome: sidebar, tab bar, top bar ---------------- */
const lastIn = JSON.parse(sessionStorage.getItem('evolve_last_in_hub') || '{}');   // remembers the last screen used inside each destination

function buildSidebar() {
  const sb = $('#sidebar');
  const link = (n, cls = 'sb-item') => `<a class="${cls}" href="#/${n.id}" data-nav="${n.id}" title="${esc(n.label)}"><span class="i-wrap">${icon(n.icon, { size: 20 })}</span><span>${esc(n.label)}</span></a>`;
  const hub = h => `<div class="sb-hub" data-hub="${h.id}"><a class="sb-item" href="#/${h.route}" data-hubnav="${h.id}" title="${esc(h.label)}"><span class="i-wrap">${icon(h.icon, { size: 20 })}</span><span>${esc(h.label)}</span></a>
    ${h.items.filter(x => x !== 'library').length > 1 ? `<div class="sb-children">${h.items.filter(x => x !== 'library').map(x => navById(x)).map(n => link(n, 'sb-sub')).join('')}</div>` : ''}</div>`;
  sb.innerHTML = `
    <div class="sb-brand"><img src="assets/logo/mark.svg" alt="" width="34" height="34"><span class="spacer"></span>
      <button class="icon-btn" type="button" data-action="sidebar-toggle" aria-label="Collapse sidebar" id="sbToggle">${icon('chevron-left', { size: 18 })}</button></div>
    <div class="sb-scroll">${HUBS.map(hub).join('')}</div>
    <div class="sb-foot">${MORE.map(id => link(navById(id))).join('')}</div>`;
}

function buildTabbar() {
  const tab = h => `<a class="tab" href="#/${h.route}" data-tab="${h.id}"><span>${icon(h.icon, { size: 22 })}</span><span>${esc(h.label)}</span></a>`;
  $('#tabbar').innerHTML = `<span class="tab-indicator" id="tabInd"></span>${HUBS.map(tab).join('')}`;
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
  const hub = hubOf(id), hubId = hub?.id || '';
  if (hub && !parts.length) { lastIn[hub.id] = id; sessionStorage.setItem('evolve_last_in_hub', JSON.stringify(lastIn)); }
  document.querySelectorAll('.tab').forEach(t => {
    const h = HUBS.find(x => x.id === t.dataset.tab);
    t.setAttribute('href', `#/${h.id === 'library' ? 'library' : lastIn[h.id] || h.route}`);
    if (t.dataset.tab === hubId) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
  });
  document.querySelectorAll('.sb-hub').forEach(h => h.classList.toggle('is-open', h.dataset.hub === hubId));
  document.querySelectorAll('[data-hubnav]').forEach(t => { if (t.dataset.hubnav === hubId) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current'); });
  document.querySelectorAll('.sb-sub, .sb-foot .sb-item').forEach(t => { if (t.dataset.nav === id) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current'); });
  moveIndicator();
  const label = id === 'library' ? 'Library' : navById(id)?.label || '';
  const title = route.title?.(parts) || label;
  $('#topbarTitle').textContent = title;
  document.title = title && id !== 'home' ? `${title} · Evolve` : 'Evolve';
  const detail = parts.length > 0;
  const back = $('#backBtn'); back.hidden = !detail; $('#topMark').hidden = detail;
  back.dataset.to = `#/${id}`;
  onScroll();
}

function onScroll() {
  const y = window.scrollY;
  $('#topbar').classList.toggle('is-scrolled', y > 24);
}


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

/* ---------------- actions ---------------- */
registerActions({
  back(el) { location.hash = el.dataset.to || '#/home'; },
  search() { openSearch(); },
  more(el) { openMenu(el, [...MORE.map(id => ({ label: navById(id).label, icon: navById(id).icon, onClick: () => { location.hash = `#/${id}`; } })), 'sep', { label: 'Cloud sync', icon: 'cloud', onClick: () => { location.hash = '#/cloud'; } }]); },
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
  $('#moreBtn').innerHTML = icon('more', { size: 20 });
  $('#addIcon').innerHTML = icon('plus', { size: 22 });
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
