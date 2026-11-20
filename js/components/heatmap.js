/* Completion heatmaps. Habits: weekly and yearly (GitHub-style) views in the habit's own colour.
 * Challenges: a dotted history from the start date. Pure HTML builders; callers own state and actions. */
import { esc, todayStr, addDays, parseDate, rangeDates, dateStr, weekdayInitial, fmtDM, readableOn } from '../core/utils.js';
import { habitDayState, dayHabitScore } from '../core/stats.js';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const mondayOf = d => { const x = parseDate(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return dateStr(x); };

export { habitDayState };
const STATE_TEXT = { done: 'done', missed: 'missed', rest: 'rest day', off: 'not scheduled', pre: 'before tracking began', future: 'upcoming', open: 'not done yet' };
const label = (h, d, st) => `${h.name} on ${fmtDM(d)}: ${STATE_TEXT[st]}`;
const weekStart = (d, monday) => { const x = parseDate(d); x.setDate(x.getDate() - (monday ? (x.getDay() + 6) % 7 : x.getDay())); return dateStr(x); };

/** Calendar-year contribution graph for one habit, in the habit's own colour.
 *  Weeks are columns, weekdays are rows, with weekday labels and month markers. Scrolls horizontally on phones. */
export function habitYear(state, h, start, selected, year = new Date().getFullYear(), monday = true) {
  const today = todayStr(), jan1 = `${year}-01-01`, dec31 = `${year}-12-31`;
  const first = weekStart(jan1, monday), weeks = Math.ceil((parseDate(dec31) - parseDate(first)) / 86400000 / 7) + 1;
  const cols = []; for (let w = 0; w < weeks; w++) cols.push(rangeDates(addDays(first, w * 7), addDays(first, w * 7 + 6)));
  const monthAt = cols.map(c => c.find(d => d.startsWith(`${year}-`) && d.endsWith('-01')) || '');
  const wd = monday ? ['Mon', '', 'Wed', '', 'Fri', '', ''] : ['', 'Mon', '', 'Wed', '', 'Fri', ''];
  return `<div class="hm-wrap"><div class="hm-wd" aria-hidden="true">${wd.map(n => `<span>${n}</span>`).join('')}</div>
    <div class="hm-scroll" data-scrollend data-year="${year}"><div class="hm" style="--hc:${h.color};--hc-on:${readableOn(h.color)};--wk:${weeks}">
    <div class="hm-months" aria-hidden="true">${monthAt.map((m, i) => (m ? `<span style="grid-column:${i + 1} / span 4">${MON[parseDate(m).getMonth()]}</span>` : '')).join('')}</div>
    <div class="hm-grid" role="grid" aria-label="${esc(h.name)} completion, ${year}">${cols.map(c => `<div class="hm-col">${c.map(d => {
      if (!d.startsWith(`${year}-`)) return '<span class="hm-cell is-out" aria-hidden="true"></span>';
      const st = habitDayState(state, h, d, start);
      return `<button type="button" class="hm-cell is-${st} ${d === today ? 'is-today' : ''} ${d === selected ? 'is-sel' : ''}" data-action="hm-day" data-id="${esc(h.id)}" data-date="${d}" ${st === 'future' ? 'tabindex="-1"' : ''} aria-label="${esc(label(h, d, st))}"></button>`;
    }).join('')}</div>`).join('')}</div></div></div></div>`;
}

export function habitWeek(state, h, start, selected, offset = 0, monday = true) {
  const today = todayStr(), mon = addDays(weekStart(today, monday), offset * 7), days = rangeDates(mon, addDays(mon, 6));
  return `<div class="hw" style="--hc:${h.color};--hc-on:${readableOn(h.color)}">${days.map(d => { const st = habitDayState(state, h, d, start); return `<button type="button" class="hw-day is-${st} ${d === today ? 'is-today' : ''} ${d === selected ? 'is-sel' : ''}" data-action="hm-day" data-id="${esc(h.id)}" data-date="${d}" aria-label="${esc(label(h, d, st))}"><small>${weekdayInitial(d)}</small><span>${parseDate(d).getDate()}</span></button>`; }).join('')}</div>`;
}

export const heatLegend = () => `<div class="hm-legend" aria-hidden="true"><span><i class="lg-done"></i>Done</span><span><i class="lg-rest"></i>Rest</span><span><i class="lg-missed"></i>Missed</span><span><i class="lg-off"></i>Not scheduled</span><span><i class="lg-future"></i>Upcoming</span></div>`;

/** Combined consistency graph across all habits: shade = share of the habits due that day which were done (5 levels). */
export function habitOverview(state, weeks = 18, monday = true) {
  const today = todayStr(), first = addDays(weekStart(today, monday), -(weeks - 1) * 7);
  const cols = []; for (let w = 0; w < weeks; w++) cols.push(rangeDates(addDays(first, w * 7), addDays(first, w * 7 + 6)));
  return `<div class="hm-scroll hm-overview" data-scrollend><div class="hm ov" style="--wk:${weeks}"><div class="hm-grid" role="grid" aria-label="All habits, last ${weeks} weeks">${cols.map(c => `<div class="hm-col">${c.map(d => {
    if (d > today) return '<span class="hm-cell is-future" aria-hidden="true"></span>';
    const v = dayHabitScore(state, d), lvl = v === null ? 'n' : v === 0 ? 0 : v <= 0.34 ? 1 : v <= 0.67 ? 2 : v < 1 ? 3 : 4;
    return `<span class="hm-cell ov-${lvl} ${d === today ? 'is-today' : ''}" title="${esc(fmtDM(d))}${v === null ? '' : `: ${Math.round(v * 100)}% of habits`}" role="gridcell" aria-label="${esc(fmtDM(d))}${v === null ? ', no habits due' : `, ${Math.round(v * 100)} percent`}"></span>`;
  }).join('')}</div>`).join('')}</div></div></div>`;
}

/** Dotted history for a challenge: one dot per day from the start date to the end of the target. */
export function challengeDots(c, today = todayStr()) {
  const total = Math.min(Math.max(1, c.targetDays), 400), days = rangeDates(c.startDate, addDays(c.startDate, total - 1));
  return `<div class="cd" role="grid" aria-label="${esc(c.name)} history">${days.map((d, i) => { const l = c.logs?.[d]?.status, st = l === 'done' ? 'done' : l === 'slip' ? 'slip' : d > today ? 'future' : d === today ? 'open' : 'none'; return `<button type="button" class="cd-dot is-${st} ${d === today ? 'is-today' : ''}" data-action="ch-day" data-id="${esc(c.id)}" data-date="${d}" aria-label="Day ${i + 1}, ${fmtDM(d)}: ${st === 'done' ? 'done' : st === 'slip' ? 'missed' : st === 'future' ? 'upcoming' : 'not recorded'}"></button>`; }).join('')}</div>`;
}
