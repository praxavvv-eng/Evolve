/* Tiny event bus plus delegated DOM actions.
 * Views emit plain HTML with data-action / data-change / data-input attributes.
 * Modules register handlers once with registerActions(); no per-render listener wiring. */

const subs = new Map();
export function on(name, fn) {
  if (!subs.has(name)) subs.set(name, new Set());
  subs.get(name).add(fn);
  return () => subs.get(name)?.delete(fn);
}
export function emit(name, detail) {
  subs.get(name)?.forEach(fn => { try { fn(detail); } catch (e) { console.error(`[events] handler for "${name}" failed`, e); } });
}

const click = {}, change = {}, input = {};
export function registerActions(map) { Object.assign(click, map); }
export function registerChange(map) { Object.assign(change, map); }
export function registerInput(map) { Object.assign(input, map); }

function find(e, attr) { return e.target instanceof Element ? e.target.closest(`[${attr}]`) : null; }

export function initDelegation() {
  document.addEventListener('click', e => {
    const el = find(e, 'data-action');
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    const fn = click[el.dataset.action];
    if (!fn) { console.warn('[events] no handler for action', el.dataset.action); return; }
    try { fn(el, e); } catch (err) { console.error(`[events] action "${el.dataset.action}" failed`, err); emit('toast', { message: 'Something went wrong. Your data is unchanged.', type: 'error' }); }
  });
  document.addEventListener('change', e => {
    const el = find(e, 'data-change');
    if (!el) return;
    try { change[el.dataset.change]?.(el, e); } catch (err) { console.error('[events] change handler failed', err); }
  });
  document.addEventListener('input', e => {
    const el = find(e, 'data-input');
    if (!el) return;
    try { input[el.dataset.input]?.(el, e); } catch (err) { console.error('[events] input handler failed', err); }
  });
}
