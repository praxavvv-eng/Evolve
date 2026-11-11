/* Shared view helpers used by every module, plus the generic actions
 * (open a form, open a row menu, delete) that any list can trigger with data-action attributes. */
import { esc } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { registerActions, emit } from '../core/events.js';
import { openForm, deleteWithUndo } from './forms.js';
import { openMenu } from './dropdown.js';
import { schemas } from '../core/schemas.js';

export const pageHead = ({ title, sub = '', eyebrow = '', actions = '' }) => `
  <header class="page-head" style="--i:0">
    <div class="trunc-wrap" style="min-width:0">${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}<h1 class="t-title">${esc(title)}</h1>${sub ? `<p class="t-body">${esc(sub)}</p>` : ''}</div>
    ${actions ? `<div class="page-head-actions">${actions}</div>` : ''}
  </header>`;

export const sectionHead = (title, sub = '', action = '') => `<div class="sec-head"><div><h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div>${action}</div>`;

export const emptyState = ({ icon: ic = 'sparkles', title, text = '', action = '' }) => `
  <div class="empty"><div class="empty-art">${icon(ic, { size: 28 })}</div><h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}${action}</div>`;

/** Button that opens the form for a record type. */
export const addBtn = (type, label, { cls = 'btn btn-primary btn-sm', prefill = null, id = '' } = {}) =>
  `<button type="button" class="${cls}" data-action="form" data-type="${type}" ${id ? `data-id="${esc(id)}"` : ''} ${prefill ? `data-prefill="${esc(JSON.stringify(prefill))}"` : ''}>${icon(id ? 'edit' : 'plus', { size: 16 })}${esc(label)}</button>`;

/** Trailing "more" button for list rows (Edit / Delete). */
export const kebab = (type, id, label = 'More actions') => `<button type="button" class="icon-btn" data-action="row-menu" data-type="${type}" data-id="${esc(id)}" aria-haspopup="menu" aria-expanded="false" aria-label="${esc(label)}">${icon('more', { size: 20 })}</button>`;

export const badge = (text, kind = '') => `<span class="badge ${kind ? `badge-${kind}` : ''}">${esc(text)}</span>`;
export const link = (href, inner, cls = '') => `<a class="${cls}" href="${href}">${inner}</a>`;

export function sheetNote(text) { return `<p class="form-note">${esc(text)}</p>`; }

registerActions({
  form(el) {
    let prefill = {};
    try { prefill = el.dataset.prefill ? JSON.parse(el.dataset.prefill) : {}; } catch { /* ignore bad prefill */ }
    openForm(el.dataset.type, { id: el.dataset.id || '', prefill });
  },
  'row-menu'(el) {
    const { type, id } = el.dataset;
    const items = [{ label: 'Edit', icon: 'edit', onClick: () => openForm(type, { id }) }, 'sep', { label: 'Delete', icon: 'trash', danger: true, onClick: () => deleteWithUndo(type, id, { onDone: () => emit('state:changed') }) }];
    openMenu(el, items);
  },
  delete(el) { deleteWithUndo(el.dataset.type, el.dataset.id, { onDone: () => { if (el.dataset.back) location.hash = el.dataset.back; } }); }
});

export const typeLabel = type => schemas[type]?.label || type;
