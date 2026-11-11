/* Hash router. Routes look like #/finance or #/finance/tx/<id>; the first segment picks the module,
 * the rest is passed to it. Hash routes survive refresh and work with Live Server without any rewrite rules.
 * A module that throws while rendering shows an error card instead of blanking the app. */
import { on } from './core/events.js';
import { esc } from './core/utils.js';
import { DEFAULT_ROUTE } from './nav.js';

const routes = new Map();
let view, onRoute = () => {}, last = '', frame = 0;

export const register = route => routes.set(route.id, route);
export const parse = (hash = location.hash) => {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const id = parts.shift() || DEFAULT_ROUTE;
  return { id, parts };
};
export const current = () => parse();
export const navigate = (path, { replace = false } = {}) => {
  const target = `#/${path.replace(/^#?\/?/, '')}`;
  if (replace) history.replaceState(null, '', target); else location.hash = target;
  if (replace) render({ forceAnimate: true });
};
export const href = (...segments) => `#/${segments.map(encodeURIComponent).join('/')}`;

function errorCard(err, id) {
  console.error(`[router] "${id}" failed to render`, err);
  return `<div class="empty"><div class="empty-art">!</div><h3>This screen could not be drawn</h3><p>Your data is safe. Details: ${esc(err?.message || err)}</p><a class="btn btn-primary" href="#/home">Back to Home</a></div>`;
}

export function render({ forceAnimate = false } = {}) {
  const { id, parts } = parse();
  const route = routes.get(id);
  if (!route) { navigate(DEFAULT_ROUTE, { replace: true }); return; }
  const key = `${id}/${parts.join('/')}`;
  const changed = key !== last || forceAnimate;
  const keep = document.activeElement?.dataset?.keep;
  const sel = keep ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
  const scrollY = window.scrollY;

  let html;
  try { html = route.render(parts); } catch (e) { html = errorCard(e, id); }
  view.innerHTML = html;
  view.classList.toggle('is-detail', parts.length > 0);
  view.dataset.module = id;
  if (changed) {
    view.classList.remove('is-entering'); void view.offsetWidth; view.classList.add('is-entering');
    [...view.children].forEach((c, i) => c.style.setProperty('--i', Math.min(i, 8)));
    clearTimeout(render.t); render.t = setTimeout(() => view.classList.remove('is-entering'), 1400);
    window.scrollTo(0, 0);
    if (last) view.focus({ preventScroll: true });
  } else window.scrollTo(0, scrollY);
  try { route.mount?.(view, parts); } catch (e) { console.error(`[router] mount of "${id}" failed`, e); }
  if (keep) { const el = view.querySelector(`[data-keep="${keep}"]`); if (el) { el.focus({ preventScroll: true }); try { el.setSelectionRange(...sel); } catch { /* not a text field */ } } }
  last = key;
  onRoute({ id, parts, route, changed });
}

export const rerender = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => render()); };

export function start(viewEl, hooks = {}) {
  view = viewEl; onRoute = hooks.onRoute || onRoute;
  window.addEventListener('hashchange', () => render());
  on('state:changed', rerender);
  on('view:refresh', rerender);
  render();
}
