/* Evolve date picker: an in-app calendar dialog that replaces the browser/Android native date picker.
 * Values stay local YYYY-MM-DD strings (no Date/UTC conversions of the stored value), so nothing can shift a day.
 *
 * Markup (see dateFieldHTML): a hidden input holds the value; a button shows it and opens the dialog.
 * The dialog edits a draft date; Confirm commits it, Cancel or Escape leaves the value untouched. */
import { registerActions } from '../core/events.js';
import { esc, todayStr, parseDate, dateStr, isDateStr, addDays } from '../core/utils.js';
import { icon } from '../core/icons.js';
import * as State from '../core/state.js';
import { openSheet } from './modal.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad = n => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
export const fmtPicked = v => (isDateStr(v) ? parseDate(v).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '');

/** Field markup: hidden value + trigger button. `name`/`id` mirror a normal input, so forms read it like one. */
export function dateFieldHTML({ id, name, value = '', placeholder = 'Choose a date', invalid = false }) {
  return `<div class="datefield"><input type="hidden" id="${id}-v" name="${esc(name)}" value="${esc(value)}" data-date>
    <button type="button" class="date-trigger ${invalid ? 'is-invalid' : ''}" id="${id}" data-action="date-pick" aria-haspopup="dialog">
      <span class="dt-text ${value ? '' : 'is-empty'}" data-dt-text>${esc(fmtPicked(value) || placeholder)}</span>${icon('calendar', { size: 18 })}</button></div>`;
}

/** Keep the visible text in step after the hidden value was changed by code (quick chips, clear). */
export function refreshDateField(input) {
  const t = input.closest('.datefield')?.querySelector('[data-dt-text]'); if (!t) return;
  t.textContent = fmtPicked(input.value) || 'Choose a date'; t.classList.toggle('is-empty', !input.value);
}

/** Open the picker; resolves with the confirmed YYYY-MM-DD, or null when cancelled. */
export function pickDate({ value = '', title = 'Select date' } = {}) {
  return new Promise(resolve => {
    const today = todayStr(), mondayFirst = State.get().settings.weekStartsMonday !== false;
    let sel = isDateStr(value) ? value : today;
    let [vy, vm] = sel.split('-').map(Number); vm -= 1;
    let mode = 'days', yearBase = vy - (vy % 12), done = false, ov = null;

    const api = openSheet({
      title, size: 'narrow dp',
      body: '<div class="dp" data-dp></div>',
      footer: `<button class="btn btn-ghost" type="button" data-dp-cancel>Cancel</button><button class="btn btn-primary" type="button" data-dp-ok>Confirm</button>`,
      onMount(root, a) { ov = root; draw(); root.addEventListener('click', onClick); root.addEventListener('keydown', onKey); setTimeout(() => root.querySelector('.dp-day.is-sel')?.focus({ preventScroll: true }), 320); },
      onClose() { if (!done) { done = true; resolve(null); } }
    });
    const root = () => ov;
    const finish = v => { if (done) return; done = true; resolve(v); api.close(); };

    function draw() {
      const host = root().querySelector('[data-dp]'); if (!host) return;
      const head = (label, prev, next, labelAction) => `<div class="dp-head"><button type="button" class="icon-btn is-solid" data-dp-nav="${prev}" aria-label="Previous">${icon('chevron-left', { size: 20 })}</button><button type="button" class="dp-title" ${labelAction ? `data-dp-mode="${labelAction}"` : ''} aria-live="polite">${label}${labelAction ? icon('chevron-down', { size: 16 }) : ''}</button><button type="button" class="icon-btn is-solid" data-dp-nav="${next}" aria-label="Next">${icon('chevron-right', { size: 20 })}</button></div>`;
      if (mode === 'years') {
        host.innerHTML = `${head(`${yearBase} – ${yearBase + 11}`, -12, 12, '')}<div class="dp-pick">${Array.from({ length: 12 }, (_, i) => yearBase + i).map(y => `<button type="button" class="dp-cell ${y === vy ? 'is-sel' : ''} ${y === Number(today.slice(0, 4)) ? 'is-today' : ''}" data-dp-year="${y}">${y}</button>`).join('')}</div>`;
      } else if (mode === 'months') {
        host.innerHTML = `${head(`<span data-dp-mode="years" class="dp-yr">${vy}</span>`, -1, 1, '')}<div class="dp-pick">${MONTHS.map((n, i) => `<button type="button" class="dp-cell ${i === vm ? 'is-sel' : ''} ${vy === Number(today.slice(0, 4)) && i === Number(today.slice(5, 7)) - 1 ? 'is-today' : ''}" data-dp-month="${i}">${n.slice(0, 3)}</button>`).join('')}</div>`;
      } else {
        const first = new Date(vy, vm, 1).getDay(), lead = mondayFirst ? (first + 6) % 7 : first, days = new Date(vy, vm + 1, 0).getDate();
        const wd = mondayFirst ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
        const cells = [...Array(lead).fill(''), ...Array.from({ length: days }, (_, i) => i + 1)];
        host.innerHTML = `${head(`${MONTHS[vm]} ${vy}`, -1, 1, 'months')}
          <div class="dp-week" aria-hidden="true">${wd.map(d => `<span>${d}</span>`).join('')}</div>
          <div class="dp-grid" role="grid" aria-label="${MONTHS[vm]} ${vy}">${cells.map(d => { if (!d) return '<span class="dp-blank"></span>'; const v = ymd(vy, vm, d); return `<button type="button" class="dp-day ${v === sel ? 'is-sel' : ''} ${v === today ? 'is-today' : ''}" data-dp-day="${v}" role="gridcell" aria-selected="${v === sel}" aria-label="${esc(parseDate(v).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}${v === today ? ', today' : ''}" tabindex="${v === sel ? 0 : -1}">${d}</button>`; }).join('')}</div>
          <div class="dp-foot"><span class="dp-picked">${esc(fmtPicked(sel))}</span><button type="button" class="link-btn" data-dp-today>Today</button></div>`;
      }
    }
    function onClick(e) {
      const t = e.target;
      const nav = t.closest('[data-dp-nav]');
      if (nav) {
        const n = Number(nav.dataset.dpNav);
        if (mode === 'years') yearBase += n; else if (mode === 'months') vy += n; else { vm += n; if (vm < 0) { vm = 11; vy--; } if (vm > 11) { vm = 0; vy++; } }
        return draw();
      }
      const md = t.closest('[data-dp-mode]'); if (md) { mode = md.dataset.dpMode; if (mode === 'years') yearBase = vy - (vy % 12); return draw(); }
      const y = t.closest('[data-dp-year]'); if (y) { vy = Number(y.dataset.dpYear); mode = 'months'; return draw(); }
      const m = t.closest('[data-dp-month]'); if (m) { vm = Number(m.dataset.dpMonth); mode = 'days'; return draw(); }
      const d = t.closest('[data-dp-day]'); if (d) { sel = d.dataset.dpDay; return draw(), root().querySelector('.dp-day.is-sel')?.focus({ preventScroll: true }); }
      if (t.closest('[data-dp-today]')) { sel = today; [vy, vm] = today.split('-').map(Number); vm -= 1; mode = 'days'; return draw(); }
      if (t.closest('[data-dp-ok]')) return finish(sel);
      if (t.closest('[data-dp-cancel]')) return finish(null);
    }
    function onKey(e) {
      if (mode !== 'days' || !e.target.matches('.dp-day')) return;
      const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
      if (step) { e.preventDefault(); sel = addDays(sel, step); [vy, vm] = sel.split('-').map(Number); vm -= 1; draw(); root().querySelector('.dp-day.is-sel')?.focus(); }
      else if (e.key === 'Enter' && !e.target.closest('button')?.dataset.dpDay) finish(sel);
    }
  });
}

/* Any element with data-action="date-pick" inside a .datefield opens the picker and writes back through the hidden input. */
registerActions({
  async 'date-pick'(el) {
    const field = el.closest('.datefield'), input = field?.querySelector('input[data-date]'); if (!input) return;
    const label = field.closest('[data-field]')?.querySelector('label, .field-label')?.textContent?.replace('*', '').trim();
    const v = await pickDate({ value: input.value, title: label || 'Select date' });
    if (v === null || v === input.value) return;
    input.value = v; refreshDateField(input);
    input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }));
  }
});
