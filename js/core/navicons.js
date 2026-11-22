/* Navigation icon families. The same seven navigation glyphs are drawn four ways, so the bottom bar, the sidebar and the
 * Settings previews always come from one family and never mix:
 *   outline  : 1.75 stroke, the default look
 *   rounded  : heavier 2.3 stroke with softer, rounder geometry
 *   filled   : solid shapes
 *   duotone  : outline plus a translucent fill of the same colour
 * Everything is drawn in currentColor, so the active/inactive colour and the accent apply to every family. */
import { icon } from './icons.js';

export const NAV_ICON_FAMILIES = ['outline', 'rounded', 'filled', 'duotone'];
const T = '<g fill="currentColor" fill-opacity="0.3" stroke="none">';   // duotone tint layer
const F = '<g fill="currentColor" stroke="none">';                        // filled layer

const SETS = {
  home: {
    rounded: '<path d="M4 11.2 12 4.6l8 6.6V18a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18z"/><path d="M9.5 20.5v-5a2.5 2.5 0 0 1 5 0v5"/>',
    filled: `${F}<path fill-rule="evenodd" d="M11.2 3.5a1.3 1.3 0 0 1 1.6 0l7.6 6.3c.4.3.6.8.6 1.3V19a2 2 0 0 1-2 2h-3.5v-5.5a2.5 2.5 0 0 0-5 0V21H5a2 2 0 0 1-2-2v-7.9c0-.5.2-1 .6-1.3z"/></g>`,
    duotone: `${T}<path d="M4 11 12 4.5 20 11v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z"/></g><path d="M4 11 12 4.5 20 11v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19zM9.5 20.5V15h5v5.5"/>`
  },
  calendar: {
    rounded: '<rect x="3.5" y="5" width="17" height="15.5" rx="4.5"/><path d="M8 3v4M16 3v4M3.5 10.2h17"/>',
    filled: `${F}<path d="M8 2.8a1 1 0 0 1 1 1V5h6V3.8a1 1 0 1 1 2 0V5h.5A3.5 3.5 0 0 1 21 8.5V9H3v-.5A3.5 3.5 0 0 1 6.5 5H7V3.8a1 1 0 0 1 1-1zM3 11h18v7.5a3.5 3.5 0 0 1-3.5 3.5h-11A3.5 3.5 0 0 1 3 18.5z"/></g>`,
    duotone: `${T}<rect x="3.5" y="5.5" width="17" height="15" rx="3"/></g><rect x="3.5" y="5.5" width="17" height="15" rx="3"/><path d="M8 3.5v4M16 3.5v4M3.5 10.5h17"/>`
  },
  'trending-up': {
    rounded: '<path d="M3.5 17 9 11.5l3.5 3.5 7.3-8"/><path d="M15 7h5.2v5.2"/>',
    filled: `<path d="M3.5 17 9 11.5l3.5 3.5 5.8-6.4" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${F}<path d="M21 5.2v8.2a.6.6 0 0 1-1 .4l-2.6-2.4-2.4-2.4a.6.6 0 0 1 .4-1L20 7.4z"/></g>`,
    duotone: `${T}<path d="M3.5 17 9 11.5l3.5 3.5 7-7.6V20h-15.5z"/></g><path d="M3.5 17 9 11.5l3.5 3.5 7-7.6"/><path d="M15.5 7.4h4v4"/>`
  },
  layers: {
    rounded: '<path d="m12 3.6 8.4 4.4-8.4 4.4L3.6 8z"/><path d="m3.6 12.2 8.4 4.4 8.4-4.4M3.6 16.4 12 20.8l8.4-4.4"/>',
    filled: `${F}<path d="M12.5 2.7a1 1 0 0 0-1 0L2.6 7.4a.7.7 0 0 0 0 1.2l8.9 4.7a1 1 0 0 0 1 0l8.9-4.7a.7.7 0 0 0 0-1.2z"/></g><path d="m3 12.3 8.5 4.5a1 1 0 0 0 1 0L21 12.3M3 16.3l8.5 4.5a1 1 0 0 0 1 0l8.5-4.5" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>`,
    duotone: `${T}<path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8z"/></g><path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8z"/><path d="m3.5 12 8.5 4.5 8.5-4.5M3.5 16 12 20.5l8.5-4.5"/>`
  },
  book: {
    rounded: '<path d="M6.5 3.5h11A2.5 2.5 0 0 1 20 6v12.5a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 18V6a2.5 2.5 0 0 1 2.5-2.5z"/><path d="M4 17.6A2.6 2.6 0 0 1 6.5 15H20M9 8h6"/>',
    filled: `${F}<path d="M6.5 2.5h11A2.5 2.5 0 0 1 20 5v10H6.5A2.5 2.5 0 0 0 4 17.5V5a2.5 2.5 0 0 1 2.5-2.5zM4 18.6A2.5 2.5 0 0 1 6.5 16H20v3.4a2.1 2.1 0 0 1-2.1 2.1H6.5A2.5 2.5 0 0 1 4 19z"/></g>`,
    duotone: `${T}<path d="M6.5 3.5H19a1 1 0 0 1 1 1V16H6.5A2.5 2.5 0 0 0 4 18.5V6a2.5 2.5 0 0 1 2.5-2.5z"/></g><path d="M20 16H6.5A2.5 2.5 0 0 0 4 18.5 2.5 2.5 0 0 0 6.5 21H20z"/><path d="M4 18.5V6a2.5 2.5 0 0 1 2.5-2.5H19a1 1 0 0 1 1 1V16"/>`
  },
  chart: {
    rounded: '<path d="M5.5 20v-7M12 20V5M18.5 20v-9.5"/>',
    filled: `${F}<rect x="3.5" y="11" width="4.2" height="9.5" rx="1.4"/><rect x="9.9" y="3.5" width="4.2" height="17" rx="1.4"/><rect x="16.3" y="8" width="4.2" height="12.5" rx="1.4"/></g>`,
    duotone: `${T}<rect x="3.5" y="11" width="4.2" height="9.5" rx="1.4"/><rect x="9.9" y="3.5" width="4.2" height="17" rx="1.4"/><rect x="16.3" y="8" width="4.2" height="12.5" rx="1.4"/></g><rect x="3.5" y="11" width="4.2" height="9.5" rx="1.4"/><rect x="9.9" y="3.5" width="4.2" height="17" rx="1.4"/><rect x="16.3" y="8" width="4.2" height="12.5" rx="1.4"/>`
  },
  sliders: {
    rounded: '<path d="M4 7h9M18 7h2M4 17h3M12 17h8"/><circle cx="15.5" cy="7" r="2.5"/><circle cx="9.5" cy="17" r="2.5"/>',
    filled: `<path d="M4 7h8M19 7h1M4 17h2M13 17h7" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/>${F}<circle cx="15.5" cy="7" r="3.4"/><circle cx="9.5" cy="17" r="3.4"/></g>`,
    duotone: `${T}<circle cx="15.5" cy="7" r="3"/><circle cx="9.5" cy="17" r="3"/></g><path d="M4 7h8.5M18.5 7H20M4 17h2.5M12.5 17H20"/><circle cx="15.5" cy="7" r="3"/><circle cx="9.5" cy="17" r="3"/>`
  }
};

/** Navigation glyph in the chosen family. Unknown names fall back to the standard outline icon. */
export function navIcon(name, family = 'outline', size = 24) {
  const fam = NAV_ICON_FAMILIES.includes(family) ? family : 'outline';
  const set = SETS[name];
  if (fam === 'outline' || !set) return icon(name, { size });
  const stroke = fam === 'rounded' ? 2.3 : fam === 'duotone' ? 1.75 : 0;
  const attrs = fam === 'filled'
    ? 'fill="none"'
    : `fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"`;
  return `<svg class="i i-${fam}" width="${size}" height="${size}" viewBox="0 0 24 24" ${attrs} aria-hidden="true" focusable="false">${set[fam]}</svg>`;
}
