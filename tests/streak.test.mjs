/* Habit streak rules. Run with:  node tests/streak.test.mjs   (no dependencies) */
import * as S from '../js/core/stats.js';
const ds = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const day = n => { const d = new Date(); d.setHours(12); d.setDate(d.getDate() - n); return ds(d); };
const mk = (h, days) => { const logs = {}; days.forEach(n => { (logs[day(n)] ||= {})[h.id] = true; }); return { habits: [h], habitLogs: logs, settings: { weekStartsMonday: true } }; };
let fails = 0;
const eq = (a, b, m) => { if (a !== b) { fails++; console.log('FAIL', m, '->', a, '!=', b); } else console.log('ok  ', m); };

const daily = { id: 'a', schedule: 'Daily', createdAt: `${day(10)}T00:00:00Z` };
eq(S.habitStreak(mk(daily, [1, 2]), daily), 2, 'today not yet done does not break the streak');
eq(S.habitStreak(mk(daily, [0, 1, 2]), daily), 3, 'done today extends the streak');
eq(S.habitStreak(mk(daily, [0, 2, 3]), daily), 1, 'a scheduled, missed past day breaks it');
const rested = { ...daily, skips: { [day(1)]: true } };
eq(S.habitStreak(mk(rested, [0, 2, 3]), rested), 3, 'a rest day does not break the streak');
const custom = { id: 'c', schedule: 'Custom', days: [0, 1, 2, 3, 4, 5, 6].filter(d => d !== new Date(`${day(1)}T12:00:00`).getDay()), createdAt: `${day(10)}T00:00:00Z` };
eq(S.habitStreak(mk(custom, [0, 2, 3]), custom), 3, 'an unscheduled weekday does not break the streak');
eq(S.habitDayState(mk(daily, []), daily, day(-3), day(10)), 'future', 'future days are never missed');
eq(S.habitDayState(mk(daily, []), daily, day(3), day(10)), 'missed', 'scheduled past day without a check-in is missed');
eq(S.habitDayState(mk(rested, []), rested, day(1), day(10)), 'rest', 'rest days are distinct from missed days');
const weekly = { id: 'w', schedule: '3 days / week', perWeek: 3, createdAt: `${day(30)}T00:00:00Z` };
eq(S.habitStreakInfo(mk(weekly, []), weekly).unit, 'week', 'flexible habits count weeks');
eq(S.habitStreakInfo(mk(weekly, []), weekly).value, 0, 'no check-ins: no weekly streak');
eq(S.habitStats(mk(daily, [0, 1, 2]), daily).totalDone, 3, 'total completed days');
process.exit(fails ? 1 : 0);
