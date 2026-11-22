import { groupedNumber } from '../core/utils.js';
/* Animated numbers, rings and bars that move only when their value actually changes.
 * Elements carry data-anim="<key>" data-type="count|ring|bar" data-to="<value>". render() writes the value currently shown,
 * mount() calls run(), which tweens from what is shown to the new target. Re-renders with an unchanged value, and revisiting the
 * screen, do not replay anything. Reduced motion jumps straight to the value. */
const reg = new Map();
const reduced = () => document.documentElement.dataset.motion === 'reduce';

/** Value currently displayed for a key (0 before the first run). */
export const shown = key => reg.get(key)?.shown ?? 0;

function apply(el, type, v) {
  if (type === 'money') el.textContent = groupedNumber(v, Number(el.dataset.dec) || 0);
  else if (type === 'count') el.textContent = `${Math.round(v)}${el.dataset.suffix || ''}`;
  else if (type === 'ring') el.style.setProperty('--p', (Math.max(0, Math.min(100, v)) / 100).toFixed(4));
  else if (type === 'bar') el.style.setProperty('--w', `${Math.max(0, Math.min(100, v)).toFixed(1)}%`);
}

export function run(root) {
  root.querySelectorAll('[data-anim]').forEach(el => {
    const key = el.dataset.anim, type = el.dataset.type, to = Number(el.dataset.to) || 0;
    let r = reg.get(key); if (!r) { r = { shown: 0, target: null, raf: 0 }; reg.set(key, r); }
    if (r.target === to && !r.raf) { apply(el, type, r.shown); return; }          // unchanged: nothing to animate
    const rising = to > r.shown;
    r.target = to; cancelAnimationFrame(r.raf); r.raf = 0;
    if (rising && type === 'ring') { const host = el.closest('[data-bump]'); if (host && !reduced()) { host.classList.remove('is-bump'); void host.offsetWidth; host.classList.add('is-bump'); } }
    if (reduced()) { r.shown = to; apply(el, type, to); return; }
    if (type !== 'count' && type !== 'money') { r.shown = to; requestAnimationFrame(() => apply(el, type, to)); return; }   // CSS transitions tween rings and bars
    const from = r.shown, t0 = performance.now(), dur = 650;
    const step = now => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - (1 - k) ** 3;
      r.shown = from + (to - from) * e; apply(el, type, r.shown);
      if (k < 1) r.raf = requestAnimationFrame(step); else { r.shown = to; r.raf = 0; apply(el, type, to); }
    };
    r.raf = requestAnimationFrame(step);
  });
}
