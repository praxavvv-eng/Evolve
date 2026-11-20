/* Settings: Appearance, preferences, data safety (backup, import with validation, undo import, trash, reset) and About. */
import * as State from '../core/state.js';
import { registerActions, registerChange, registerInput, emit } from '../core/events.js';
import { setSetting, accentHex } from '../core/appearance.js';
import { restoreTrash, purgeTrash } from '../core/records.js';
import { schemas } from '../core/schemas.js';
import { ACCENTS, freshSettings, freshState, summarize, SCHEMA_VERSION } from '../storage/migration.js';
import { exportBackupFile, validateBackup } from '../storage/backup.js';
import { storageEstimate } from '../storage/storage.js';
import { health } from '../core/syncstatus.js';
import { esc, downloadFile, todayStr, fmtDate, fmtNum, hexToHsl, hslToHex } from '../core/utils.js';
import { icon, logo } from '../core/icons.js';
import { pageHead } from '../components/ui.js';
import { selectHTML } from '../components/dropdown.js';
import { openSheet, confirmDialog } from '../components/modal.js';
import { toast } from '../components/toast.js';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'JPY', 'CAD', 'AUD', 'SGD'].map(c => ({ value: c, label: c }));
const seg = (key, current, options) => `<div class="seg" role="group" aria-label="${esc(key)}">${options.map(([v, l, ic]) => `<button type="button" class="${String(current) === String(v) ? 'is-on' : ''}" aria-pressed="${String(current) === String(v)}" data-action="set-pref" data-key="${key}" data-value="${v}">${ic ? icon(ic, { size: 16 }) : ''}${l}</button>`).join('')}</div>`;
const rowSet = (label, hint, control) => `<div class="set-row"><div class="set-label"><b>${esc(label)}</b>${hint ? `<small>${esc(hint)}</small>` : ''}</div><div class="set-ctl">${control}</div></div>`;

const ui = { customOpen: false };
const STATUS = { off: 'Cloud sync is not connected', connecting: 'Connecting…', idle: 'Up to date', syncing: 'Syncing…', offline: 'Offline. Changes are kept on this device', error: 'Needs attention', conflict: 'Merged changes from another device' };
function healthBlock() {
  const when = ms => new Date(ms).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  return `<div class="health"><div class="health-row"><span class="dot is-${esc(health.status)}"></span><b>${esc(STATUS[health.status] || health.status)}</b><a class="link-btn" href="#/cloud">Cloud sync ${icon('chevron-right', { size: 14 })}</a></div>
    <dl class="kv"><div><dt>Last successful sync</dt><dd>${health.lastOk ? esc(when(health.lastOk)) : 'Not synced yet'}</dd></div>${health.lastError ? `<div><dt>Last problem</dt><dd>${esc(health.lastError)}<br><span class="t-small">${health.lastErrorAt ? esc(when(health.lastErrorAt)) : ''}</span></dd></div>` : ''}</dl></div>`;
}
document.addEventListener('evolve:sync', () => { if (location.hash.startsWith('#/settings')) emit('view:refresh'); });
const MODES = [['light', 'Light'], ['dark', 'Dark'], ['system', 'System']];
const STYLES = [['minimal', 'Minimal', 'Clean, flat and spacious'], ['glass', 'Glass', 'Translucent, layered materials'], ['cinematic', 'Cinematic', 'Depth and atmosphere'], ['classic', 'Classic', 'Friendly and conventional']];
const NAVS = [['minimal', 'Minimal', 'Native-style bar'], ['cinematic', 'Cinematic', 'Glowing active marker'], ['glass', 'Glass', 'Floating, translucent'], ['casual', 'Casual', 'Solid pill with labels']];
const modeOf = st => (st.theme === 'light' ? 'light' : st.theme === 'system' ? 'system' : 'dark');
const modeCard = ([id, label], current) => {
  const art = id === 'system' ? `<span class="mode-art is-split"><i data-scheme="light"><b></b></i><i data-scheme="dark" data-amoled="true"><b></b></i></span>` : `<span class="mode-art" data-scheme="${id}" data-amoled="true"><b></b><em></em><em style="width:44%"></em><u></u></span>`;
  return `<button type="button" class="mode-card ${current === id ? 'is-on' : ''}" role="radio" aria-checked="${current === id}" data-action="set-mode" data-mode="${id}">${art}<span class="mode-label">${label}${current === id ? icon('check', { size: 14 }) : ''}</span></button>`;
};
const styleCard = ([id, label, sub], current, scheme) => `<button type="button" class="style-card ${current === id ? 'is-on' : ''}" role="radio" aria-checked="${current === id}" data-action="set-style" data-style="${id}"><span class="style-art" data-style="${id}" data-scheme="${scheme}" data-amoled="true"><i class="sa-card"></i><i class="sa-card is-short"></i><i class="sa-btn"></i></span><span class="mode-label">${label}${current === id ? icon('check', { size: 14 }) : ''}</span><small>${sub}</small></button>`;
const navCard = ([id, label, sub], current, scheme) => `<button type="button" class="nav-card ${current === id ? 'is-on' : ''}" role="radio" aria-checked="${current === id}" data-action="set-nav" data-nav="${id}"><span class="nav-art" data-navstyle="${id}" data-scheme="${scheme}" data-amoled="true"><span class="na-screen"><i></i><i></i></span><span class="na-bar"><b class="on"></b><b></b><b></b><b></b><b></b></span></span><span class="mode-label">${label}${current === id ? icon('check', { size: 14 }) : ''}</span><small>${sub}</small></button>`;
const subLink = (href, ico, title, sub) => `<a class="row set-link" href="${href}"><span class="row-lead">${icon(ico, { size: 19 })}</span><span class="row-main"><span class="row-title">${esc(title)}</span><span class="row-sub trunc">${esc(sub)}</span></span>${icon('chevron-right', { size: 18 })}</a>`;
const back = '';

function pageLanding(s) {
  const st = s.settings, hex = accentHex(st), accName = st.customAccent ? 'Custom' : ACCENTS[st.accent]?.name || 'Blue';
  const cap = x => x[0].toUpperCase() + x.slice(1);
  return `${pageHead({ title: 'Settings' })}<div class="stack-lg">
    <section class="card card-flush" style="--i:1"><div class="list">
      ${subLink('#/settings/appearance', 'palette', 'Appearance Studio', `${cap(modeOf(st))} · ${accName} · ${cap(st.style)}`)}
      ${subLink('#/settings/navigation', 'dock', 'Navigation', `${cap(st.navStyle)} bottom bar`)}
      ${subLink('#/settings/preferences', 'sliders', 'Preferences', `${st.currency} · week starts ${st.weekStartsMonday ? 'Monday' : 'Sunday'}`)}</div></section>
    <section class="card card-flush" style="--i:2"><div class="list">
      ${subLink('#/settings/data', 'database', 'Data and backup', 'Export, import and restore')}
      ${subLink('#/cloud', 'cloud', 'Cloud sync', STATUS[health.status] || health.status)}
      ${subLink('#/settings/trash', 'trash', 'Recently deleted', s.trashBin.length ? `${s.trashBin.length} kept for 30 days` : 'Nothing deleted recently')}</div></section>
    <section class="card card-flush" style="--i:3"><div class="list">${subLink('#/settings/about', 'info', 'About Evolve', `Version 9.0.0 · data format ${SCHEMA_VERSION}`)}</div></section>
    <p class="t-small faint" style="text-align:center">Search is Ctrl / ⌘ K. Your data stays on this device unless you turn on cloud sync.</p></div>`;
}

function pageAppearance(s) {
  const st = s.settings, hex = accentHex(st), mode = modeOf(st), hsl = hexToHsl(hex), scheme = document.documentElement.dataset.scheme || 'dark';
  const tiles = Object.entries(ACCENTS).map(([id, a]) => `<button type="button" class="accent-tile ${!st.customAccent && st.accent === id ? 'is-on' : ''}" role="radio" aria-checked="${!st.customAccent && st.accent === id}" style="--sw:${a.hex}" data-action="set-accent" data-id="${id}"><span class="accent-dot">${!st.customAccent && st.accent === id ? icon('check', { size: 16 }) : ''}</span><b>${esc(a.name)}</b></button>`).join('');
  return `${pageHead({ title: 'Appearance', sub: 'Theme, colour and visual style' })}<div class="stack-lg">
    <section class="card card-pad set-card" style="--i:1"><p class="set-sub">Theme</p>
      <div class="mode-grid" role="radiogroup" aria-label="Theme">${MODES.map(m => modeCard(m, mode)).join('')}</div>
      ${mode !== 'light' ? rowSet('True black', 'Pure #000000 background in dark mode. Turn off for a soft dark grey.', `<label class="switch"><input type="checkbox" ${st.amoled ? 'checked' : ''} data-change="set-amoled" aria-label="True black in dark mode"><span></span></label>`) : ''}</section>
    <section class="card card-pad set-card" style="--i:2"><p class="set-sub">Accent colour</p>
      <div class="accent-grid" role="radiogroup" aria-label="Accent colour">${tiles}
        <button type="button" class="accent-tile is-custom ${st.customAccent ? 'is-on' : ''}" role="radio" aria-checked="${Boolean(st.customAccent)}" data-action="custom-toggle" style="--sw:${esc(hex)}"><span class="accent-dot">${st.customAccent ? icon('check', { size: 16 }) : icon('plus', { size: 16 })}</span><b>Custom</b></button></div>
      <div class="custom-picker" id="custom-picker" ${ui.customOpen ? '' : 'hidden'} style="--h:${hsl[0]};--s:${hsl[1]};--l:${hsl[2]}">
        <div class="cp-row"><span class="cp-preview" style="background:${esc(hex)}"></span><input class="input cp-hex" maxlength="7" value="${esc(hex.toUpperCase())}" data-input="cp-hex" aria-label="Hex colour" spellcheck="false" autocomplete="off"></div>
        <label class="cp-label">Hue<input type="range" class="cp-range cp-hue" min="0" max="360" value="${hsl[0]}" data-input="cp-slider" data-k="h" aria-label="Hue"></label>
        <label class="cp-label">Saturation<input type="range" class="cp-range cp-sat" min="0" max="100" value="${hsl[1]}" data-input="cp-slider" data-k="s" aria-label="Saturation"></label>
        <label class="cp-label">Lightness<input type="range" class="cp-range cp-light" min="25" max="85" value="${hsl[2]}" data-input="cp-slider" data-k="l" aria-label="Lightness"></label></div>
      <div class="accent-preview" aria-hidden="true"><span class="btn btn-primary btn-sm">Primary</span><span class="badge badge-accent">Accent</span><div class="bar"><span style="--w:64%"></span></div></div>
      <p class="field-hint mt-2">The accent is used for actions, the active tab and progress. Text colours are adjusted automatically so they stay readable.</p></section>
    <section class="card card-pad set-card" style="--i:3"><p class="set-sub">Visual style</p>
      <div class="style-grid" role="radiogroup" aria-label="Visual style">${STYLES.map(x => styleCard(x, st.style, scheme)).join('')}</div></section>
    <section class="card card-pad set-card" style="--i:4"><p class="set-sub">Interface</p>
      ${rowSet('Glass effect', 'Translucency of glass surfaces and bars.', `<div class="range-row"><input type="range" min="0" max="100" step="5" value="${st.glass}" style="--p:${st.glass}%" data-input="set-glass" aria-label="Glass intensity"><output>${st.glass}</output></div>`)}
      ${rowSet('Density', '', seg('density', st.density, [['comfortable', 'Comfortable'], ['compact', 'Compact']]))}
      ${rowSet('Text size', '', seg('textSize', st.textSize, [['small', 'Small'], ['default', 'Default'], ['large', 'Large']]))}
      ${rowSet('Motion', 'System follows your device setting.', seg('motion', st.motion, [['system', 'System'], ['reduce', 'Reduced'], ['full', 'Full']]))}
      <div class="set-foot"><button class="btn btn-sm" type="button" data-action="reset-appearance">${icon('refresh', { size: 16 })} Restore default appearance</button></div></section></div>`;
}

function pageNavigation(s) {
  const st = s.settings, scheme = document.documentElement.dataset.scheme || 'dark';
  return `${pageHead({ title: 'Navigation', sub: 'Choose how the bottom bar looks' })}<div class="stack-lg">
    <section class="card card-pad set-card" style="--i:1"><div class="nav-grid" role="radiogroup" aria-label="Bottom navigation style">${NAVS.map(x => navCard(x, st.navStyle, scheme)).join('')}</div>
      <p class="field-hint mt-4">The selected style is applied immediately, saved on this device and restored when you reopen Evolve. Today, Planner, Growth, Life and Library stay in every style; on wide screens a sidebar replaces the bottom bar.</p></section></div>`;
}

function pagePreferences(s) {
  const st = s.settings;
  return `${pageHead({ title: 'Preferences' })}<div class="stack-lg"><section class="card card-pad set-card" style="--i:1">
    ${rowSet('Currency', '', selectHTML({ value: st.currency, options: CURRENCIES, label: 'Currency', compact: true, dataChange: 'set-currency' }))}
    ${rowSet('Week starts on', '', seg('weekStartsMonday', st.weekStartsMonday, [[true, 'Monday'], [false, 'Sunday']]))}
    ${rowSet('Daily XP cap', 'Limits XP per day so levels stay meaningful.', selectHTML({ value: st.dailyXpCap, options: [50, 75, 100, 125, 150, 200].map(v => ({ value: v, label: `${v} XP` })), label: 'Daily XP cap', compact: true, dataChange: 'set-cap' }))}</section></div>`;
}

function pageData(s) {
  return `${pageHead({ title: 'Data and backup' })}<div class="stack-lg">
    <section class="card card-pad set-card" style="--i:1"><div class="set-head">${icon('cloud', { size: 20 })}<h2 class="t-h2">Sync status</h2></div>${healthBlock()}</section>
    <section class="card card-pad set-card" style="--i:2"><div class="set-head">${icon('database', { size: 20 })}<h2 class="t-h2">Backup</h2></div>
      <p class="t-small">Your data lives on this device and syncs to the cloud when connected. Export a backup regularly.</p>
      <div class="set-actions"><button class="btn btn-primary" type="button" data-action="export-backup">${icon('download', { size: 18 })} Export backup</button>
        <label class="btn" for="import-file">${icon('upload', { size: 18 })} Import backup</label><input class="sr-only" id="import-file" type="file" accept=".json,application/json" data-change="import-file">
        <button class="btn" type="button" data-action="export-csv">${icon('receipt', { size: 18 })} Finance CSV</button></div>
      ${State.hasPreImportSnapshot() ? `<button class="link-btn mt-3" type="button" data-action="undo-import">${icon('undo', { size: 16 })} Restore the data you had before the last import or reset</button>` : ''}</section>
    <section class="card card-pad set-card" style="--i:3"><div class="set-head">${icon('trash', { size: 20 })}<h2 class="t-h2">Danger zone</h2></div><p class="t-small">Erases everything in Evolve. A backup is downloaded first and a snapshot is kept so you can undo it.</p><div class="mt-3"><button class="btn btn-danger btn-sm" type="button" data-action="reset-workspace">${icon('trash', { size: 16 })} Reset workspace</button></div></section></div>`;
}

function pageTrash(s) {
  const trash = s.trashBin.slice().sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)).slice(0, 30);
  return `${pageHead({ title: 'Recently deleted', sub: 'Kept for 30 days' })}<div class="stack-lg"><section class="card card-flush" style="--i:1">
    ${trash.length ? `<div class="list">${trash.map(t => `<div class="row"><span class="row-main"><span class="row-title trunc">${esc(schemas[t.type]?.title(t.record) || t.type)}</span><span class="row-sub">${esc(schemas[t.type]?.label || t.type)} · deleted ${esc(fmtDate(t.deletedAt.slice(0, 10)))}</span></span><span class="row-end"><button class="btn btn-sm btn-soft" type="button" data-action="trash-restore" data-id="${esc(t.id)}">Restore</button><button class="icon-btn" type="button" data-action="trash-purge" data-id="${esc(t.id)}" aria-label="Delete forever">${icon('x', { size: 16 })}</button></span></div>`).join('')}</div>` : '<p class="t-body" style="padding:var(--card-p)">Nothing deleted recently.</p>'}</section></div>`;
}

function pageAbout(s) {
  const kb = Math.round(storageEstimate().bytes / 1024), sum = summarize(s);
  return `${pageHead({ title: 'About' })}<div class="stack-lg"><section class="card card-pad set-card about" style="--i:1"><div class="about-mark">${logo(44)}<div><b>Evolve</b><small>Personal life management</small></div></div>
    <dl class="kv"><div><dt>Version</dt><dd>9.0.0 (data format ${SCHEMA_VERSION})</dd></div><div><dt>Stored data</dt><dd>${fmtNum(kb)} KB in this browser</dd></div><div><dt>Records</dt><dd>${esc(Object.entries(sum).filter(([, n]) => n).map(([k, n]) => `${n} ${k.toLowerCase()}`).join(' · ') || 'None yet')}</dd></div>${s.createdAt ? `<div><dt>Workspace created</dt><dd>${esc(fmtDate(s.createdAt.slice(0, 10), { day: 'numeric', month: 'long', year: 'numeric' }))}</dd></div>` : ''}</dl>
    <p class="t-small mt-3">Earlier data is never modified when Evolve upgrades it; a copy is migrated.</p></section></div>`;
}

function render(parts = []) {
  const s = State.get();
  return { appearance: pageAppearance, navigation: pageNavigation, preferences: pagePreferences, data: pageData, trash: pageTrash, about: pageAbout }[parts[0]]?.(s) || pageLanding(s);
}

/* ---------------- actions ---------------- */
function csv(rows) { return rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n'); }

function openImportPreview(res, fileName) {
  const cur = summarize(State.get()), inc = res.summary;
  const api = openSheet({ title: 'Replace your data?', subtitle: fileName, size: 'wide',
    body: `<p class="t-body">This replaces everything currently in Evolve with the contents of this backup${res.exportedAt ? ` (exported ${esc(fmtDate(res.exportedAt.slice(0, 10), { day: 'numeric', month: 'short', year: 'numeric' }))})` : ''}. A snapshot of your current data is kept so you can undo it.</p>
      <div class="imp-table mt-4" role="table"><div class="imp-row imp-head" role="row"><span>Section</span><span>Now</span><span>Backup</span></div>${Object.keys(inc).map(k => `<div class="imp-row" role="row"><span>${esc(k)}</span><span class="t-num">${cur[k]}</span><span class="t-num"><b>${inc[k]}</b></span></div>`).join('')}</div>`,
    footer: '<button class="btn btn-ghost" type="button" data-sheet-close>Cancel</button><button class="btn btn-danger" type="button" data-go>Replace my data</button>' });
  api.el.querySelector('[data-go]').addEventListener('click', () => {
    try { State.replaceAll(res.state); api.close(); toast('Backup imported'); emit('view:refresh'); } catch (e) { toast(e.message, { type: 'error' }); }
  });
}

registerActions({
  'set-pref'(el) {
    const v = el.dataset.value; const key = el.dataset.key;
    setSetting({ [key]: key === 'weekStartsMonday' ? v === 'true' : v }); emit('view:refresh');
  },
  'set-mode'(el) { setSetting({ theme: el.dataset.mode }); emit('view:refresh'); },
  'set-style'(el) { setSetting({ style: el.dataset.style }); emit('view:refresh'); },
  'set-nav'(el) { setSetting({ navStyle: el.dataset.nav }); emit('view:refresh'); toast(`${el.dataset.nav[0].toUpperCase()}${el.dataset.nav.slice(1)} navigation`); },
  'custom-toggle'() {
    ui.customOpen = !ui.customOpen;
    const st = State.get().settings;
    if (ui.customOpen && !st.customAccent) setSetting({ customAccent: accentHex(st) });
    emit('view:refresh');
  },
  'set-accent'(el) { setSetting({ accent: el.dataset.id, customAccent: '' }); emit('view:refresh'); },
  'reset-appearance'() { const d = freshSettings(); setSetting({ theme: d.theme, amoled: d.amoled, accent: d.accent, customAccent: '', style: d.style, navStyle: d.navStyle, glass: d.glass, density: d.density, textSize: d.textSize, motion: d.motion }); emit('view:refresh'); toast('Appearance restored'); },
  'export-backup'() { exportBackupFile(State.get()); toast('Backup downloaded'); },
  'export-csv'() {
    const tx = State.get().transactions.slice().sort((a, b) => a.date.localeCompare(b.date));
    if (!tx.length) { toast('No transactions to export yet.', { type: 'error' }); return; }
    downloadFile(`evolve-transactions-${todayStr()}.csv`, csv([['Date', 'Type', 'Category', 'Amount', 'Description', 'Repeats'], ...tx.map(t => [t.date, t.type, t.category, t.amount, t.note, t.recurrence])]), 'text/csv');
    toast('CSV downloaded');
  },
  async 'undo-import'() {
    if (!await confirmDialog({ title: 'Restore earlier data?', message: 'This swaps your current data back to the snapshot taken before the last import or reset.', confirmLabel: 'Restore' })) return;
    try { State.restorePreImportSnapshot(); toast('Earlier data restored'); emit('view:refresh'); } catch (e) { toast(e.message, { type: 'error' }); }
  },
  'trash-restore'(el) { if (restoreTrash(el.dataset.id)) toast('Restored'); },
  async 'trash-purge'(el) { if (await confirmDialog({ title: 'Delete forever?', message: 'This cannot be undone.', confirmLabel: 'Delete forever', danger: true })) purgeTrash(el.dataset.id); },
  'reset-workspace'() {
    const api = openSheet({ title: 'Reset workspace', size: 'narrow', body: `<p class="confirm-text">This erases all tasks, habits, finance, fitness and everything else in Evolve. A backup file is downloaded first and a snapshot is kept so you can undo it.</p><div class="field"><label for="reset-word">Type <b>RESET</b> to confirm</label><input id="reset-word" autocomplete="off" data-autofocus></div>`, footer: '<button class="btn btn-ghost" type="button" data-sheet-close>Cancel</button><button class="btn btn-danger" type="button" data-go disabled>Erase everything</button>' });
    const input = api.el.querySelector('#reset-word'), go = api.el.querySelector('[data-go]');
    input.addEventListener('input', () => { go.disabled = input.value.trim() !== 'RESET'; });
    go.addEventListener('click', () => { try { exportBackupFile(State.get()); State.replaceAll(freshState()); api.close(); toast('Workspace reset. Your backup was downloaded.'); location.hash = '#/home'; } catch (e) { toast(e.message, { type: 'error' }); } });
  }
});

registerChange({
  'set-amoled'(el) { setSetting({ amoled: el.checked }); },
  'set-currency'(el) { setSetting({ currency: el.value }); State.update(() => {}); },
  'set-cap'(el) { setSetting({ dailyXpCap: Number(el.value) }); },
  async 'import-file'(el) {
    const file = el.files[0]; if (!file) return;
    let text;
    try { text = await file.text(); } catch { toast('That file could not be read.', { type: 'error' }); el.value = ''; return; }
    const res = validateBackup(text); el.value = '';
    if (!res.ok) { toast(res.error, { type: 'error', duration: 8000 }); return; }
    openImportPreview(res, file.name);
  }
});
registerInput({
  'set-glass'(el) { el.style.setProperty('--p', `${el.value}%`); el.parentElement.querySelector('output').textContent = el.value; setSetting({ glass: Number(el.value) }); },
  'cp-slider'(el) {
    const box = el.closest('.custom-picker');
    const v = k => Number(box.querySelector(`[data-k="${k}"]`).value);
    const hexv = hslToHex(v('h'), v('s'), v('l'));
    box.style.setProperty('--h', v('h')); box.style.setProperty('--s', v('s')); box.style.setProperty('--l', v('l'));
    box.querySelector('.cp-hex').value = hexv.toUpperCase(); box.querySelector('.cp-preview').style.background = hexv;
    setSetting({ customAccent: hexv });
  },
  'cp-hex'(el) {
    const raw = el.value.trim().replace(/^#?/, '#');
    if (!/^#[0-9a-f]{6}$/i.test(raw)) return;
    const box = el.closest('.custom-picker'), [h, sa, l] = hexToHsl(raw);
    box.style.setProperty('--h', h); box.style.setProperty('--s', sa); box.style.setProperty('--l', Math.min(85, Math.max(25, l)));
    box.querySelector('[data-k="h"]').value = h; box.querySelector('[data-k="s"]').value = sa; box.querySelector('[data-k="l"]').value = Math.min(85, Math.max(25, l));
    box.querySelector('.cp-preview').style.background = raw;
    setSetting({ customAccent: raw.toLowerCase() });
  }
});

const TITLES = { appearance: 'Appearance', navigation: 'Navigation', preferences: 'Preferences', data: 'Data and backup', trash: 'Recently deleted', about: 'About' };
export const route = { id: 'settings', render, title: parts => TITLES[parts[0]] || 'Settings' };
