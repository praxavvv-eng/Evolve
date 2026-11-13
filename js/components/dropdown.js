/* Custom select + action menu.
 * Selects keep a real (visually hidden) <select> so form values, validation and change events keep working;
 * the visible control is a themed button that opens a listbox popover (pointer devices) or a picker sheet (phones).
 * Popovers render in <body>, so cards and sheets can never clip them. */
import { esc } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { openSheet } from './modal.js';

export const normOptions = list => (list || []).map(o => (typeof o === 'object' ? { value: String(o.value), label: o.label ?? String(o.value) } : { value: String(o), label: String(o) }));

/** HTML for a themed select. */
export function selectHTML({ name = '', id = '', value = '', options = [], label = '', compact = false, placeholder = 'Select…', dataChange = '', extra = '' } = {}) {
  const opts = normOptions(options);
  const current = opts.find(o => o.value === String(value));
  return `<div class="dd" data-dd>
    <select class="dd-native" ${name ? `name="${esc(name)}"` : ''} ${id ? `id="${esc(id)}"` : ''} tabindex="-1" aria-hidden="true" ${dataChange ? `data-change="${esc(dataChange)}"` : ''} ${extra}>
      ${opts.map(o => `<option value="${esc(o.value)}" ${o.value === String(value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
    </select>
    <button type="button" class="dd-trigger ${compact ? 'is-compact' : ''}" aria-haspopup="listbox" aria-expanded="false" ${label ? `aria-label="${esc(label)}"` : ''}>
      <span class="dd-val trunc">${esc(current ? current.label : placeholder)}</span>${icon('chevron-down', { size: 16 })}
    </button></div>`;
}

let pop = null;
function closePop(restore = true) {
  if (!pop) return;
  const { el, trigger, off } = pop; pop = null;
  off(); el.remove();
  if (trigger) { trigger.setAttribute('aria-expanded', 'false'); if (restore) trigger.focus({ preventScroll: true }); }
}
export const closePopovers = () => closePop(false);

function place(el, anchor, { align = 'start', matchWidth = true } = {}) {
  const r = anchor.getBoundingClientRect(), vw = window.innerWidth, vh = (window.visualViewport?.height || window.innerHeight);
  el.style.minWidth = matchWidth ? `${r.width}px` : '';
  el.style.maxHeight = `${Math.min(340, vh * 0.5)}px`;
  const h = Math.min(el.scrollHeight + 2, parseFloat(el.style.maxHeight));
  const below = vh - r.bottom - 12, above = r.top - 12;
  const up = below < h && above > below;
  el.style.top = `${Math.max(8, Math.min(up ? r.top - h - 6 : r.bottom + 6, vh - h - 8))}px`;   // always fully inside the viewport
  el.style.setProperty('--origin', up ? 'bottom' : 'top');
  const w = Math.max(el.offsetWidth, r.width);
  let left = align === 'end' ? r.right - w : r.left;
  left = Math.max(8, Math.min(left, vw - w - 8));
  el.style.left = `${left}px`;
}

function attachDismiss(el, anchor, reposition) {
  const onDown = e => { if (!el.contains(e.target) && !anchor.contains(e.target)) closePop(false); };
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); closePop(true); } };
  const onScroll = e => {
    if (el.contains(e.target)) return;
    const r = anchor.getBoundingClientRect();
    if (!document.contains(anchor) || r.bottom < 0 || r.top > window.innerHeight) closePop(false); else reposition();   // follow the anchor instead of closing
  };
  const onResize = () => closePop(false);
  document.addEventListener('pointerdown', onDown, true);
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', onResize);
  return () => { document.removeEventListener('pointerdown', onDown, true); document.removeEventListener('keydown', onKey, true); window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', onResize); };
}

/** The screen can re-render while a list is open (state change, sync). Find the live copy of the select if ours was replaced. */
function liveSelect(select) {
  if (select.isConnected) return select;
  const attr = (k, v) => `select[${k}="${CSS.escape(v)}"]`;
  const q = select.id ? `select#${CSS.escape(select.id)}` : select.name ? attr('name', select.name) : select.dataset.change ? `${attr('data-change', select.dataset.change)}${select.dataset.id ? attr('data-id', select.dataset.id).slice(6) : ''}` : '';
  return (q && document.querySelector(q)) || select;
}
function setValue(select, trigger, opt) {
  select = liveSelect(select);
  if (!trigger.isConnected) trigger = select.closest('[data-dd]')?.querySelector('.dd-trigger') || trigger;
  select.value = opt.value;
  trigger.querySelector('.dd-val').textContent = opt.label;
  select.dispatchEvent(new Event('input', { bubbles: true }));
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

function openSelect(trigger) {
  const wrap = trigger.closest('[data-dd]'); const select = wrap.querySelector('select');
  if (pop?.trigger === trigger) { closePop(); return; }
  closePop(false);
  const opts = [...select.options].map(o => ({ value: o.value, label: o.textContent }));
  const label = trigger.getAttribute('aria-label') || '';

  if (window.innerWidth < 720) {                         // phone: picker sheet, easy to hit with a thumb
    const api = openSheet({ title: label || 'Choose', size: 'narrow', overlayClass: 'is-picker', body: `<div class="picker-list" role="listbox">${opts.map(o => `<button type="button" class="dd-opt" role="option" aria-selected="${o.value === select.value}" data-v="${esc(o.value)}"><span>${esc(o.label)}</span>${o.value === select.value ? icon('check', { size: 18 }) : ''}</button>`).join('')}</div>` });
    api.el.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; setValue(select, trigger, opts.find(o => o.value === b.dataset.v)); api.close(); });
    setTimeout(() => api.el.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'center' }), 60);
    return;
  }

  const el = document.createElement('div');
  el.className = 'dd-pop'; el.setAttribute('role', 'listbox'); el.tabIndex = -1;
  el.innerHTML = opts.map((o, i) => `<button type="button" class="dd-opt" role="option" id="ddo-${i}" aria-selected="${o.value === select.value}" data-i="${i}"><span>${esc(o.label)}</span>${o.value === select.value ? icon('check', { size: 16 }) : ''}</button>`).join('');
  document.body.appendChild(el);
  place(el, trigger);
  trigger.setAttribute('aria-expanded', 'true');
  pop = { el, trigger, off: attachDismiss(el, trigger, () => place(el, trigger)) };
  let active = Math.max(0, opts.findIndex(o => o.value === select.value));
  const items = () => [...el.querySelectorAll('.dd-opt')];
  const mark = i => { active = (i + opts.length) % opts.length; items().forEach((n, k) => n.classList.toggle('is-active', k === active)); items()[active].scrollIntoView({ block: 'nearest' }); };
  mark(active); el.focus({ preventScroll: true });
  let typed = '', typedTimer;
  el.addEventListener('click', e => { const b = e.target.closest('.dd-opt'); if (!b) return; setValue(select, trigger, opts[Number(b.dataset.i)]); closePop(); });
  el.addEventListener('mousemove', e => { const b = e.target.closest('.dd-opt'); if (b) { items().forEach(n => n.classList.remove('is-active')); b.classList.add('is-active'); active = Number(b.dataset.i); } });
  el.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); mark(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); mark(active - 1); }
    else if (e.key === 'Home') { e.preventDefault(); mark(0); } else if (e.key === 'End') { e.preventDefault(); mark(opts.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setValue(select, trigger, opts[active]); closePop(); }
    else if (e.key === 'Tab') closePop(false);
    else if (e.key.length === 1) { typed += e.key.toLowerCase(); clearTimeout(typedTimer); typedTimer = setTimeout(() => { typed = ''; }, 600); const hit = opts.findIndex(o => o.label.toLowerCase().startsWith(typed)); if (hit >= 0) mark(hit); }
  });
}

/** Action menu anchored to a button. items: [{label, icon, danger, onClick}] or 'sep'. */
export function openMenu(anchor, items) {
  if (pop?.trigger === anchor) { closePop(); return; }
  closePop(false);
  const el = document.createElement('div');
  el.className = 'menu'; el.setAttribute('role', 'menu');
  el.innerHTML = items.map((it, i) => it === 'sep' ? '<div class="menu-sep"></div>' : `<button type="button" role="menuitem" class="menu-item ${it.danger ? 'is-danger' : ''}" data-i="${i}"><span>${esc(it.label)}</span>${it.icon ? icon(it.icon, { size: 18 }) : ''}</button>`).join('');
  document.body.appendChild(el);
  place(el, anchor, { align: 'end', matchWidth: false });
  anchor.setAttribute('aria-expanded', 'true');
  pop = { el, trigger: anchor, off: attachDismiss(el, anchor, () => place(el, anchor, { align: 'end', matchWidth: false })) };
  const nodes = [...el.querySelectorAll('.menu-item')];
  nodes[0]?.focus({ preventScroll: true });
  el.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (!b) return; const it = items[Number(b.dataset.i)]; closePop(false); it.onClick?.(); });
  el.addEventListener('keydown', e => {
    const i = nodes.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); nodes[(i + 1) % nodes.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); nodes[(i - 1 + nodes.length) % nodes.length].focus(); }
    else if (e.key === 'Tab') closePop(false);
  });
}

/* delegated: trigger open + keyboard open */
document.addEventListener('click', e => {
  const t = e.target.closest?.('.dd-trigger');
  if (t && !t.disabled) { e.preventDefault(); openSelect(t); }
});
document.addEventListener('keydown', e => {
  const t = e.target.closest?.('.dd-trigger');
  if (t && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); openSelect(t); }
});
