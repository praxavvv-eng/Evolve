/* Chart helpers. Each returns an HTML string. Charts only draw what they are given; callers decide
 * whether there is enough real data to show one at all. Responsive: SVGs use viewBox, bars use flex. */
import { esc, clamp } from '../core/utils.js';

export const CHART_COLORS = ['#d4bc8e', '#94b8d0', '#d39a6e', '#93c7a4', '#cda39b', '#b8b8c0', '#e5bd73', '#7fb5a6'];

/** Progress ring. value 0-100. */
export function ring({ value = 0, size = 120, stroke = 10, label = '', sub = '', color = '', title = '' } = {}) {
  const v = clamp(value) / 100, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return `<div class="ring" style="--size:${size}px;${color ? `--ring:${color};` : ''}" role="img" aria-label="${esc(title || `${Math.round(v * 100)} percent`)}">
    <svg viewBox="0 0 ${size} ${size}"><circle class="ring-bg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"/><circle class="ring-fg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" style="--c:${c.toFixed(2)};--p:${v.toFixed(4)}"/></svg>
    ${label !== '' ? `<div class="ring-label"><b>${esc(label)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>` : ''}</div>`;
}

/** Thin progress bar. */
export function progressBar(value, cls = '') { return `<div class="bar ${cls}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(clamp(value))}"><span style="--w:${clamp(value).toFixed(1)}%"></span></div>`; }

/**
 * Vertical bars. items: [{label, value, today?, on?, segments?:[{v,color,name}], title?}]
 * Stacked bars use segments; otherwise value.
 */
export function bars({ items = [], height = 128, max, showValues = false, fmt = v => v, ariaLabel = 'Bar chart' } = {}) {
  const totals = items.map(i => (i.segments ? i.segments.reduce((a, s) => a + s.v, 0) : i.value || 0));
  const top = max || Math.max(1, ...totals);
  const gap = items.length > 14 ? 3 : 8;
  return `<div class="bars" style="--h:${height}px;--gap:${gap}px" role="img" aria-label="${esc(ariaLabel)}">${items.map((it, k) => {
    const t = totals[k], h = t > 0 ? Math.max(4, (t / top) * 100) : 0;
    const inner = it.segments ? it.segments.filter(s => s.v > 0).map(s => `<i style="--sh:${(s.v / t) * 100}%;--sc:${s.color}" title="${esc(s.name || '')}"></i>`).join('') : '';
    return `<div class="bar-col ${it.today ? 'is-today' : ''}" title="${esc(it.title || `${it.label}: ${fmt(t)}`)}" style="--k:${k}">
      ${showValues ? `<span class="bar-val">${t > 0 ? esc(fmt(t)) : ''}</span>` : ''}
      <div class="bar-track"><div class="bar-fill ${it.on || (!it.segments && t > 0) ? 'is-on' : ''} ${it.today ? 'is-today' : ''}" style="--bh:${h}%">${inner}</div></div>
      <span class="bar-lab">${esc(it.label)}</span></div>`;
  }).join('')}</div>`;
}

/** Line + area chart. points: [{x:label, y:number}] (needs 2+). */
export function lineChart({ points = [], height = 150, fmt = v => v, ariaLabel = 'Line chart' } = {}) {
  if (points.length < 2) return '';
  const W = 320, H = height, padL = 34, padR = 8, padT = 10, padB = 22;
  const ys = points.map(p => p.y);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  if (lo === hi) { lo -= 1; hi += 1; }
  const span = hi - lo; lo -= span * 0.1; hi += span * 0.1;
  const X = i => padL + (i / (points.length - 1)) * (W - padL - padR);
  const Y = v => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.y).toFixed(1)}`).join(' ');
  const area = `${d} L${X(points.length - 1).toFixed(1)} ${H - padB} L${X(0).toFixed(1)} ${H - padB} Z`;
  const ticks = [lo + (hi - lo) * 0.1, (lo + hi) / 2, hi - (hi - lo) * 0.1];
  const xi = [0, Math.floor((points.length - 1) / 2), points.length - 1].filter((v, i, a) => a.indexOf(v) === i);
  return `<svg class="svg-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(ariaLabel)}" preserveAspectRatio="xMidYMid meet">
    <defs><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".32"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
    ${ticks.map(t => `<line class="grid-line" x1="${padL}" x2="${W - padR}" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}"/><text class="axis-lab" x="${padL - 6}" y="${(Y(t) + 3).toFixed(1)}" text-anchor="end">${esc(fmt(t))}</text>`).join('')}
    <path class="area" d="${area}"/><path class="line" pathLength="1" d="${d}"/>
    ${points.length <= 24 ? points.map((p, i) => `<circle class="dot" cx="${X(i).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3.2"><title>${esc(`${p.x}: ${fmt(p.y)}`)}</title></circle>`).join('') : ''}
    ${xi.map((i, k) => `<text class="axis-lab" x="${X(i).toFixed(1)}" y="${H - 4}" text-anchor="${k === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}">${esc(points[i].x)}</text>`).join('')}</svg>`;
}

/** Donut. segments: [{label, value, color}] */
export function donut({ segments = [], size = 150, stroke = 18, centerTop = '', centerBottom = '' } = {}) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  if (!(total > 0)) return '';
  const r = (size - stroke) / 2, c = 2 * Math.PI * r; let acc = 0;
  const gapLen = segments.length > 1 ? 2.5 : 0;
  return `<div class="ring" style="--size:${size}px;--lab:0.15" role="img" aria-label="${esc(segments.map(s => `${s.label} ${Math.round(s.value / total * 100)}%`).join(', '))}">
    <svg viewBox="0 0 ${size} ${size}"><circle class="ring-bg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"/>${segments.map(s => {
      const len = (s.value / total) * c; const out = `<circle class="donut-seg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" stroke="${s.color}" stroke-dasharray="${Math.max(0, len - gapLen).toFixed(2)} ${(c - Math.max(0, len - gapLen)).toFixed(2)}" stroke-dashoffset="${(-acc).toFixed(2)}"><title>${esc(s.label)}</title></circle>`; acc += len; return out;
    }).join('')}</svg>
    ${centerTop ? `<div class="ring-label"><b>${esc(centerTop)}</b>${centerBottom ? `<small>${esc(centerBottom)}</small>` : ''}</div>` : ''}</div>`;
}

export const legend = items => `<div class="legend">${items.map(i => `<span><i style="--c:${i.color}"></i>${esc(i.label)}</span>`).join('')}</div>`;
