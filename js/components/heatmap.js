/* Completion heatmaps. Habits: weekly and yearly (GitHub-style) views in the habit's own colour.
 * Challenges: a dotted history from the start date. Pure HTML builders; callers own state and actions. */
import { esc, todayStr, addDays, parseDate, rangeDates, dateStr, weekdayInitial, fmtDM, readableOn } from '../core/utils.js';
import { isScheduled, habitDone } from '../core/stats.js';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const mondayOf = d => { const x = parseDate(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return dateStr(x); };

/** state of one day for one habit: done | missed | off | pre | future */
export function habitDayState(state, h, d, start) {
  const today = todayStr();
  if (d > today) return 'future';
  if (habitDone(state, h.id, d)) return 'done';
  if (d < start) return 'pre';
  if (!isScheduled(h, d)) return 'off';
  return d === today ? 'open' : 'missed';
}
const label = (h, d, st) => `${h.name} on ${fmtDM(d)}: ${{ done: 'done', missed: 'missed', off: 'not scheduled', pre: 'before tracking began', future: 'upcoming', open: 'not done yet' }[st]}`;

export function habitYear(state, h, start, selected) {
  const today = todayStr(), first = addDays(mondayOf(today), -52 * 7);
  const cols = [];
  for (let w = 0; w < 53; w++) cols.push(rangeDates(addDays(first, w * 7), addDays(first, w * 7 + 6)));
  const months = cols.map((c, i) => { const m = parseDate(c[0]).getMonth(); return i === 0 || m !== parseDate(cols[i - 1][0]).getMonth() ? MON[m] : ''; });
  return `<div class="hm-scroll" data-scrollend><div class="hm" style="--hc:${h.color};--hc-on:${readableOn(h.color)}">
    <div class="hm-months" aria-hidden="true">${months.map(m => `<span>${m}</span>`).join('')}</div>
    <div class="hm-grid" role="grid" aria-label="${esc(h.name)} completion, last 12 months">${cols.map(c => `<div class="hm-col">${c.map(d => { const st = habitDayState(state, h, d, start); return `<button type="button" class="hm-cell is-${st} ${d === today ? 'is-today' : ''} ${d === selected ? 'is-sel' : ''}" data-action="hm-day" data-id="${esc(h.id)}" data-date="${d}" ${st === 'future' ? 'tabindex="-1"' : ''} aria-label="${esc(label(h, d, st))}"></button>`; }).join('')}</div>`).join('')}</div></div></div>`;
}

export function habitWeek(state, h, start, selected, offset = 0) {
  const today = todayStr(), mon = addDays(mondayOf(today), offset * 7), days = rangeDates(mon, addDays(mon, 6));
  return `<div class="hw" style="--hc:${h.color};--hc-on:${readableOn(h.color)}">${days.map(d => { const st = habitDayState(state, h, d, start); return `<button type="button" class="hw-day is-${st} ${d === today ? 'is-today' : ''} ${d === selected ? 'is-sel' : ''}" data-action="hm-day" data-id="${esc(h.id)}" data-date="${d}" aria-label="${esc(label(h, d, st))}"><small>${weekdayInitial(d)}</small><span>${parseDate(d).getDate()}</span></button>`; }).join('')}</div>`;
}

export const heatLegend = () => `<div class="hm-legend" aria-hidden="true"><span><i class="lg-done"></i>Done</span><span><i class="lg-missed"></i>Missed</span><span><i class="lg-future"></i>Upcoming</span></div>`;

/** Dotted history for a challenge: one dot per day from the start date to the end of the target. */
export function challengeDots(c, today = todayStr()) {
  const total = Math.min(Math.max(1, c.targetDays), 400), days = rangeDates(c.startDate, addDays(c.startDate, total - 1));
  return `<div class="cd" role="grid" aria-label="${esc(c.name)} history">${days.map((d, i) => { const l = c.logs?.[d]?.status, st = l === 'done' ? 'done' : l === 'slip' ? 'slip' : d > today ? 'future' : d === today ? 'open' : 'none'; return `<button type="button" class="cd-dot is-${st} ${d === today ? 'is-today' : ''}" data-action="ch-day" data-id="${esc(c.id)}" data-date="${d}" aria-label="Day ${i + 1}, ${fmtDM(d)}: ${st === 'done' ? 'done' : st === 'slip' ? 'missed' : st === 'future' ? 'upcoming' : 'not recorded'}"></button>`; }).join('')}</div>`;
}
