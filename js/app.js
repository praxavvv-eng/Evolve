/* Evolve bootstrap.
 * Order: delegation -> load state (never overwrite unreadable data) -> appearance -> chrome -> routes -> router. */
import * as State from './core/state.js';
import { initDelegation, registerActions, on } from './core/events.js';
import { initAppearance } from './core/appearance.js';
import { checkProgress } from './core/xp.js';
import { icon, logo } from './core/icons.js';
import { navIcon } from './core/navicons.js';
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

const fam = () => State.get().settings.navIcons || 'outline';
function buildSidebar() {
  const sb = $('#sidebar');
  const link = (n, cls = 'sb-item') => `<a class="${cls}" href="#/${n.id}" data-nav="${n.id}" title="${esc(n.label)}"><span class="i-wrap">${navIcon(n.icon, fam(), 20)}</span><span>${esc(n.label)}</span></a>`;
  const hub = h => `<div class="sb-hub" data-hub="${h.id}"><a class="sb-item" href="#/${h.route}" data-hubnav="${h.id}" title="${esc(h.label)}"><span class="i-wrap">${navIcon(h.icon, fam(), 20)}</span><span>${esc(h.label)}</span></a>
    ${h.items.filter(x => x !== 'library').length > 1 ? `<div class="sb-children">${h.items.filter(x => x !== 'library').map(x => navById(x)).map(n => link(n, 'sb-sub')).join('')}</div>` : ''}</div>`;
  sb.innerHTML = `
    <div class="sb-brand"><span class="sb-logo">${logo(30)}</span><b class="sb-word">Evolve</b><span class="spacer"></span>
      <button class="icon-btn" type="button" data-action="sidebar-toggle" aria-label="Collapse sidebar" id="sbToggle">${icon('chevron-left', { size: 18 })}</button></div>
    <div class="sb-scroll">${HUBS.map(hub).join('')}</div>
    <div class="sb-foot">${MORE.map(id => link(navById(id))).join('')}</div>`;
}

function buildTabbar() {
  const tab = h => `<a class="tab" href="#/${h.route}" data-tab="${h.id}"><span class="tab-ico">${navIcon(h.icon, fam(), 24)}</span><span class="tab-lab">${esc(h.label)}</span></a>`;
  $('#tabbar').dataset.icons = fam(); $('#tabbar').innerHTML = `<span class="tab-indicator" id="tabInd" aria-hidden="true"></span>${HUBS.map(tab).join('')}`;
}

/** Reserve exactly the space the bar covers (measured, so safe areas and floating bars can never hide content). */
function reserveNavSpace() {
  const bar = $('#tabbar'), root = document.documentElement;
  if (!bar || !bar.offsetHeight || getComputedStyle(bar).display === 'none') { root.style.removeProperty('--nav-space'); return; }
  const r = bar.getBoundingClientRect();
  root.style.setProperty('--nav-space', `${Math.ceil(window.innerHeight - r.top + 28)}px`);
}

function moveIndicator() {
  const bar = $('#tabbar'), ind = $('#tabInd'), active = bar?.querySelector('.tab[aria-current="page"]');
  if (!ind) return;
  if (!active || !bar.offsetWidth) { ind.style.setProperty('--o', 0); return; }
  ind.style.setProperty('--w', `${active.offsetWidth}px`);
  ind.style.setProperty('--x', `${active.offsetLeft}px`);
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
  $('#topbar').classList.toggle('is-detail', detail);
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
  more(el) {
    const go = h => () => { location.hash = h; };
    openMenu(el, [
      { label: 'Insights', icon: 'chart', onClick: go('#/insights') },
      { label: 'Search', icon: 'search', onClick: () => openSearch() },
      'sep',
      { label: 'Appearance', icon: 'palette', onClick: go('#/settings/appearance') },
      { label: 'Navigation style', icon: 'dock', onClick: go('#/settings/navigation') },
      { label: 'Cloud sync', icon: 'cloud', onClick: go('#/settings/cloud') },
      { label: 'Settings', icon: 'sliders', onClick: go('#/settings') }
    ]);
  },
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
  if (res.status === 'corrupt') { renderRecovery(); document.getElementById('splash')?.remove(); return; }

  buildSidebar(); buildTabbar();
  $('#searchIcon').innerHTML = icon('search', { size: 19 });
  $('#searchPillIcon').innerHTML = icon('search', { size: 18 });
  $('#backBtn').innerHTML = icon('chevron-left', { size: 22 });
  $('#addPill').innerHTML = `${icon('plus', { size: 16 })} Add`;
  $('#moreBtn').innerHTML = icon('more', { size: 20 });
  $('#addIcon').innerHTML = icon('plus', { size: 20 });
  $('#topMark').innerHTML = `${logo(26)}<b>Evolve</b>`;
  if (State.get().ui.sidebarCollapsed) { $('#app').dataset.sidebar = 'collapsed'; $('#sbToggle').innerHTML = icon('chevron-right', { size: 18 }); }

  [home, plan, habits, academics, finance, fitness, gaming, learning, journal, goals, calendar, discipline, levels, insights, settings, library].forEach(Router.register);
  checkProgress({ quiet: true });

  const ui = State.get().ui;
  if (res.status === 'migrated' && !ui.migrationNoticeSeen) banner(`Your V${res.from} data was copied into this version. The original V6 data is untouched, so you can still open V6.`, { kind: 'is-info', dismiss: 'migrationNoticeSeen' });
  else if (res.status === 'fresh' && !ui.freshNoticeSeen) banner('Moving over from V6 on a different address? Export a backup from V6 and import it in Settings → Data.', { kind: 'is-info', dismiss: 'freshNoticeSeen' });
  if (res.status === 'unavailable') banner('Browser storage is unavailable here, so changes will be lost when you close this tab.');

  on('storage:error', d => banner(esc(d.message)));
  on('storage:ok', hideBanner);
  on('state:changed', () => checkProgress());

  Router.start($('#view'), { onRoute: updateChrome });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { moveIndicator(); reserveNavSpace(); });
  new ResizeObserver(reserveNavSpace).observe($('#tabbar'));
  requestAnimationFrame(reserveNavSpace);
  document.addEventListener('evolve:settings', () => {
    const f = fam(), bar = document.getElementById('tabbar');
    if (bar && bar.dataset.icons !== f) { buildSidebar(); buildTabbar(); bar.dataset.icons = f; Router.rerender(); }   // switch icon family without a reload
    requestAnimationFrame(() => { moveIndicator(); reserveNavSpace(); });
  });
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); }
  });

  requestAnimationFrame(() => requestAnimationFrame(() => { const sp = document.getElementById('splash'); if (sp) { sp.classList.add('is-out'); setTimeout(() => sp.remove(), 500); } }));
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('service-worker.js').catch(() => { /* offline support is optional */ });
}

try { boot(); } catch (e) { console.error('[boot] failed', e); document.getElementById('splash')?.remove(); throw e; }
setTimeout(() => document.getElementById('splash')?.remove(), 6000);   // safety net: never leave the splash covering the app
