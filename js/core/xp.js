/* Experience system.
 * Rules that keep it honest:
 *  - Every award has an event key. A key can only pay out once, ever (re-toggling, editing or re-saving never pays again).
 *  - A daily cap limits total XP per day, so adding and deleting records cannot farm levels.
 *  - Levels and achievements are computed from stored XP and real records only. */
import * as State from './state.js';
import { emit } from './events.js';
import { todayStr, uid } from './utils.js';
import { habitStreak, budgetSpent, bestStreak } from './stats.js';
import { monthKey } from './utils.js';

export const RANKS = ['Beginner', 'Explorer', 'Builder', 'Achiever', 'Specialist', 'Expert', 'Master', 'Elite', 'Legend'];
export const CATEGORY_NAMES = { consistency: 'Consistency', academics: 'Academics', fitness: 'Fitness', finance: 'Finance', gaming: 'Gaming', learning: 'Learning', personal: 'Personal growth' };
export const XP_RULES = [
  ['+10', 'Complete a task (once per task)'], ['+8', 'Check in a habit (once per habit per day)'], ['+20', 'Log a workout entry'],
  ['+20', 'Complete an academic item'], ['+30', 'Complete a goal or finish a game'], ['+25', 'Finish a book'],
  ['+5', 'Record a transaction (first one each day)'], ['+5', 'Record a discipline day']
];
export const LEVEL_MILESTONES = [2, 3, 5, 8, 10, 15, 20];

export function levelInfo(totalXP) {
  const xp = Math.max(0, Number(totalXP) || 0);
  let level = 1, floor = 0, next = 100;
  while (xp >= next) { level += 1; floor = next; next += level * 100; }
  const within = xp - floor, required = next - floor;
  return { level, rank: RANKS[Math.min(RANKS.length - 1, Math.floor((level - 1) / 3))], xp, within, required, remaining: next - xp, percent: Math.min(100, (within / required) * 100), nextTotal: next, floor };
}
export const levelStartXP = level => { let floor = 0, next = 100, l = 1; while (l < level) { l += 1; floor = next; next += l * 100; } return level <= 1 ? 0 : floor; };

/** Mutates `state` — call inside State.update(). Returns {awarded, points, capped}. */
export function award(state, eventKey, points, category = 'personal', label = 'Activity') {
  const key = String(eventKey || '');
  if (!key || state.rewardEvents[key]) return { awarded: false, points: 0 };
  const date = todayStr();
  const cap = Math.max(0, Number(state.settings.dailyXpCap) || 100);
  const used = Math.max(0, Number(state.dailyXP[date]) || 0);
  const allowed = Math.max(0, Math.min(Number(points) || 0, cap - used));
  state.rewardEvents[key] = { date, points: allowed, category, label };
  if (allowed > 0) {
    state.xp += allowed;
    state.dailyXP[date] = used + allowed;
    state.categoryXP[category] = (Number(state.categoryXP[category]) || 0) + allowed;
    state.activityLog.unshift({ id: uid('act'), date: new Date().toISOString(), label, category, points: allowed });
    state.activityLog = state.activityLog.slice(0, 120);
  }
  return { awarded: allowed > 0, points: allowed, capped: allowed < (Number(points) || 0) };
}

/* ---------------- achievements ---------------- */
const finishedBooks = s => s.books.filter(b => b.status === 'Finished').length;
export const ACHIEVEMENTS = [
  { id: 'first-step', name: 'First step', desc: 'Record your first rewarded activity', icon: 'sparkles', test: s => Object.keys(s.rewardEvents).length >= 1 },
  { id: 'tasks-10', name: 'Task finisher', desc: 'Complete 10 tasks', icon: 'check-square', test: s => s.tasks.filter(t => t.done).length >= 10 },
  { id: 'habit-7', name: 'A full week', desc: 'Hold a 7-day habit streak', icon: 'flame', test: s => s.habits.some(h => habitStreak(s, h) >= 7) },
  { id: 'xp-500', name: 'Building rhythm', desc: 'Reach 500 total XP', icon: 'trending-up', test: s => s.xp >= 500 },
  { id: 'level-3', name: 'Getting consistent', desc: 'Reach level 3', icon: 'repeat', test: s => levelInfo(s.xp).level >= 3 },
  { id: 'level-5', name: 'Established', desc: 'Reach level 5', icon: 'award', test: s => levelInfo(s.xp).level >= 5 },
  { id: 'study', name: 'Study progress', desc: 'Complete an academic item', icon: 'graduation', test: s => s.academicItems.some(x => x.status === 'Completed') },
  { id: 'training-5', name: 'Training log', desc: 'Record five workout entries', icon: 'dumbbell', test: s => s.workoutLogs.length >= 5 },
  { id: 'game', name: 'Game finisher', desc: 'Complete a game', icon: 'gamepad', test: s => s.games.some(g => g.status === 'Completed') },
  { id: 'book', name: 'Bookworm', desc: 'Finish a book', icon: 'book', test: s => finishedBooks(s) >= 1 },
  { id: 'budget', name: 'Within budget', desc: 'Finish a month at or under a set budget', icon: 'wallet', test: s => { const cur = monthKey(todayStr()); return s.budgets.some(b => b.month < cur && b.monthlyLimit > 0 && budgetSpent(s, b) <= b.monthlyLimit && s.transactions.some(t => monthKey(t.date) === b.month)); } },
  { id: 'saver', name: 'Goal reached', desc: 'Reach a savings goal', icon: 'piggy', test: s => s.savingsGoals.some(g => g.targetAmount > 0 && g.savedAmount >= g.targetAmount) },
  { id: 'challenge', name: 'Challenge complete', desc: 'Complete a discipline challenge', icon: 'shield', test: s => (s.nofap.history || []).some(h => h.outcome === 'completed') },
  { id: 'streak-14', name: 'Fortnight', desc: 'Reach a 14-day discipline streak', icon: 'target', test: s => bestStreak(s.nofap) >= 14 }
];
export const unlockedMap = s => Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, Boolean(s.achievements[a.id]) || safe(a, s)]));
function safe(a, s) { try { return a.test(s); } catch { return false; } }

/** Detect level-ups and new achievements after any change. quiet=true records them without celebrating (used on load). */
export function checkProgress({ quiet = false } = {}) {
  const s = State.get();
  const lvl = levelInfo(s.xp).level;
  const fresh = ACHIEVEMENTS.filter(a => !s.achievements[a.id] && safe(a, s));
  const levelUp = lvl > s.lastLevelSeen;
  if (!fresh.length && !levelUp && lvl === s.lastLevelSeen) return;
  State.update(st => {
    fresh.forEach(a => { st.achievements[a.id] = new Date().toISOString(); });
    st.lastLevelSeen = lvl;
  }, { silent: true });
  if (quiet) return;
  if (levelUp) emit('celebrate', { kind: 'level', level: lvl, rank: levelInfo(s.xp).rank, reward: s.settings.levelRewards?.[lvl] || '' });
  fresh.forEach((a, i) => setTimeout(() => emit('celebrate', { kind: 'achievement', achievement: a }), (levelUp ? 1 : 0) * 400 + i * 300));
}
