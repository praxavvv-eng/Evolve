/* Applies the Appearance settings to <html>. The stylesheet only reads attributes and CSS variables,
 * so every screen follows the same switches.  "System" is resolved here into data-scheme="dark"|"light". */
import * as State from './state.js';
import { ACCENTS } from '../storage/migration.js';
import { hexToRgb, readableOn } from './utils.js';
import { on } from './events.js';

const dark = window.matchMedia('(prefers-color-scheme: dark)');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

export const accentHex = s => s.customAccent || ACCENTS[s.accent]?.hex || ACCENTS.champagne.hex;
const mix = (rgb, t, k) => rgb.map((c, i) => Math.round(c * (1 - k) + t[i] * k));
const hex = rgb => `#${rgb.map(c => c.toString(16).padStart(2, '0')).join('')}`;

export function resolveScheme(s) { return s.theme === 'system' ? (dark.matches ? 'dark' : 'light') : s.theme; }

let firstApply = true;
export function applyAppearance() {
  const s = State.get().settings, root = document.documentElement;
  if (!firstApply && root.dataset.motion !== 'reduce') { root.classList.add('theme-anim'); clearTimeout(applyAppearance.t); applyAppearance.t = setTimeout(() => root.classList.remove('theme-anim'), 450); }   // smooth colour cross-fade
  firstApply = false;
  const scheme = resolveScheme(s);
  root.dataset.scheme = scheme;
  root.dataset.amoled = String(s.amoled && scheme === 'dark');
  root.dataset.density = s.density;
  root.dataset.text = s.textSize;
  root.dataset.motion = s.motion === 'reduce' || (s.motion === 'system' && reduce.matches) ? 'reduce' : 'full';

  const base = accentHex(s), rgb = hexToRgb(base);
  /* Light surfaces need a darker accent for text and icons so contrast stays readable */
  const text = scheme === 'light' ? hex(mix(rgb, [0, 0, 0], 0.5)) : base;
  root.style.setProperty('--accent', base);
  root.style.setProperty('--accent-rgb', rgb.join(', '));
  root.style.setProperty('--accent-text', text);
  root.style.setProperty('--on-accent', readableOn(base));
  const g = Number(s.glass) / 100;
  root.style.setProperty('--glass-blur', `${Math.round(6 + g * 26)}px`);
  root.style.setProperty('--glass-alpha', (0.94 - g * 0.36).toFixed(2));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', scheme === 'light' ? '#f3f0ea' : (root.dataset.amoled === 'true' ? '#000000' : '#0f0f11'));
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
