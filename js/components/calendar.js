/* Month grid used by Calendar and Fitness. Pure HTML; the caller owns state and handles the data-action buttons. */
import { esc, parseDate, daysInMonth, fmtMonth, todayStr } from '../core/utils.js';
import { icon } from '../core/icons.js';

/**
 * @param {{month:string, selected?:string, dots?:Record<string,number>, marks?:Record<string,string>, prefix:string, mondayFirst?:boolean}} o
 * Emits buttons: data-action="{prefix}-day" data-date, and "{prefix}-month" data-dir (-1|1).
 */
export function monthGrid({ month, selected = '', dots = {}, marks = {}, prefix, mondayFirst = true }) {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1).getDay();                  // 0 = Sunday
  const lead = mondayFirst ? (first + 6) % 7 : first;
  const names = mondayFirst ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const today = todayStr();
  const cells = [...Array.from({ length: lead }, () => '<span class="cal-day is-out" aria-hidden="true"></span>')];
  for (let d = 1; d <= daysInMonth(month); d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`, n = dots[date] || 0;
    cells.push(`<button type="button" class="cal-day ${marks[date] ? `mark-${marks[date]}` : ''} ${date === today ? 'is-today' : ''} ${date === selected ? 'is-sel' : ''}" data-action="${prefix}-day" data-date="${date}" aria-label="${esc(parseDate(date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }))}${n ? `, ${n} ${n === 1 ? 'item' : 'items'}` : ''}" aria-pressed="${date === selected}">${d}${n ? `<span class="cal-dots">${'<i></i>'.repeat(Math.min(3, n))}</span>` : ''}</button>`);
  }
  return `<div class="cal-head"><button class="icon-btn is-solid" type="button" data-action="${prefix}-month" data-dir="-1" aria-label="Previous month">${icon('chevron-left', { size: 20 })}</button><h3>${esc(fmtMonth(month))}</h3><button class="icon-btn is-solid" type="button" data-action="${prefix}-month" data-dir="1" aria-label="Next month">${icon('chevron-right', { size: 20 })}</button></div>
    <div class="cal-week" aria-hidden="true">${names.map(n => `<span>${n}</span>`).join('')}</div><div class="cal-grid">${cells.join('')}</div>`;
}
