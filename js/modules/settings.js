/* Settings: Appearance, preferences, data safety (backup, import with validation, undo import, trash, reset) and About. */
import * as State from '../core/state.js';
import { registerActions, registerChange, registerInput, emit } from '../core/events.js';
import { setSetting, accentHex } from '../core/appearance.js';
import { restoreTrash, purgeTrash } from '../core/records.js';
import { schemas } from '../core/schemas.js';
import { ACCENTS, freshSettings, freshState, summarize, SCHEMA_VERSION } from '../storage/migration.js';
import { exportBackupFile, validateBackup } from '../storage/backup.js';
import { storageEstimate } from '../storage/storage.js';
import { esc, downloadFile, todayStr, fmtDate, fmtNum } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { pageHead } from '../components/ui.js';
import { selectHTML } from '../components/dropdown.js';
import { openSheet, confirmDialog } from '../components/modal.js';
import { toast } from '../components/toast.js';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'JPY', 'CAD', 'AUD', 'SGD'].map(c => ({ value: c, label: c }));
const seg = (key, current, options) => `<div class="seg" role="group" aria-label="${esc(key)}">${options.map(([v, l, ic]) => `<button type="button" class="${String(current) === String(v) ? 'is-on' : ''}" aria-pressed="${String(current) === String(v)}" data-action="set-pref" data-key="${key}" data-value="${v}">${ic ? icon(ic, { size: 16 }) : ''}${l}</button>`).join('')}</div>`;
const rowSet = (label, hint, control) => `<div class="set-row"><div class="set-label"><b>${esc(label)}</b>${hint ? `<small>${esc(hint)}</small>` : ''}</div><div class="set-ctl">${control}</div></div>`;

function render() {
  const s = State.get(), st = s.settings, hex = accentHex(st), kb = Math.round(storageEstimate().bytes / 1024);
  const trash = s.trashBin.slice().sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)).slice(0, 15);
  const swatches = Object.entries(ACCENTS).map(([id, a]) => `<button type="button" class="swatch ${!st.customAccent && st.accent === id ? 'is-on' : ''}" style="--sw:${a.hex}" data-action="set-accent" data-id="${id}" aria-label="${esc(a.name)}" aria-pressed="${!st.customAccent && st.accent === id}" title="${esc(a.name)}">${!st.customAccent && st.accent === id ? icon('check', { size: 16 }) : ''}</button>`).join('');
  const sum = summarize(s);

  return `${pageHead({ title: 'Settings' })}
    <div class="stack-lg">
      <section class="card card-pad set-card" style="--i:1"><div class="set-head">${icon('palette', { size: 20 })}<h2 class="t-h2">Appearance</h2></div>
        ${rowSet('Theme', '', seg('theme', st.theme, [['dark', 'Dark', 'moon'], ['light', 'Light', 'sun'], ['system', 'System', 'monitor']]))}
        ${rowSet('True black (AMOLED)', 'Deepest dark surfaces. Applies to the dark theme.', `<label class="switch"><input type="checkbox" ${st.amoled ? 'checked' : ''} data-change="set-amoled" aria-label="True black"><span></span></label>`)}
        ${rowSet('Accent colour', '', `<div class="swatches">${swatches}<label class="swatch swatch-custom ${st.customAccent ? 'is-on' : ''}" title="Custom colour" aria-label="Custom accent colour"><input type="color" value="${esc(hex)}" data-input="set-custom-accent" data-change="set-custom-accent-done"><span>${st.customAccent ? icon('check', { size: 16 }) : icon('plus', { size: 16 })}</span></label></div>`)}
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
  'set-custom-accent-done'(el) { setSetting({ customAccent: el.value }); emit('view:refresh'); },
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
  'set-custom-accent'(el) { setSetting({ customAccent: el.value }); }
});

export const route = { id: 'settings', render };
