/* Workspace schema + migration.
 * normalizeState() accepts any earlier workspace (V1–V7) and returns a clean V7 object.
 * It never mutates its input, and nothing here touches localStorage: the V6 key is read elsewhere and never written. */
import { uid, isDateStr, todayStr, dateStr, clone } from '../core/utils.js';

export const SCHEMA_VERSION = 7;
export const CHALLENGE_DAYS = [7, 14, 21, 30, 60, 90];
export const ACCENTS = {
  blue: { name: 'Blue', hex: '#0A84FF' },
  green: { name: 'Green', hex: '#30B350' },
  red: { name: 'Red', hex: '#FF453A' },
  orange: { name: 'Orange', hex: '#FF9500' },
  yellow: { name: 'Yellow', hex: '#FFCC00' },
  violet: { name: 'Violet', hex: '#8B5CF6' },
  cyan: { name: 'Cyan', hex: '#32ADE6' }
};
/** Accent ids saved by earlier versions keep working: they map to the closest current accent. */
export const LEGACY_ACCENTS = { champagne: 'blue', titanium: 'blue', copper: 'orange', sage: 'green', ice: 'cyan', rose: 'red', emerald: 'green', amber: 'orange', indigo: 'blue', violet: 'violet', cyan: 'cyan', blue: 'blue' };
export const APP_STYLES = ['minimal', 'glass', 'cinematic', 'classic'];
export const NAV_STYLES = ['minimal', 'cinematic', 'glass', 'casual'];
export const NAV_ICON_STYLES = ['outline', 'rounded', 'filled', 'duotone'];
export const HABIT_COLORS = [
  { id: 'green', name: 'Green', hex: '#5cc28a' }, { id: 'blue', name: 'Blue', hex: '#5b9df0' }, { id: 'orange', name: 'Orange', hex: '#f0974a' },
  { id: 'teal', name: 'Teal', hex: '#3fc1b5' }, { id: 'gold', name: 'Gold', hex: '#e5c25b' }, { id: 'coral', name: 'Coral', hex: '#e36f6f' },
  { id: 'rose', name: 'Rose', hex: '#e58db0' }, { id: 'steel', name: 'Steel', hex: '#9fb2c8' }
];
export const XP_CATEGORIES = ['consistency', 'academics', 'fitness', 'finance', 'gaming', 'learning', 'personal'];

export const freshSettings = () => ({
  theme: 'dark', amoled: true, accent: 'blue', customAccent: '', style: 'minimal', navStyle: 'minimal', navIcons: 'outline', glass: 60,
  density: 'comfortable', textSize: 'default', motion: 'system',
  currency: 'INR', weekStartsMonday: true, dailyXpCap: 100, levelRewards: {}
});

export const freshState = () => ({
  version: SCHEMA_VERSION,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  settings: freshSettings(),
  nofap: { targetDays: 30, startedAt: '', challengeId: '', active: false, completedAt: '', personalReward: '', bestStreak: 0, logs: {}, dailyLogs: {}, history: [] },
  xp: 0,
  categoryXP: Object.fromEntries(XP_CATEGORIES.map(k => [k, 0])),
  rewardEvents: {}, dailyXP: {}, achievements: {}, lastLevelSeen: 1,
  tasks: [], habits: [], habitLogs: {}, habitXPLogs: {},
  subjects: [], academicItems: [], workoutLogs: [], workoutTemplates: [], bodyMetrics: [],
  transactions: [], budgets: [], savingsGoals: [], games: [], books: [],
  notes: [], goals: [], disciplineLogs: [], activityLog: [], trashBin: [], challenges: [], events: [],
  removedFeaturesArchive: {}, removedModulesArchive: {}, ui: {}
});

/** Every list that holds records with ids. */
export const LISTS = ['tasks', 'habits', 'subjects', 'academicItems', 'workoutLogs', 'workoutTemplates', 'bodyMetrics', 'transactions', 'budgets', 'savingsGoals', 'games', 'books', 'notes', 'goals', 'disciplineLogs', 'activityLog', 'trashBin', 'challenges', 'events'];
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const n0 = v => Math.max(0, Number(v) || 0);
const lines = v => (Array.isArray(v) ? v : String(v || '').split(/\r?\n/)).map(x => String(x).trim()).filter(Boolean);

function normBook(b) {
  const total = n0(b.totalPages ?? b.pages);
  let current = n0(b.currentPage ?? b.pagesRead);
  if (!current && total && Number(b.progress) > 0) current = Math.round(total * Math.min(100, Number(b.progress)) / 100);
  const raw = String(b.status || '');
  const status = /finish|complete|done|read$/i.test(raw) && !/to read|want/i.test(raw) ? 'Finished' : /reading|progress|current/i.test(raw) ? 'Reading' : /hold|pause/i.test(raw) ? 'Paused' : /drop|abandon/i.test(raw) ? 'Dropped' : (total && current >= total ? 'Finished' : current > 0 ? 'Reading' : 'To read');
  return { ...b, title: String(b.title || b.name || 'Untitled book'), author: String(b.author || ''), status, totalPages: total, currentPage: total ? Math.min(current, total) : current, rating: Math.min(5, n0(b.rating)), notes: String(b.notes || b.review || ''), createdAt: b.createdAt || new Date().toISOString() };
}

function normGame(g) {
  const progress = Math.min(100, n0(g.progress));
  const status = ['Backlog', 'Playing', 'On hold', 'Completed', 'Dropped'].includes(g.status) ? g.status : 'Backlog';
  return {
    ...g, status, title: String(g.title || 'Untitled game'), platform: String(g.platform || 'PC'),
    hours: n0(g.hours), rating: g.rating === '' || g.rating == null ? '' : Math.min(10, Math.max(1, Number(g.rating) || 0)) || '',
    estimatedHours: n0(g.estimatedHours) || '',
    progress: status === 'Completed' ? 100 : n0(g.estimatedHours) > 0 ? Math.min(100, (n0(g.hours) / n0(g.estimatedHours)) * 100) : progress, cover: typeof g.cover === 'string' ? g.cover : '',
    history: Array.isArray(g.history) ? g.history.filter(h => h && h.status).slice(-50) : []
  };
}

export function normalizeState(input) {
  const base = freshState();
  if (!isObj(input)) return base;
  const src = clone(input);
  const sourceVersion = Number(src.version) || 1;
  const out = { ...base, ...src, version: SCHEMA_VERSION };

  /* settings: map V6 palette ids, keep unknown-safe defaults */
  const s = { ...freshSettings(), ...(isObj(src.settings) ? src.settings : {}) };
  delete s.name; delete s.dashboardWidgets;
  const inS = isObj(src.settings) ? src.settings : {};
  s.accent = ACCENTS[inS.accent] ? inS.accent : (LEGACY_ACCENTS[inS.accent] || LEGACY_ACCENTS[inS.palette] || 'blue');   // V6 stored a palette id; V7+ stores an accent id
  s.style = APP_STYLES.includes(inS.style) ? inS.style : 'minimal';
  s.navStyle = NAV_STYLES.includes(inS.navStyle) ? inS.navStyle : 'minimal';
  s.navIcons = NAV_ICON_STYLES.includes(inS.navIcons) ? inS.navIcons : 'outline';
  delete s.palette;
  if (!s.customAccent && src.settings?.accent && /^#[0-9a-f]{6}$/i.test(src.settings.accent)) s.customAccent = src.settings.accent;
  if (!/^#[0-9a-f]{6}$/i.test(s.customAccent || '')) s.customAccent = '';
  s.theme = ['dark', 'light', 'system'].includes(s.theme) ? s.theme : 'dark';
  s.amoled = s.amoled !== false;
  s.glass = Math.min(100, Math.max(0, Number(s.glass) || 0));
  s.density = ['compact', 'comfortable'].includes(s.density) ? s.density : 'comfortable';
  s.textSize = ['small', 'default', 'large'].includes(s.textSize) ? s.textSize : 'default';
  s.motion = ['system', 'reduce', 'full'].includes(s.motion) ? s.motion : 'system';
  s.dailyXpCap = [50, 75, 100, 125, 150, 200].includes(Number(s.dailyXpCap)) ? Number(s.dailyXpCap) : 100;
  s.currency = typeof s.currency === 'string' && s.currency.length === 3 ? s.currency : 'INR';
  s.levelRewards = isObj(s.levelRewards) ? s.levelRewards : {};
  out.settings = s;

  /* discipline tracker (daily log is permanent; challenge is a separate lifecycle) */
  const nf = { ...base.nofap, ...(isObj(src.nofap) ? src.nofap : {}) };
  if (!isObj(nf.logs)) nf.logs = {};
  if (!isObj(nf.dailyLogs)) nf.dailyLogs = { ...nf.logs };
  Object.entries(nf.logs).forEach(([d, e]) => { if (!nf.dailyLogs[d] && isObj(e)) nf.dailyLogs[d] = { ...e }; });
  Object.keys(nf.dailyLogs).forEach(d => { if (!isDateStr(d) || !isObj(nf.dailyLogs[d])) delete nf.dailyLogs[d]; });
  nf.history = Array.isArray(nf.history) ? nf.history.filter(isObj) : [];
  if (sourceVersion < 4) {
    /* V3 advanced challenge days from the calendar: backfill legacy ranges so old streaks stay truthful */
    const ranges = nf.history.filter(h => isDateStr(h.startedAt) && isDateStr(h.endedAt)).map(h => ({ a: h.startedAt, b: h.endedAt, c: h.challengeId || '' }));
    if (isDateStr(nf.startedAt)) { const end = nf.active ? todayStr() : (isDateStr(nf.completedAt) ? nf.completedAt : ''); if (end) ranges.push({ a: nf.startedAt, b: end, c: nf.challengeId || '' }); }
    ranges.forEach(r => {
      const a = new Date(`${r.a}T00:00:00`), b = new Date(`${r.b}T00:00:00`);
      if (b < a) return;
      for (let i = 0, c = new Date(a); c <= b && i < 4000; i++, c.setDate(c.getDate() + 1)) {
        const k = dateStr(c); if (!nf.dailyLogs[k]) nf.dailyLogs[k] = { status: 'on-track', challengeId: r.c, migratedFromV3: true };
      }
    });
  }
  nf.logs = { ...nf.dailyLogs };
  nf.bestStreak = n0(nf.bestStreak);
  nf.targetDays = CHALLENGE_DAYS.includes(Number(nf.targetDays)) ? Number(nf.targetDays) : 30;
  nf.active = Boolean(nf.active);
  nf.completedAt = typeof nf.completedAt === 'string' ? nf.completedAt : '';
  nf.personalReward = String(nf.personalReward || '');
  out.nofap = nf;

  /* archives of removed features are preserved untouched */
  out.removedFeaturesArchive = isObj(src.removedFeaturesArchive) ? src.removedFeaturesArchive : {};
  out.removedModulesArchive = isObj(src.removedModulesArchive) ? src.removedModulesArchive : {};
  if (Array.isArray(src.focusSessions) && src.focusSessions.length && !out.removedFeaturesArchive.focusSessions) out.removedFeaturesArchive.focusSessions = src.focusSessions.slice(-100);
  delete out.focusSessions; delete out.migratedFrom; delete out._storageWarning; delete out._recoverySnapshotPreserved;

  /* books: V6 archived them; V7 restores the Learning module from that archive (the archive copy stays) */
  const archivedBooks = Array.isArray(out.removedModulesArchive.learningBooks) ? out.removedModulesArchive.learningBooks : [];
  const incomingBooks = Array.isArray(src.books) ? src.books : (sourceVersion < 7 ? archivedBooks : []);
  out.books = incomingBooks.filter(isObj).map(normBook);

  /* record lists: objects only, unique ids */
  const seen = new Set();
  LISTS.forEach(key => {
    const list = Array.isArray(out[key]) ? out[key] : [];
    out[key] = key === 'books' ? out.books : list.filter(isObj);
    out[key].forEach(item => { if (!item.id || seen.has(item.id)) item.id = uid(key.slice(0, 4)); seen.add(item.id); });
  });
  ['habitLogs', 'habitXPLogs', 'rewardEvents', 'dailyXP', 'achievements', 'ui'].forEach(k => { if (!isObj(out[k])) out[k] = {}; });

  /* XP */
  out.xp = n0(out.xp);
  const cats = isObj(out.categoryXP) ? out.categoryXP : {};
  out.categoryXP = Object.fromEntries(XP_CATEGORIES.map(k => [k, n0(cats[k])]));
  out.lastLevelSeen = Math.max(1, Number(out.lastLevelSeen) || 1);
  out.activityLog = out.activityLog.slice(0, 120);
  out.trashBin = out.trashBin.filter(t => t.record && t.list && t.deletedAt && new Date(t.deletedAt).getTime() > Date.now() - 30 * 86400000).slice(-100);

  /* typed fixes for known lists */
  out.subjects = out.subjects.map(x => ({ ...x, name: String(x.name || 'Subject'), totalAssignments: n0(x.totalAssignments), totalPracticals: n0(x.totalPracticals), classesHeld: n0(x.classesHeld), classesAttended: Math.min(n0(x.classesHeld), n0(x.classesAttended)) }));
  out.academicItems = out.academicItems.map(x => ({ ...x, assignmentNo: n0(x.assignmentNo), practicalNo: n0(x.practicalNo), progress: x.progress === undefined ? (x.status === 'Completed' ? 100 : x.status === 'In Progress' ? 50 : 0) : Math.min(100, n0(x.progress)) }));
  out.transactions = out.transactions.map(x => ({ ...x, type: x.type === 'income' ? 'income' : 'expense', amount: n0(x.amount) }));
  out.workoutTemplates = out.workoutTemplates.map(x => ({ ...x, exercises: lines(x.exercises).slice(0, 30) }));
  out.bodyMetrics = out.bodyMetrics.map(x => ({ ...x, weight: n0(x.weight), waist: n0(x.waist), chest: n0(x.chest), arms: n0(x.arms) }));
  out.goals = out.goals.map(x => { const ms = lines(x.milestones).slice(0, 20); const done = Array.isArray(x.milestoneDone) ? x.milestoneDone : []; return { ...x, milestones: ms, milestoneDone: ms.map((_, i) => Boolean(done[i])) }; });
  out.notes = out.notes.map(x => ({ ...x, tags: (Array.isArray(x.tags) ? x.tags : String(x.tags || '').split(',')).map(t => String(t).trim()).filter(Boolean).slice(0, 12) }));
  out.games = out.games.map(normGame);
  out.savingsGoals = out.savingsGoals.map(x => ({ ...x, name: String(x.name || 'Savings goal'), targetAmount: n0(x.targetAmount), savedAmount: n0(x.savedAmount) }));
  /* habit colours: legacy habits get a stable colour by position; nothing else about them changes */
  out.habits.forEach((h, i) => {
    if (!/^#[0-9a-f]{6}$/i.test(h.color || '')) h.color = HABIT_COLORS[i % HABIT_COLORS.length].hex;
    if (!h.createdAt) delete h.createdAt;
    /* V9 additive fields: custom weekdays, weekly target, rest days. Older habits simply do not have them. */
    if (h.days !== undefined) h.days = Array.isArray(h.days) ? [...new Set(h.days.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6))].sort() : [];
    if (h.perWeek !== undefined) h.perWeek = Math.min(6, Math.max(1, Math.round(Number(h.perWeek)) || 3));
    if (h.skips !== undefined) { const k = {}; if (isObj(h.skips)) Object.keys(h.skips).forEach(d => { if (isDateStr(d) && h.skips[d]) k[d] = true; }); h.skips = k; }
  });

  /* calendar events */
  const T = /^([01]\d|2[0-3]):[0-5]\d$/;
  out.events = out.events.filter(e => isDateStr(e.date) && T.test(e.startTime || '')).map(e => ({ ...e, title: String(e.title || 'Event'), endTime: T.test(e.endTime || '') && e.endTime > e.startTime ? e.endTime : '', notes: String(e.notes || '') }));

  /* challenges: the V6/V7 single tracker becomes the first challenge once; the original tracker data stays untouched */
  const rawChallenges = src.challenges;
  if (!Array.isArray(rawChallenges)) {
    const logs = {};
    Object.entries(out.nofap.dailyLogs || {}).forEach(([d, e]) => { if (e && (e.status === 'on-track' || e.status === 'slip')) logs[d] = { status: e.status === 'slip' ? 'slip' : 'done', note: String(e.note || '') }; });
    const days = Object.keys(logs).sort();
    const hasLegacy = days.length || out.nofap.startedAt || (out.nofap.history || []).length;
    out.challenges = hasLegacy ? [{ id: 'ch_legacy_nofap', name: 'No Fap', startDate: isDateStr(out.nofap.startedAt) && (!days.length || out.nofap.startedAt <= days[0]) ? out.nofap.startedAt : (days[0] || todayStr()), targetDays: Number(out.nofap.targetDays) || 30, reward: String(out.nofap.personalReward || ''), logs, status: out.nofap.completedAt && !out.nofap.active ? 'completed' : 'active', completedAt: out.nofap.completedAt || '', legacy: 'nofap', createdAt: out.createdAt || new Date().toISOString() }] : [];
  }
  out.challenges = out.challenges.filter(c => c && typeof c === 'object').map(c => {
    const logs = {};
    Object.entries(isObj(c.logs) ? c.logs : {}).forEach(([d, e]) => { if (isDateStr(d) && e && (e.status === 'done' || e.status === 'slip')) logs[d] = { status: e.status, note: String(e.note || '') }; });
    return { ...c, name: String(c.name || 'Challenge'), startDate: isDateStr(c.startDate) ? c.startDate : todayStr(), targetDays: Math.max(1, Math.round(Number(c.targetDays)) || 30), reward: String(c.reward || ''), logs, status: ['active', 'completed'].includes(c.status) ? c.status : 'active' };
  });
  out.tasks.forEach(t => { if (!t.title) t.title = 'Untitled task'; t.dueTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(t.dueTime || '') && t.due ? t.dueTime : ''; });
  out.academicItems.forEach(x => { x.dueTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(x.dueTime || '') && x.due ? x.dueTime : ''; });
  out.habits.forEach(h => { if (!h.name) h.name = 'Habit'; });
  return out;
}

/** Cheap structural summary used by the backup preview and the About screen. */
export function summarize(state) {
  const count = k => (Array.isArray(state?.[k]) ? state[k].length : 0);
  return {
    Tasks: count('tasks'), Habits: count('habits'), Subjects: count('subjects'), 'Academic items': count('academicItems'),
    Workouts: count('workoutLogs'), Transactions: count('transactions'), Games: count('games'), Books: count('books'),
    Notes: count('notes'), Goals: count('goals'), 'Discipline days': Object.keys(state?.nofap?.dailyLogs || {}).length
  };
}
