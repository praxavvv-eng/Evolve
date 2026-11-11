/* Shared helpers: DOM, dates, number/currency formatting, small pure utilities. No state imports. */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ESC[c]);

/* ---------- dates (all dates are local YYYY-MM-DD strings) ---------- */
const pad = n => String(n).padStart(2, '0');
export const dateStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = () => dateStr(new Date());
export const isDateStr = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00:00`).getTime());
export const parseDate = v => (isDateStr(v) ? new Date(`${v}T00:00:00`) : null);
export const addDays = (v, n) => { const d = parseDate(v) || new Date(); d.setDate(d.getDate() + n); return dateStr(d); };
export const daysAgo = n => addDays(todayStr(), -n);
export const diffDays = (a, b) => Math.round((parseDate(a) - parseDate(b)) / 86400000);
export const monthKey = v => String(v || '').slice(0, 7);
export const addMonths = (key, n) => { const [y, m] = key.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
export const daysInMonth = key => { const [y, m] = key.split('-').map(Number); return new Date(y, m, 0).getDate(); };
export const rangeDates = (from, to) => { const out = []; let c = from; for (let i = 0; c <= to && i < 4000; i++) { out.push(c); c = addDays(c, 1); } return out; };

const LOCALE = 'en-IN';
export const fmtDate = (v, o = { day: 'numeric', month: 'short' }) => { const d = parseDate(v); return d ? d.toLocaleDateString(LOCALE, o) : '—'; };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Compact day + month, e.g. "21 Sep". Fixed names so chart labels never vary by browser locale. */
export const fmtDM = v => { const d = parseDate(v); return d ? `${d.getDate()} ${MON[d.getMonth()]}` : '—'; };
export const fmtLong = (d = new Date()) => d.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
export const fmtMonth = key => { const [y, m] = key.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' }); };
export const fmtMonthShort = key => { const [y, m] = key.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString(LOCALE, { month: 'short' }); };
export const weekdayShort = v => (parseDate(v) || new Date()).toLocaleDateString(LOCALE, { weekday: 'short' });
export const weekdayInitial = v => weekdayShort(v).slice(0, 1);

/** Friendly relative label: Today, Tomorrow, Yesterday, In 3 days, 2 days overdue. */
export function relDay(v, { done = false } = {}) {
  if (!isDateStr(v)) return 'No date';
  const n = diffDays(v, todayStr());
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return done ? 'Yesterday' : '1 day overdue';
  if (n > 1 && n < 8) return `In ${n} days`;
  if (n < -1 && n > -31) return done ? fmtDate(v) : `${-n} days overdue`;
  return fmtDate(v);
}

export const greeting = () => { const h = new Date().getHours(); return h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

/* ---------- numbers ---------- */
export const clamp = (v, min = 0, max = 100) => Math.min(max, Math.max(min, Number(v) || 0));
export const num = (v, fallback = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };
export const sum = (arr, fn = x => x) => arr.reduce((t, x) => t + (Number(fn(x)) || 0), 0);
export const pct = (a, b) => (b > 0 ? clamp((a / b) * 100) : 0);
export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const compact = n => new Intl.NumberFormat(LOCALE, { notation: 'compact', maximumFractionDigits: 1 }).format(num(n));
export const fmtNum = (n, digits = 0) => num(n).toLocaleString(LOCALE, { maximumFractionDigits: digits });

let currencyCode = 'INR';
export const setCurrency = code => { currencyCode = code || 'INR'; };
export function money(amount, { sign = false, compactMode = false } = {}) {
  const v = num(amount);
  try {
    const opts = { style: 'currency', currency: currencyCode, maximumFractionDigits: v % 1 !== 0 ? 2 : 0, minimumFractionDigits: v % 1 !== 0 ? 2 : 0 };
    if (compactMode && Math.abs(v) >= 100000) { opts.notation = 'compact'; opts.maximumFractionDigits = 1; }
    const out = new Intl.NumberFormat(LOCALE, opts).format(Math.abs(v));
    return `${v < 0 ? '−' : sign && v > 0 ? '+' : ''}${out}`;
  } catch { return `${v < 0 ? '−' : ''}${Math.abs(v).toLocaleString(LOCALE)}`; }
}
export const currencySymbol = () => { try { return new Intl.NumberFormat(LOCALE, { style: 'currency', currency: currencyCode }).formatToParts(0).find(p => p.type === 'currency')?.value || currencyCode; } catch { return currencyCode; } };

/* ---------- misc ---------- */
export const uid = (prefix = 'id') => {
  const r = (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${r}`;
};
export const debounce = (fn, ms = 150) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const groupBy = (arr, fn) => arr.reduce((m, x) => { const k = fn(x); (m[k] ||= []).push(x); return m; }, {});
export const uniq = arr => [...new Set(arr)];
export const clone = v => JSON.parse(JSON.stringify(v));
export const cmpStr = (a, b) => String(a ?? '').localeCompare(String(b ?? ''));
export const hashStr = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return Math.abs(h); };
export const initials = (name, n = 2) => String(name || '?').trim().split(/\s+/).slice(0, n).map(p => p[0]?.toUpperCase() || '').join('') || '?';

export function downloadFile(filename, content, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Relative luminance -> readable text colour for a given background hex. */
export function readableOn(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#0b0b0c';
  const [r, g, b] = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.42 ? '#0b0b0c' : '#fbf8f2';
}
export const hexToRgb = hex => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); return m ? [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)) : [201, 177, 138]; };
