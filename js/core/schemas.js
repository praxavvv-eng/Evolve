/* Record schemas. Data only: field lists drive the form builder, validation lives in validation.js.
 * Field names are unchanged from V6 so existing data keeps working.
 *   half:true  -> two short fields share one row on any width
 *   when(v)    -> field only shown while the predicate is true
 */
import { todayStr, monthKey } from './utils.js';
import { HABIT_COLORS } from '../storage/migration.js';

export const OPTIONS = {
  taskCategory: ['Personal', 'Academics', 'Fitness', 'Work', 'Finance', 'Learning', 'Other'],
  priority: ['Low', 'Medium', 'High'],
  repeat: ['None', 'Daily', 'Weekly', 'Monthly'],
  habitUnit: ['times', 'min', 'hours', 'pages', 'reps', 'glasses'],
  habitSchedule: ['Daily', 'Weekdays', 'Weekends', '3 days / week', 'Custom'],
  academicType: ['Assignment', 'Practical', 'Exam', 'Project', 'Other'],
  academicStatus: ['Pending', 'In Progress', 'Completed'],
  focus: ['Full body', 'Upper body', 'Lower body', 'Push', 'Pull', 'Legs', 'Cardio', 'Custom'],
  txType: ['expense', 'income'],
  txCategory: ['Food', 'Transport', 'Shopping', 'Education', 'Entertainment', 'Bills', 'Health', 'Salary', 'Gift', 'Other'],
  expenseCategory: ['Food', 'Transport', 'Shopping', 'Education', 'Entertainment', 'Bills', 'Health', 'Gift', 'Other'],
  incomeCategory: ['Salary', 'Gift', 'Other'],
  budgetCategory: ['Food', 'Transport', 'Shopping', 'Education', 'Entertainment', 'Bills', 'Health', 'Other'],
  recurrence: ['None', 'Weekly', 'Monthly', 'Yearly'],
  platform: ['PC', 'PlayStation', 'Xbox', 'Nintendo Switch', 'Mobile', 'Other'],
  gameStatus: ['Playing', 'Backlog', 'Completed', 'On hold', 'Dropped'],
  bookStatus: ['Reading', 'To read', 'Finished', 'Paused', 'Dropped'],
  noteKind: ['Note', 'Journal', 'Idea', 'Reflection'],
  goalArea: ['Personal', 'Academics', 'Fitness', 'Finance', 'Learning', 'Other'],
  goalStatus: ['In progress', 'Completed', 'On hold']
};
const opt = (label, value) => ({ value, label });
export const CAT_ICONS = { Food: 'utensils', Transport: 'car', Shopping: 'bag', Education: 'graduation', Entertainment: 'film', Bills: 'receipt', Health: 'heart', Salary: 'briefcase', Gift: 'gift', Other: 'tag' };
export const PRIORITY_COLORS = { Low: 'var(--info)', Medium: 'var(--warn)', High: 'var(--neg)' };
export const WEEKDAYS = [{ v: 1, l: 'M', n: 'Monday' }, { v: 2, l: 'T', n: 'Tuesday' }, { v: 3, l: 'W', n: 'Wednesday' }, { v: 4, l: 'T', n: 'Thursday' }, { v: 5, l: 'F', n: 'Friday' }, { v: 6, l: 'S', n: 'Saturday' }, { v: 0, l: 'S', n: 'Sunday' }];
export const TX_TYPE_OPTIONS = [opt('Expense', 'expense'), opt('Income', 'income')];

export const schemas = {
  task: {
    list: 'tasks', label: 'task', icon: 'check-square', title: r => r.title,
    form: { layout: 'compact', create: 'New task', submit: 'Add task' },
    defaults: () => ({ due: todayStr(), priority: 'Medium', category: 'Personal', repeat: 'None' }),
    fields: [
      { name: 'title', label: 'Task', type: 'text', required: true, placeholder: 'What needs doing?', max: 150, cls: 't-big' },
      { name: 'priority', label: 'Priority', type: 'pills', options: ['Low', 'Medium', 'High'].map(v => ({ value: v, label: v, color: PRIORITY_COLORS[v] })) },
      { name: 'due', label: 'Date', type: 'date', half: true, quick: true, clearable: true },
      { name: 'dueTime', label: 'Time (optional)', type: 'time', half: true, clearable: true },
      { name: 'category', label: 'Area', type: 'select', options: OPTIONS.taskCategory, half: true },
      { name: 'repeat', label: 'Repeat', type: 'select', options: OPTIONS.repeat, half: true },
      { name: 'notes', label: 'Notes', type: 'textarea', rows: 2, max: 1000, placeholder: 'Optional' }
    ]
  },
  habit: {
    list: 'habits', label: 'habit', icon: 'repeat', title: r => r.name,
    form: { layout: 'compact', create: 'New habit', submit: 'Create habit' },
    defaults: () => ({ icon: '✦', target: 1, unit: 'times', schedule: 'Daily', color: HABIT_COLORS[0].hex, days: [1, 2, 3, 4, 5, 6, 0], perWeek: 3 }),
    fields: [
      { name: 'name', label: 'Habit', type: 'text', required: true, placeholder: 'e.g. Read 10 pages', max: 80, cls: 't-big' },
      { name: 'color', label: 'Colour', type: 'colors', options: HABIT_COLORS },
      { name: 'schedule', label: 'Schedule', type: 'select', options: [{ value: 'Daily', label: 'Every day' }, { value: 'Weekdays', label: 'Weekdays (Mon–Fri)' }, { value: 'Weekends', label: 'Weekends' }, { value: '3 days / week', label: 'Flexible: some days each week' }, { value: 'Custom', label: 'Specific days' }] },
      { name: 'days', label: 'Days', type: 'weekdays', when: v => v.schedule === 'Custom', hint: 'Days you do not choose never break the streak.' },
      { name: 'perWeek', label: 'Days per week', type: 'stepper', min: 1, max: 6, step: 1, when: v => v.schedule === '3 days / week', hint: 'Any days count. The streak counts weeks that reach this number.' },
      { name: 'description', label: 'Description', type: 'text', max: 200, placeholder: 'Optional' },
      { name: 'icon', label: 'Symbol', type: 'text', half: true, max: 4, placeholder: '✦', more: true },
      { name: 'target', label: 'Daily target', type: 'number', min: 1, step: 1, half: true, more: true },
      { name: 'unit', label: 'Unit', type: 'select', options: OPTIONS.habitUnit, half: true, more: true }
    ]
  },
  subject: {
    list: 'subjects', label: 'subject', icon: 'graduation', title: r => r.name,
    defaults: () => ({ totalAssignments: 1, totalPracticals: 0, classesHeld: 0, classesAttended: 0 }),
    fields: [
      { name: 'name', label: 'Subject', type: 'text', required: true, placeholder: 'e.g. Zoology', max: 80 },
      { name: 'code', label: 'Short code', type: 'text', half: true, max: 12, placeholder: 'Optional' },
      { name: 'totalAssignments', label: 'Total assignments', type: 'number', min: 1, step: 1, required: true, half: true, hint: 'Progress is measured against this number.' },
      { name: 'totalPracticals', label: 'Total practicals', type: 'number', min: 0, step: 1, half: true },
      { name: 'classesHeld', label: 'Classes held', type: 'number', min: 0, step: 1, half: true },
      { name: 'classesAttended', label: 'Classes attended', type: 'number', min: 0, step: 1, half: true }
    ]
  },
  academic: {
    list: 'academicItems', label: 'academic item', icon: 'graduation', title: r => r.title,
    defaults: () => ({ due: todayStr(), status: 'Pending', type: 'Assignment', progress: 0, subject: 'General' }),
    fields: [
      { name: 'type', label: 'Type', type: 'segmented', options: ['Assignment', 'Practical', 'Exam', 'Project'] },
      { name: 'subject', label: 'Subject', type: 'select', options: 'subjects', half: true },
      { name: 'assignmentNo', label: 'Assignment no.', type: 'number', min: 1, step: 1, half: true, when: v => v.type === 'Assignment' },
      { name: 'practicalNo', label: 'Practical no.', type: 'number', min: 1, step: 1, half: true, when: v => v.type === 'Practical' },
      { name: 'title', label: 'Title', type: 'text', max: 150, placeholder: 'Auto-named if left empty', when: v => ['Assignment', 'Practical'].includes(v.type) },
      { name: 'title', label: 'Title', type: 'text', max: 150, required: true, placeholder: 'e.g. Mid-term exam', when: v => !['Assignment', 'Practical'].includes(v.type) },
      { name: 'due', label: 'Due date', type: 'date', half: true, quick: true, clearable: true },
      { name: 'dueTime', label: 'Time (optional)', type: 'time', half: true, clearable: true },
      { name: 'status', label: 'Status', type: 'select', options: OPTIONS.academicStatus },
      { name: 'progress', label: 'Completed', type: 'range', min: 0, max: 100, step: 5, suffix: '%' },
      { name: 'details', label: 'Details', type: 'textarea', rows: 2, max: 1000, placeholder: 'Optional' }
    ]
  },
  workout: {
    list: 'workoutLogs', label: 'workout entry', icon: 'dumbbell', title: r => r.exercise,
    form: { layout: 'compact', create: 'Log exercise', edit: 'Edit exercise', submit: 'Save set' },
    defaults: () => ({ date: todayStr(), sets: 3, reps: 10, weight: 0, duration: 0 }),
    fields: [
      { name: 'exercise', label: 'Exercise', type: 'text', required: true, placeholder: 'e.g. Bench press', max: 80, suggest: 'exercises', cls: 't-big' },
      { name: 'sets', label: 'Sets', type: 'stepper', min: 1, max: 99, step: 1, required: true, half: true },
      { name: 'reps', label: 'Reps per set', type: 'stepper', min: 1, max: 999, step: 1, required: true, half: true },
      { name: 'weight', label: 'Weight (kg)', type: 'stepper', min: 0, max: 999, step: 2.5, half: true },
      { name: 'duration', label: 'Minutes', type: 'stepper', min: 0, max: 600, step: 5, half: true },
      { name: 'date', label: 'Date', type: 'date', required: true, quick: 'past' },
      { name: 'notes', label: 'Notes', type: 'textarea', rows: 2, max: 600, placeholder: 'Optional' }
    ]
  },
  workoutTemplate: {
    list: 'workoutTemplates', label: 'workout plan', icon: 'list', title: r => r.name,
    defaults: () => ({ focus: 'Full body', exercises: '' }),
    fields: [
      { name: 'name', label: 'Plan name', type: 'text', required: true, placeholder: 'e.g. Push day', max: 80, half: true },
      { name: 'focus', label: 'Focus', type: 'select', options: OPTIONS.focus, half: true },
      { name: 'exercises', label: 'Exercises', type: 'textarea', rows: 5, required: true, placeholder: 'One exercise per line', hint: 'One exercise per line, up to 30.' },
      { name: 'notes', label: 'Notes', type: 'text', max: 200, placeholder: 'Optional' }
    ]
  },
  bodyMetric: {
    list: 'bodyMetrics', label: 'measurement', icon: 'trending-up', title: r => `Measurements ${r.date}`,
    defaults: () => ({ date: todayStr() }),
    fields: [
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'weight', label: 'Weight (kg)', type: 'number', min: 0, step: 'any', half: true },
      { name: 'waist', label: 'Waist (cm)', type: 'number', min: 0, step: 'any', half: true },
      { name: 'chest', label: 'Chest (cm)', type: 'number', min: 0, step: 'any', half: true },
      { name: 'arms', label: 'Arm (cm)', type: 'number', min: 0, step: 'any', half: true },
      { name: 'notes', label: 'Notes', type: 'text', max: 200, placeholder: 'Optional' }
    ]
  },
  transaction: {
    list: 'transactions', label: 'transaction', icon: 'receipt', title: r => r.note || r.category,
    form: { layout: 'amount', create: 'New transaction', edit: 'Edit transaction', submit: 'Add transaction' },
    defaults: () => ({ type: 'expense', date: todayStr(), category: 'Food', recurrence: 'None' }),
    fields: [
      { name: 'type', label: 'Type', type: 'txtype', options: TX_TYPE_OPTIONS },
      { name: 'amount', label: 'Amount', type: 'amount', min: 0, required: true, placeholder: '0' },
      { name: 'category', label: 'Category', type: 'categories' },
      { name: 'date', label: 'Date', type: 'date', required: true, quick: 'finance' },
      { name: 'note', label: 'Description', type: 'text', max: 150, placeholder: 'Optional' },
      { name: 'recurrence', label: 'Repeats', type: 'select', options: OPTIONS.recurrence, hint: 'Labelled only. Future entries are not posted automatically.', more: true }
    ]
  },
  budget: {
    list: 'budgets', label: 'budget', icon: 'wallet', title: r => `${r.category} budget`,
    defaults: () => ({ month: monthKey(todayStr()), alertAt: 80, category: 'Food' }),
    fields: [
      { name: 'category', label: 'Category', type: 'select', options: OPTIONS.budgetCategory, half: true },
      { name: 'month', label: 'Month', type: 'month', required: true, half: true },
      { name: 'monthlyLimit', label: 'Monthly limit', type: 'number', min: 0, step: 'any', required: true, big: true, placeholder: '0', prefix: 'currency' },
      { name: 'alertAt', label: 'Warn me at', type: 'range', min: 10, max: 100, step: 5, suffix: '%' }
    ]
  },
  savingsGoal: {
    list: 'savingsGoals', label: 'savings goal', icon: 'piggy', title: r => r.name,
    defaults: () => ({ savedAmount: 0 }),
    fields: [
      { name: 'name', label: 'Goal', type: 'text', required: true, placeholder: 'e.g. New laptop', max: 80 },
      { name: 'targetAmount', label: 'Target', type: 'number', min: 0, step: 'any', required: true, half: true, prefix: 'currency' },
      { name: 'savedAmount', label: 'Saved so far', type: 'number', min: 0, step: 'any', half: true, prefix: 'currency' },
      { name: 'targetDate', label: 'Target date', type: 'date' }
    ]
  },
  game: {
    list: 'games', label: 'game', icon: 'gamepad', title: r => r.title,
    form: { layout: 'cover', size: 'wide', create: 'Add game', submit: 'Add game' },
    defaults: () => ({ status: 'Playing', platform: 'PC', hours: 0, progress: 0 }),
    fields: [
      { name: 'cover', label: 'Poster', type: 'cover', ratio: 3 / 4, poster: true, hint: 'Optional. Choose an image from your device; a designed poster is used otherwise.' },
      { name: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Game title', max: 100, cls: 't-big' },
      { name: 'platform', label: 'Platform', type: 'select', options: OPTIONS.platform, half: true },
      { name: 'status', label: 'Status', type: 'select', options: OPTIONS.gameStatus, half: true },
      { name: 'hours', label: 'Hours played', type: 'number', min: 0, step: 'any', half: true },
      { name: 'estimatedHours', label: 'Estimated total hours', type: 'number', min: 0, step: 'any', half: true, placeholder: 'Optional' },
      { name: 'rating', label: 'Rating (1–10)', type: 'number', min: 1, max: 10, step: 1 },
      { name: 'progress', label: 'Progress (manual)', type: 'range', min: 0, max: 100, step: 5, suffix: '%', hint: 'Add estimated total hours and progress is calculated from your playtime instead.', when: v => v.status !== 'Completed' && !(Number(v.estimatedHours) > 0) },
      { name: 'notes', label: 'Notes', type: 'textarea', rows: 2, max: 1500, placeholder: 'Optional' }
    ]
  },
  book: {
    list: 'books', label: 'book', icon: 'book', title: r => r.title,
    form: { layout: 'cover', size: 'wide', create: 'Add book', submit: 'Add book' },
    defaults: () => ({ status: 'Reading', totalPages: 0, currentPage: 0, rating: 0 }),
    fields: [
      { name: 'cover', label: 'Cover', type: 'cover', ratio: 2 / 3, hint: 'Optional. Stored sharp at up to 600 × 900.' },
      { name: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Book title', max: 150, cls: 't-big' },
      { name: 'author', label: 'Author', type: 'text', max: 100, placeholder: 'Optional' },
      { name: 'status', label: 'Status', type: 'select', options: OPTIONS.bookStatus, half: true },
      { name: 'rating', label: 'Rating (1–5)', type: 'number', min: 0, max: 5, step: 1, half: true },
      { name: 'currentPage', label: 'Current page', type: 'number', min: 0, step: 1, half: true },
      { name: 'totalPages', label: 'Total pages', type: 'number', min: 0, step: 1, half: true },
      { name: 'notes', label: 'Notes', type: 'textarea', rows: 3, max: 3000, placeholder: 'Takeaways, quotes you wrote yourself…' }
    ]
  },
  note: {
    list: 'notes', label: 'entry', icon: 'notebook', title: r => r.title,
    form: { layout: 'writing', size: 'full', create: 'New note', edit: 'Edit note', submit: 'Save note' },
    defaults: () => ({ kind: 'Note', date: todayStr() }),
    fields: [
      { name: 'kind', label: 'Type', type: 'segmented', options: OPTIONS.noteKind, cls: 'w-kind' },
      { name: 'title', label: 'Title', type: 'text', placeholder: 'Title', max: 150, cls: 'w-title', hideLabel: true },
      { name: 'body', label: 'Write', type: 'textarea', rows: 12, max: 8000, placeholder: 'Start writing…', cls: 'w-body', hideLabel: true },
      { name: 'date', label: 'Date', type: 'date', required: true, half: true },
      { name: 'tags', label: 'Tags', type: 'text', half: true, placeholder: 'comma, separated', max: 120 }
    ]
  },
  goal: {
    list: 'goals', label: 'goal', icon: 'target', title: r => r.title,
    defaults: () => ({ area: 'Personal', status: 'In progress', progress: 0, milestones: '' }),
    fields: [
      { name: 'title', label: 'Goal', type: 'text', required: true, placeholder: 'What do you want to achieve?', max: 150 },
      { name: 'area', label: 'Area', type: 'select', options: OPTIONS.goalArea, half: true },
      { name: 'status', label: 'Status', type: 'select', options: OPTIONS.goalStatus, half: true },
      { name: 'targetDate', label: 'Target date', type: 'date' },
      { name: 'progress', label: 'Progress', type: 'range', min: 0, max: 100, step: 5, suffix: '%', hint: 'With milestones, progress follows the checked milestones.' },
      { name: 'milestones', label: 'Milestones', type: 'textarea', rows: 3, placeholder: 'One per line', hint: 'Optional. Up to 20.' }
    ]
  },
  event: {
    list: 'events', label: 'event', icon: 'calendar', title: r => r.title,
    form: { layout: 'compact', create: 'New event', submit: 'Add event' },
    defaults: () => ({ date: todayStr() }),
    fields: [
      { name: 'title', label: 'Event', type: 'text', required: true, placeholder: 'What is happening?', max: 120, cls: 't-big' },
      { name: 'date', label: 'Date', type: 'date', required: true, quick: true },
      { name: 'startTime', label: 'Starts', type: 'time', required: true, half: true },
      { name: 'endTime', label: 'Ends (optional)', type: 'time', half: true, clearable: true },
      { name: 'notes', label: 'Notes', type: 'textarea', rows: 2, max: 600, placeholder: 'Optional' }
    ]
  },
  challenge: {
    list: 'challenges', label: 'challenge', icon: 'shield', title: r => r.name,
    defaults: () => ({ startDate: todayStr(), targetDays: 30 }),
    fields: [
      { name: 'name', label: 'Challenge', type: 'text', required: true, placeholder: 'e.g. Read every day', max: 80 },
      { name: 'startDate', label: 'Start date', type: 'date', required: true, half: true },
      { name: 'targetDays', label: 'Target (days)', type: 'number', min: 1, step: 1, required: true, half: true, presets: [7, 30, 60, 90] },
      { name: 'reward', label: 'Personal reward (optional)', type: 'text', max: 120, placeholder: 'Something to look forward to' }
    ]
  }
};
