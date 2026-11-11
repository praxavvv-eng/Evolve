/* Sheet / dialog manager.
 * One component, two presentations (CSS decides): bottom sheet on phones, centred dialog on wide screens.
 * Features: stacking, focus trap, Escape + backdrop to close, focus restore, drag-down to dismiss on touch, keyboard-aware height. */
import { esc } from '../core/utils.js';
import { icon } from '../core/icons.js';

const stack = [];
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function syncViewport() {
  const vv = window.visualViewport;
  document.documentElement.style.setProperty('--vvh', `${vv ? vv.height : window.innerHeight}px`);
}
if (window.visualViewport) { window.visualViewport.addEventListener('resize', syncViewport); window.visualViewport.addEventListener('scroll', syncViewport); }
syncViewport();

export const isOpen = () => stack.length > 0;
export const topSheet = () => stack[stack.length - 1] || null;

/**
 * @param {{title?:string, subtitle?:string, body?:string, footer?:string, size?:''|'wide'|'narrow', className?:string,
 *          dismissable?:boolean, onMount?:(root:HTMLElement,api:object)=>void, onClose?:()=>void, overlayClass?:string, bare?:boolean}} o
 */
export function openSheet(o = {}) {
  const opener = document.activeElement;
  const overlay = document.createElement('div');
  overlay.className = `overlay ${o.overlayClass || ''} ${stack.length ? 'is-stacked' : ''}`;
  const labelId = `sheet-title-${stack.length}`;
  overlay.innerHTML = o.bare ? o.body : `
    <section class="sheet ${o.size ? `sheet-${o.size}` : ''} ${o.className || ''}" role="dialog" aria-modal="true" ${o.title ? `aria-labelledby="${labelId}"` : ''}>
      <div class="sheet-handle" data-drag></div>
      <header class="sheet-head" data-drag>
        <div><h2 id="${labelId}">${esc(o.title || '')}</h2>${o.subtitle ? `<p>${esc(o.subtitle)}</p>` : ''}</div>
        <button class="icon-btn is-solid" type="button" data-sheet-close aria-label="Close">${icon('x', { size: 18 })}</button>
      </header>
      <div class="sheet-body">${o.body || ''}</div>
      ${o.footer ? `<footer class="sheet-foot">${o.footer}</footer>` : ''}
    </section>`;
  document.body.appendChild(overlay);
  document.body.classList.add('is-locked');
  const sheet = overlay.querySelector('.sheet, .palette') || overlay;
  let closed = false;

  const api = {
    el: overlay, sheet, body: overlay.querySelector('.sheet-body') || overlay,
    close(result) {
      if (closed) return; closed = true;
      const i = stack.indexOf(api); if (i >= 0) stack.splice(i, 1);
      overlay.classList.remove('is-open');
      if (!stack.length) document.body.classList.remove('is-locked');
      setTimeout(() => overlay.remove(), 320);
      try { o.onClose?.(result); } catch (e) { console.error(e); }
      if (opener && document.contains(opener) && typeof opener.focus === 'function') setTimeout(() => opener.focus({ preventScroll: true }), 30);
    },
    dismissable: o.dismissable !== false
  };
  stack.push(api);

  overlay.addEventListener('mousedown', e => { if (e.target === overlay && api.dismissable) api.close(); });
  overlay.addEventListener('click', e => { if (e.target.closest('[data-sheet-close]')) api.close(); });

  /* drag-to-dismiss (touch, phones only) */
  const handle = overlay.querySelectorAll('[data-drag]');
  let startY = 0, dy = 0, dragging = false;
  handle.forEach(h => {
    h.addEventListener('touchstart', e => { if (window.innerWidth >= 720 || !api.dismissable) return; startY = e.touches[0].clientY; dy = 0; dragging = true; sheet.classList.add('is-dragging'); }, { passive: true });
    h.addEventListener('touchmove', e => { if (!dragging) return; dy = Math.max(0, e.touches[0].clientY - startY); sheet.style.transform = `translateY(${dy}px)`; }, { passive: true });
    h.addEventListener('touchend', () => {
      if (!dragging) return; dragging = false; sheet.classList.remove('is-dragging');
      if (dy > 110) api.close(); else sheet.style.transform = '';
    });
  });

  requestAnimationFrame(() => requestAnimationFrame(() => {
    overlay.classList.add('is-open');
    o.onMount?.(overlay, api);
    if (!overlay.contains(document.activeElement)) {
      const first = overlay.querySelector('[data-autofocus]') || overlay.querySelector('.sheet-body input:not([type=hidden]):not([type=range]), .sheet-body textarea, .sheet-body select');
      (window.matchMedia('(pointer: fine)').matches && first ? first : sheet)?.focus?.({ preventScroll: true });
    }
  }));
  if (sheet.setAttribute && !sheet.hasAttribute('tabindex')) sheet.setAttribute('tabindex', '-1');
  return api;
}

/* Escape + focus trap for the top-most sheet */
document.addEventListener('keydown', e => {
  const top = topSheet(); if (!top) return;
  if (e.key === 'Escape') {
    if (document.querySelector('.dd-pop, .menu')) return;      // popovers handle their own Escape first
    if (top.dismissable) { e.preventDefault(); top.close(); }
    return;
  }
  if (e.key !== 'Tab') return;
  const nodes = [...top.el.querySelectorAll(FOCUSABLE)].filter(n => n.offsetParent !== null || n === document.activeElement);
  if (!nodes.length) return;
  const first = nodes[0], last = nodes[nodes.length - 1];
  if (e.shiftKey && (document.activeElement === first || document.activeElement === top.sheet)) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

/** Accessible replacement for window.confirm. Resolves true/false. */
export function confirmDialog({ title = 'Are you sure?', message = '', confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false } = {}) {
  return new Promise(resolve => {
    let decided = false;
    const api = openSheet({
      title, size: 'narrow', overlayClass: 'is-confirm',
      body: `<p class="confirm-text">${message}</p>`,
      footer: `<button class="btn btn-ghost" type="button" data-no>${esc(cancelLabel)}</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" type="button" data-yes data-autofocus>${esc(confirmLabel)}</button>`,
      onClose: () => { if (!decided) resolve(false); }
    });
    api.el.querySelector('[data-yes]').addEventListener('click', () => { decided = true; resolve(true); api.close(); });
    api.el.querySelector('[data-no]').addEventListener('click', () => api.close());
  });
}

export function closeAllSheets() { [...stack].forEach(s => s.close()); }
