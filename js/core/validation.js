/* Validation + normalization for every record type.
 * prepare(type, raw, {state, existing}) -> { record, errors }. errors is keyed by field name; empty means valid. */
import { OPTIONS } from './schemas.js';
import { isDateStr, num, clamp, monthKey } from './utils.js';

const str = (v, max = 4000) => String(v ?? '').trim().slice(0, max);
const int = v => Math.round(num(v));
const lines = v => (Array.isArray(v) ? v : String(v || '').split(/\r?\n/)).map(x => String(x).trim()).filter(Boolean);
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);
const dateOrEmpty = v => (isDateStr(v) ? v : '');

function requireDate(raw, field, errors, label = 'a valid date') { if (!isDateStr(raw[field])) errors[field] = `Choose ${label}.`; }

const rules = {
  task(raw) {
    const e = {}, r = { title: str(raw.title, 150), due: dateOrEmpty(raw.due), priority: oneOf(raw.priority, OPTIONS.priority, 'Medium'), category: oneOf(raw.category, OPTIONS.taskCategory, 'Other'), repeat: oneOf(raw.repeat, OPTIONS.repeat, 'None'), notes: str(raw.notes, 1000) };
    if (!r.title) e.title = 'Give the task a name.';
    return { r, e };
  },
  habit(raw) {
    const e = {}, r = { name: str(raw.name, 80), icon: str(raw.icon, 4) || '✦', target: Math.max(1, num(raw.target, 1)), unit: oneOf(raw.unit, OPTIONS.habitUnit, 'times'), schedule: oneOf(raw.schedule, OPTIONS.habitSchedule, 'Daily') };
    if (!r.name) e.name = 'Give the habit a name.';
    return { r, e };
  },
  subject(raw, { state, existing }) {
    const e = {}, r = { name: str(raw.name, 80), code: str(raw.code, 12), totalAssignments: int(raw.totalAssignments), totalPracticals: Math.max(0, int(raw.totalPracticals)), classesHeld: Math.max(0, int(raw.classesHeld)), classesAttended: Math.max(0, int(raw.classesAttended)) };
    if (!r.name) e.name = 'Enter the subject name.';
    else if (state.subjects.some(s => s.id !== existing?.id && s.name.toLowerCase() === r.name.toLowerCase())) e.name = 'A subject with this name already exists.';
    if (r.totalAssignments < 1) e.totalAssignments = 'Enter at least 1 assignment.';
    if (r.classesAttended > r.classesHeld) e.classesAttended = 'Cannot exceed classes held.';
    const subjectName = existing?.name || r.name;
    const high = key => Math.max(0, ...state.academicItems.filter(x => x.subject === subjectName && x.type === key.type).map(x => num(x[key.field])));
    const hiA = high({ type: 'Assignment', field: 'assignmentNo' }), hiP = high({ type: 'Practical', field: 'practicalNo' });
    if (!e.totalAssignments && r.totalAssignments < hiA) e.totalAssignments = `Assignment ${hiA} already exists, so this cannot be lower.`;
    if (r.totalPracticals < hiP) e.totalPracticals = `Practical ${hiP} already exists, so this cannot be lower.`;
    return { r, e };
  },
  academic(raw, { state, existing }) {
    const e = {};
    const type = oneOf(raw.type, OPTIONS.academicType, 'Assignment');
    const r = { type, subject: str(raw.subject, 80) || 'General', title: str(raw.title, 150), due: dateOrEmpty(raw.due), status: oneOf(raw.status, OPTIONS.academicStatus, 'Pending'), progress: clamp(raw.progress), details: str(raw.details, 1000), assignmentNo: 0, practicalNo: 0 };
    if (r.status === 'Completed' || r.progress >= 100) { r.status = 'Completed'; r.progress = 100; }
    else if (r.status === 'Pending' && r.progress > 0) r.status = 'In Progress';
    else if (r.status === 'In Progress' && r.progress === 0) r.progress = 5;
    if (type === 'Assignment' || type === 'Practical') {
      const field = type === 'Practical' ? 'practicalNo' : 'assignmentNo';
      const no = int(raw[field]);
      r[field] = no;
      const subject = state.subjects.find(s => s.name === r.subject);
      const total = num(type === 'Practical' ? subject?.totalPracticals : subject?.totalAssignments);
      if (no < 1) e[field] = 'Start numbering from 1.';
      else if (subject && total > 0 && no > total) e[field] = `${type} numbers go up to ${total} for ${r.subject}.`;
      else if (state.academicItems.some(x => x.id !== existing?.id && x.type === type && x.subject === r.subject && num(x[field]) === no)) e[field] = `${type} ${no} already exists for ${r.subject}.`;
      if (!r.title && !e[field]) r.title = `${r.subject === 'General' ? '' : `${r.subject} `}${type} ${no}`.trim();
    }
    if (!r.title) e.title = 'Give this item a title.';
    return { r, e };
  },
  workout(raw) {
    const e = {}, r = { date: raw.date, exercise: str(raw.exercise, 80), sets: int(raw.sets), reps: int(raw.reps), weight: Math.max(0, num(raw.weight)), duration: Math.max(0, num(raw.duration)), notes: str(raw.notes, 600) };
    requireDate(raw, 'date', e);
    if (!r.exercise) e.exercise = 'Name the exercise.';
    if (r.sets < 1) e.sets = 'At least 1.';
    if (r.reps < 1) e.reps = 'At least 1.';
    return { r, e };
  },
  workoutTemplate(raw) {
    const e = {}, r = { name: str(raw.name, 80), focus: oneOf(raw.focus, OPTIONS.focus, 'Custom'), exercises: lines(raw.exercises).slice(0, 30), notes: str(raw.notes, 200) };
    if (!r.name) e.name = 'Name this plan.';
    if (!r.exercises.length) e.exercises = 'Add at least one exercise.';
    return { r, e };
  },
  bodyMetric(raw) {
    const e = {}, r = { date: raw.date, weight: Math.max(0, num(raw.weight)), waist: Math.max(0, num(raw.waist)), chest: Math.max(0, num(raw.chest)), arms: Math.max(0, num(raw.arms)), notes: str(raw.notes, 200) };
    requireDate(raw, 'date', e);
    if (!['weight', 'waist', 'chest', 'arms'].some(k => r[k] > 0)) e.weight = 'Add at least one measurement.';
    return { r, e };
  },
  transaction(raw) {
    const e = {}, r = { type: raw.type === 'income' ? 'income' : 'expense', amount: Math.round(num(raw.amount) * 100) / 100, category: oneOf(raw.category, OPTIONS.txCategory, 'Other'), date: raw.date, note: str(raw.note, 150), recurrence: oneOf(raw.recurrence, OPTIONS.recurrence, 'None') };
    if (!(r.amount > 0)) e.amount = 'Enter an amount above zero.';
    requireDate(raw, 'date', e);
    return { r, e };
  },
  budget(raw, { state, existing }) {
    const e = {}, r = { category: oneOf(raw.category, OPTIONS.budgetCategory, 'Other'), month: /^\d{4}-\d{2}$/.test(raw.month) ? raw.month : '', monthlyLimit: num(raw.monthlyLimit), alertAt: clamp(raw.alertAt || 80, 10, 100) };
    if (!(r.monthlyLimit > 0)) e.monthlyLimit = 'Enter a limit above zero.';
    if (!r.month) e.month = 'Choose a month.';
    else if (state.budgets.some(b => b.id !== existing?.id && b.category === r.category && b.month === r.month)) e.category = `A ${r.category} budget already exists for this month. Edit that one instead.`;
    return { r, e };
  },
  savingsGoal(raw) {
    const e = {}, r = { name: str(raw.name, 80), targetAmount: num(raw.targetAmount), savedAmount: Math.max(0, num(raw.savedAmount)), targetDate: dateOrEmpty(raw.targetDate) };
    if (!r.name) e.name = 'Name this goal.';
    if (!(r.targetAmount > 0)) e.targetAmount = 'Enter a target above zero.';
    return { r, e };
  },
  game(raw) {
    const e = {}, status = oneOf(raw.status, OPTIONS.gameStatus, 'Backlog');
    const rating = raw.rating === '' || raw.rating == null ? '' : clamp(int(raw.rating), 1, 10);
    const r = { title: str(raw.title, 100), platform: oneOf(raw.platform, OPTIONS.platform, 'Other'), status, hours: Math.max(0, num(raw.hours)), rating: rating === 0 ? '' : rating, progress: status === 'Completed' ? 100 : clamp(raw.progress), cover: typeof raw.cover === 'string' ? raw.cover.slice(0, 200000) : '', notes: str(raw.notes, 1500) };
    if (!r.title) e.title = 'Enter the game title.';
    return { r, e };
  },
  book(raw) {
    const e = {};
    const total = Math.max(0, int(raw.totalPages));
    let current = Math.max(0, int(raw.currentPage)), status = oneOf(raw.status, OPTIONS.bookStatus, 'To read');
    const r = { title: str(raw.title, 150), author: str(raw.author, 100), status, totalPages: total, currentPage: current, rating: clamp(int(raw.rating), 0, 5), notes: str(raw.notes, 3000) };
    if (!r.title) e.title = 'Enter the book title.';
    if (total && current > total) e.currentPage = `Cannot be more than ${total}.`;
    if (!e.currentPage) {
      if (total && current >= total) { r.status = 'Finished'; r.currentPage = total; }
      else if (status === 'Finished' && total) r.currentPage = total;
      else if (status === 'To read' && current > 0) r.status = 'Reading';
    }
    return { r, e };
  },
  note(raw) {
    const e = {}, body = str(raw.body, 8000);
    let title = str(raw.title, 150);
    if (!title && body) title = body.split(/\n/)[0].slice(0, 60);
    const r = { kind: oneOf(raw.kind, OPTIONS.noteKind, 'Note'), title, date: raw.date, body, tags: str(raw.tags, 120).split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean).slice(0, 12) };
    requireDate(raw, 'date', e);
    if (!title && !body) e.body = 'Write something or add a title.';
    return { r, e };
  },
  goal(raw, { existing }) {
    const e = {}, milestones = lines(raw.milestones).slice(0, 20);
    const status = oneOf(raw.status, OPTIONS.goalStatus, 'In progress');
    const prior = new Map((existing?.milestones || []).map((m, i) => [m, Boolean(existing?.milestoneDone?.[i])]));
    const done = milestones.map(m => status === 'Completed' || prior.get(m) || false);
    let progress = clamp(raw.progress);
    if (milestones.length) progress = Math.round((done.filter(Boolean).length / milestones.length) * 100);
    const r = { title: str(raw.title, 150), area: oneOf(raw.area, OPTIONS.goalArea, 'Personal'), status, targetDate: dateOrEmpty(raw.targetDate), progress, milestones, milestoneDone: done };
    if (r.status === 'Completed') r.progress = 100;
    else if (r.progress >= 100) { r.status = 'Completed'; r.progress = 100; }
    if (!r.title) e.title = 'Describe the goal.';
    return { r, e };
  }
};

export function prepare(type, raw, ctx) {
  const rule = rules[type];
  if (!rule) return { record: raw, errors: {} };
  const { r, e } = rule(raw, ctx);
  return { record: r, errors: e };
}
export const monthOf = monthKey;
