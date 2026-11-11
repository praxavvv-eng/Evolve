/* Toasts. toast(message, {type:'success'|'error', xp, action:{label,onClick}, duration}). */
import { esc } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { on } from '../core/events.js';

let region;
function host() {
  if (!region) { region = document.createElement('div'); region.className = 'toasts'; region.setAttribute('role', 'status'); region.setAttribute('aria-live', 'polite'); document.body.appendChild(region); }
  return region;
}

export function toast(message, { type = 'success', xp = 0, action = null, duration } = {}) {
  const node = document.createElement('div');
  node.className = `toast ${type === 'error' ? 'is-error' : ''}`;
  node.innerHTML = `<span class="t-mark">${icon(type === 'error' ? 'alert' : 'check', { size: 14 })}</span><span class="t-msg">${esc(message)}</span>${xp > 0 ? `<span class="t-xp">+${xp} XP</span>` : ''}${action ? `<button type="button">${esc(action.label || 'Undo')}</button>` : ''}`;
  const dismiss = () => { if (node.classList.contains('is-leaving')) return; node.classList.add('is-leaving'); setTimeout(() => node.remove(), 260); };
  node.querySelector('button')?.addEventListener('click', () => { action.onClick?.(); dismiss(); });
  const r = host();
  while (r.children.length >= 3) r.firstElementChild.remove();
  r.appendChild(node);
  setTimeout(dismiss, duration || (type === 'error' ? 6500 : action ? 5500 : 2800));
  return dismiss;
}

on('toast', d => toast(d.message, d));
