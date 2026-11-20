/* Applies the Appearance settings to <html>. The stylesheets only read attributes and CSS variables,
 * so every screen follows the same switches. "System" is resolved here into data-scheme="dark"|"light".
 * Accent colours are made accessible per theme: filled controls always get readable text, and accent-coloured
 * text and icons are nudged until they pass contrast on the page background. */
import * as State from './state.js';
import { ACCENTS, APP_STYLES, NAV_STYLES } from '../storage/migration.js';
import { hexToRgb, hexToHsl, hslToHex } from './utils.js';
import { on } from './events.js';

const dark = window.matchMedia('(prefers-color-scheme: dark)');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

export const accentHex = s => s.customAccent || ACCENTS[s.accent]?.hex || ACCENTS.blue.hex;
export function resolveScheme(s) { return s.theme === 'system' ? (dark.matches ? 'dark' : 'light') : s.theme; }

/* ---------- WCAG contrast helpers ---------- */
const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export const luminance = hex => { const [r, g, b] = hexToRgb(hex); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
export const contrast = (a, b) => { const x = luminance(a), y = luminance(b), hi = Math.max(x, y), lo = Math.min(x, y); return (hi + 0.05) / (lo + 0.05); };

/** Move lightness one step at a time until `hex` reaches `min` contrast against `against`. */
function tune(hex, against, min, dir) {
  let [h, s, l] = hexToHsl(hex), out = hex;
  for (let i = 0; i < 60 && contrast(out, against) < min; i++) { l += dir; if (l < 4 || l > 96) break; out = hslToHex(h, s, l); }
  return out;
}

/** Filled accent + readable label colour. White text is preferred when it can reach 4.5:1 by deepening the fill. */
export function fillFor(hex) {
  const white = contrast(hex, '#ffffff');
  if (white >= 3.1) return { fill: tune(hex, '#ffffff', 4.5, -1), on: '#ffffff' };
  return { fill: hex, on: '#0b0b0f' };
}

/** Accent as text / icon colour on the page background of the given scheme. */
export const textFor = (hex, scheme, amoled) => (scheme === 'light' ? tune(hex, '#ffffff', 4.5, -1) : tune(hex, amoled ? '#000000' : '#0d0d10', 4.5, +1));

let firstApply = true;
export function applyAppearance() {
  const s = State.get().settings, root = document.documentElement;
  if (!firstApply && root.dataset.motion !== 'reduce') { root.classList.add('theme-anim'); clearTimeout(applyAppearance.t); applyAppearance.t = setTimeout(() => root.classList.remove('theme-anim'), 420); }   // smooth colour cross-fade
  firstApply = false;
  const scheme = resolveScheme(s), amoled = s.amoled && scheme === 'dark';
  root.dataset.scheme = scheme;
  root.dataset.amoled = String(amoled);
  root.dataset.density = s.density;
  root.dataset.text = s.textSize;
  root.dataset.style = APP_STYLES.includes(s.style) ? s.style : 'minimal';
  root.dataset.navstyle = NAV_STYLES.includes(s.navStyle) ? s.navStyle : 'minimal';
  root.dataset.motion = s.motion === 'reduce' || (s.motion === 'system' && reduce.matches) ? 'reduce' : 'full';
  const lowEnd = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
  root.dataset.gfx = lowEnd ? 'lite' : 'full';

  const base = accentHex(s), { fill, on } = fillFor(base), text = textFor(base, scheme, amoled);
  root.style.setProperty('--accent', fill);
  root.style.setProperty('--accent-rgb', hexToRgb(fill).join(', '));
  root.style.setProperty('--accent-text', text);
  root.style.setProperty('--on-accent', on);
  const g = Number(s.glass) / 100;
  root.style.setProperty('--glass-blur', `${Math.round(8 + g * 26)}px`);
  root.style.setProperty('--glass-alpha', (0.92 - g * 0.4).toFixed(2));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', scheme === 'light' ? '#ffffff' : (amoled ? '#000000' : '#0d0d10'));
}

export function initAppearance() {
  applyAppearance();
  dark.addEventListener?.('change', applyAppearance);
  reduce.addEventListener?.('change', applyAppearance);
  on('settings:changed', applyAppearance);
}

export function setSetting(patch) {
  State.update(s => { Object.assign(s.settings, patch); }, { silent: true });
  applyAppearance();
  document.dispatchEvent(new CustomEvent('evolve:settings'));
}
