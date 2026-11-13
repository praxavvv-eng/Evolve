/* Settings: Appearance, preferences, data safety (backup, import with validation, undo import, trash, reset) and About. */
import * as State from '../core/state.js';
import { registerActions, registerChange, registerInput, emit } from '../core/events.js';
import { setSetting, accentHex } from '../core/appearance.js';
import { restoreTrash, purgeTrash } from '../core/records.js';
import { schemas } from '../core/schemas.js';
import { ACCENTS, freshSettings, freshState, summarize, SCHEMA_VERSION } from '../storage/migration.js';
import { exportBackupFile, validateBackup } from '../storage/backup.js';
import { storageEstimate } from '../storage/storage.js';
import { esc, downloadFile, todayStr, fmtDate, fmtNum, hexToHsl, hslToHex } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { pageHead } from '../components/ui.js';
import { selectHTML } from '../components/dropdown.js';
import { openSheet, confirmDialog } from '../components/modal.js';
import { toast } from '../components/toast.js';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'JPY', 'CAD', 'AUD', 'SGD'].map(c => ({ value: c, label: c }));
const seg = (key, current, options) => `<div class="seg" role="group" aria-label="${esc(key)}">${options.map(([v, l, ic]) => `<button type="button" class="${String(current) === String(v) ? 'is-on' : ''}" aria-pressed="${String(current) === String(v)}" data-action="set-pref" data-key="${key}" data-value="${v}">${ic ? icon(ic, { size: 16 }) : ''}${l}</button>`).join('')}</div>`;
const rowSet = (label, hint, control) => `<div class="set-row"><div class="set-label"><b>${esc(label)}</b>${hint ? `<small>${esc(hint)}</small>` : ''}</div><div class="set-ctl">${control}</div></div>`;

const ui = { customOpen: false };
const MODES = [['light', 'Light'], ['dark', 'Dark'], ['amoled', 'AMOLED'], ['system', 'System']];
const PREVIEW = { light: ['#f3f0ea', '#fffefb', '#1d1b17', 'rgba(40,32,18,.18)'], dark: ['#0f0f11', '#1a1a1e', '#f3eee5', 'rgba(255,255,255,.2)'], amoled: ['#000', '#0e0e10', '#f3eee5', 'rgba(255,255,255,.18)'] };
function modeCard([id, label], current, accent) {
  const half = id === 'system';
  const art = half
    ? `<span class="mode-art is-split"><i style="background:${PREVIEW.light[0]}"><b style="background:${PREVIEW.light[1]}"></b></i><i style="background:${PREVIEW.dark[0]}"><b style="background:${PREVIEW.dark[1]}"></b></i><u style="background:${accent}"></u></span>`
    : `<span class="mode-art" style="background:${PREVIEW[id][0]}"><b style="background:${PREVIEW[id][1]}"></b><em style="background:${PREVIEW[id][3]}"></em><em style="background:${PREVIEW[id][3]};width:44%"></em><u style="background:${accent}"></u></span>`;
  return `<button type="button" class="mode-card ${current === id ? 'is-on' : ''}" role="radio" aria-checked="${current === id}" data-action="set-mode" data-mode="${id}">${art}<span class="mode-label">${label}${current === id ? icon('check', { size: 14 }) : ''}</span></button>`;
}
const modeOf = st => (st.theme === 'light' ? 'light' : st.theme === 'system' ? 'system' : st.amoled ? 'amoled' : 'dark');

function render() {
  const s = State.get(), st = s.settings, hex = accentHex(st), kb = Math.round(storageEstimate().bytes / 1024);
  const trash = s.trashBin.slice().sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)).slice(0, 15);
  const mode = modeOf(st), hsl = hexToHsl(hex);
  const tiles = Object.entries(ACCENTS).map(([id, a]) => `<button type="button" class="accent-tile ${!st.customAccent && st.accent === id ? 'is-on' : ''}" role="radio" aria-checked="${!st.customAccent && st.accent === id}" style="--sw:${a.hex}" data-action="set-accent" data-id="${id}"><span class="accent-dot">${!st.customAccent && st.accent === id ? icon('check', { size: 16 }) : ''}</span><b>${esc(a.name)}</b></button>`).join('');
  const sum = summarize(s);

  return `${pageHead({ title: 'Settings' })}
    <div class="stack-lg">
      <section class="card card-pad set-card" style="--i:1"><div class="set-head">${icon('palette', { size: 20 })}<h2 class="t-h2">Appearance</h2></div>
        <p class="set-sub">Theme</p>
        <div class="mode-grid" role="radiogroup" aria-label="Theme">${MODES.map(m => modeCard(m, mode, hex)).join('')}</div>
        ${st.theme === 'system' ? rowSet('True black in dark mode', 'Used when your device is in dark mode.', `<label class="switch"><input type="checkbox" ${st.amoled ? 'checked' : ''} data-change="set-amoled" aria-label="True black in dark mode"><span></span></label>`) : ''}
        <p class="set-sub">Accent colour</p>
        <div class="accent-grid" role="radiogroup" aria-label="Accent colour">${tiles}
          <button type="button" class="accent-tile is-custom ${st.customAccent ? 'is-on' : ''}" role="radio" aria-checked="${Boolean(st.customAccent)}" data-action="custom-toggle" style="--sw:${esc(hex)}"><span class="accent-dot">${st.customAccent ? icon('check', { size: 16 }) : icon('plus', { size: 16 })}</span><b>Custom</b></button></div>
        <div class="custom-picker" id="custom-picker" ${ui.customOpen ? '' : 'hidden'} style="--h:${hsl[0]};--s:${hsl[1]};--l:${hsl[2]}">
          <div class="cp-row"><span class="cp-preview" style="background:${esc(hex)}"></span><input class="input cp-hex" maxlength="7" value="${esc(hex.toUpperCase())}" data-input="cp-hex" aria-label="Hex colour" spellcheck="false" autocomplete="off"></div>
          <label class="cp-label">Hue<input type="range" class="cp-range cp-hue" min="0" max="360" value="${hsl[0]}" data-input="cp-slider" data-k="h" aria-label="Hue"></label>
          <label class="cp-label">Saturation<input type="range" class="cp-range cp-sat" min="0" max="100" value="${hsl[1]}" data-input="cp-slider" data-k="s" aria-label="Saturation"></label>
          <label class="cp-label">Lightness<input type="range" class="cp-range cp-light" min="25" max="85" value="${hsl[2]}" data-input="cp-slider" data-k="l" aria-label="Lightness"></label></div>
        <div class="accent-preview" aria-hidden="true"><span class="btn btn-primary btn-sm">Primary</span><span class="badge badge-accent">Accent</span><div class="bar"><span style="--w:64%"></span></div></div>
        <p class="set-sub">Interface</p>
        ${rowSet('Glass effect', 'How translucent bars and sheets feel.', `<div class="range-row"><input type="range" min="0" max="100" step="5" value="${st.glass}" style="--p:${st.glass}%" data-input="set-glass" aria-label="Glass intensity"><output>${st.glass}</output></div>`)}
        ${rowSet('Density', '', seg('density', st.density, [['comfortable', 'Comfortable'], ['compact', 'Compact']]))}
        ${rowSet('Text size', '', seg('textSize', st.textSize, [['small', 'Small'], ['default', 'Default'], ['large', 'Large']]))}
        ${rowSet('Motion', 'System follows your device setting.', seg('motion', st.motion, [['system', 'System'], ['reduce', 'Reduced'], ['full', 'Full']]))}
        <div class="set-foot"><button class="btn btn-sm" type="button" data-action="reset-appearance">${icon('refresh', { size: 16 })} Restore default appearance</button></div></section>

      <section class="card card-pad set-card" style="--i:2"><div class="set-head">${icon('sliders', { size: 20 })}<h2 class="t-h2">Preferences</h2></div>
        ${rowSet('Currency', '', selectHTML({ value: st.currency, options: CURRENCIES, label: 'Currency', compact: true, dataChange: 'set-currency' }))}
        ${rowSet('Week starts on', '', seg('weekStartsMonday', st.weekStartsMonday, [[true, 'Monday'], [false, 'Sunday']]))}
        ${rowSet('Daily XP cap', 'Limits XP per day so levels stay meaningful.', selectHTML({ value: st.dailyXpCap, options: [50, 75, 100, 125, 150, 200].map(v => ({ value: v, label: `${v} XP` })), label: 'Daily XP cap', compact: true, dataChange: 'set-cap' }))}</section>

      <section class="card card-pad set-card" style="--i:3"><div class="set-head">${icon('database', { size: 20 })}<h2 class="t-h2">Your data</h2></div>
        <p class="t-small">Everything lives in this browser only. Export a backup regularly, especially before clearing browser data.</p>
        <div class="set-actions"><button class="btn btn-primary" type="button" data-action="export-backup">${icon('download', { size: 18 })} Export backup</button>
          <label class="btn" for="import-file">${icon('upload', { size: 18 })} Import backup</label><input class="sr-only" id="import-file" type="file" accept=".json,application/json" data-change="import-file">
          <button class="btn" type="button" data-action="export-csv">${icon('receipt', { size: 18 })} Finance CSV</button></div>
        ${State.hasPreImportSnapshot() ? `<button class="link-btn mt-3" type="button" data-action="undo-import">${icon('undo', { size: 16 })} Restore the data you had before the last import or reset</button>` : ''}</section>

      <section class="card card-flush set-card" style="--i:4"><div class="panel-head"><div><h2>Recently deleted</h2><p>Kept for 30 days</p></div></div>
        ${trash.length ? `<div class="list">${trash.map(t => `<div class="row"><span class="row-main"><span class="row-title trunc">${esc(schemas[t.type]?.title(t.record) || t.type)}</span><span class="row-sub">${esc(schemas[t.type]?.label || t.type)} · deleted ${esc(fmtDate(t.deletedAt.slice(0, 10)))}</span></span><span class="row-end"><button class="btn btn-sm btn-soft" type="button" data-action="trash-restore" data-id="${esc(t.id)}">Restore</button><button class="icon-btn" type="button" data-action="trash-purge" data-id="${esc(t.id)}" aria-label="Delete forever">${icon('x', { size: 16 })}</button></span></div>`).join('')}</div>` : '<p class="t-body" style="padding:0 var(--card-p) var(--card-p)">Nothing deleted recently.</p>'}</section>

      <section class="card card-pad set-card" style="--i:5"><div class="set-head">${icon('info', { size: 20 })}<h2 class="t-h2">About</h2></div>
        <dl class="kv"><div><dt>Version</dt><dd>7.0.0 (data format ${SCHEMA_VERSION})</dd></div><div><dt>Stored data</dt><dd>${fmtNum(kb)} KB in this browser</dd></div><div><dt>Records</dt><dd>${esc(Object.entries(sum).filter(([, n]) => n).map(([k, n]) => `${n} ${k.toLowerCase()}`).join(' · ') || 'None yet')}</dd></div>${s.createdAt ? `<div><dt>Workspace created</dt><dd>${esc(fmtDate(s.createdAt.slice(0, 10), { day: 'numeric', month: 'long', year: 'numeric' }))}</dd></div>` : ''}</dl>
        <p class="t-small mt-3">V6 data is never modified by V7. Search is Ctrl/⌘ K.</p>
        <div class="mt-4"><button class="btn btn-danger btn-sm" type="button" data-action="reset-workspace">${icon('trash', { size: 16 })} Reset workspace</button></div></section>
    </div>`;
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
  'set-mode'(el) {
    const m = el.dataset.mode;
    setSetting(m === 'light' ? { theme: 'light' } : m === 'dark' ? { theme: 'dark', amoled: false } : m === 'amoled' ? { theme: 'dark', amoled: true } : { theme: 'system' });
    emit('view:refresh');
  },
  'custom-toggle'() {
    ui.customOpen = !ui.customOpen;
    const st = State.get().settings;
    if (ui.customOpen && !st.customAccent) setSetting({ customAccent: accentHex(st) });
    emit('view:refresh');
  },
  'set-accent'(el) { setSetting({ accent: el.dataset.id, customAccent: '' }); emit('view:refresh'); },
  'reset-appearance'() { const d = freshSettings(); setSetting({ theme: d.theme, amoled: d.amoled, accent: d.accent, customAccent: '', glass: d.glass, density: d.density, textSize: d.textSize, motion: d.motion }); emit('view:refresh'); toast('Appearance restored'); },
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

export const route = { id: 'settings', render };
