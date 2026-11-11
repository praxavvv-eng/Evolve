/* Record schemas. Data only: field lists drive the form builder, validation lives in validation.js.
 * Field names are unchanged from V6 so existing data keeps working.
 *   half:true  -> two short fields share one row on any width
 *   when(v)    -> field only shown while the predicate is true
 */
import { todayStr, monthKey } from './utils.js';

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
export const TX_TYPE_OPTIONS = [opt('Expense', 'expense'), opt('Income', 'income')];

export const schemas = {
  task: {
    list: 'tasks', label: 'task', icon: 'check-square', title: r => r.title,
    defaults: () => ({ due: todayStr(), priority: 'Medium', category: 'Personal', repeat: 'None' }),
    fields: [
      { name: 'title', label: 'Task', type: 'text', required: true, placeholder: 'What needs doing?', max: 150 },
      { name: 'due', label: 'Due', type: 'date', half: true },
      { name: 'priority', label: 'Priority', type: 'select', options: OPTIONS.priority, half: true },
      { name: 'category', label: 'Area', type: 'select', options: OPTIONS.taskCategory, half: true },
      { name: 'repeat', label: 'Repeat', type: 'select', options: OPTIONS.repeat, half: true },
      { name: 'notes', label: 'Notes', type: 'textarea', rows: 2, max: 1000, placeholder: 'Optional' }
    ]
  },
  habit: {
    list: 'habits', label: 'habit', icon: 'repeat', title: r => r.name,
    defaults: () => ({ icon: '✦', target: 1, unit: 'times', schedule: 'Daily' }),
    fields: [
      { name: 'name', label: 'Habit', type: 'text', required: true, placeholder: 'e.g. Read 10 pages', max: 80 },
      { name: 'icon', label: 'Symbol', type: 'text', half: true, max: 4, placeholder: '✦' },
      { name: 'schedule', label: 'Schedule', type: 'select', options: OPTIONS.habitSchedule, half: true },
      { name: 'target', label: 'Daily target', type: 'number', min: 1, step: 1, half: true },
      { name: 'unit', label: 'Unit', type: 'select', options: OPTIONS.habitUnit, half: true }
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
      { name: 'due', label: 'Due', type: 'date', half: true },
      { name: 'status', label: 'Status', type: 'select', options: OPTIONS.academicStatus, half: true },
      { name: 'progress', label: 'Completed', type: 'range', min: 0, max: 100, step: 5, suffix: '%' },
      { name: 'details', label: 'Details', type: 'textarea', rows: 2, max: 1000, placeholder: 'Optional' }
    ]
  },
  workout: {
    list: 'workoutLogs', label: 'workout entry', icon: 'dumbbell', title: r => r.exercise,
    defaults: () => ({ date: todayStr(), sets: 3, reps: 10, weight: 0, duration: 0 }),
    fields: [
      { name: 'exercise', label: 'Exercise', type: 'text', required: true, placeholder: 'e.g. Bench press', max: 80, suggest: 'exercises' },
      { name: 'date', label: 'Date', type: 'date', required: true, half: true },
      { name: 'sets', label: 'Sets', type: 'number', min: 1, step: 1, required: true, half: true },
      { name: 'reps', label: 'Reps per set', type: 'number', min: 1, step: 1, required: true, half: true },
      { name: 'weight', label: 'Weight (kg)', type: 'number', min: 0, step: 'any', half: true },
      { name: 'duration', label: 'Minutes', type: 'number', min: 0, step: 1, half: true },
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
    defaults: () => ({ type: 'expense', date: todayStr(), category: 'Food', recurrence: 'None' }),
    fields: [
      { name: 'type', label: 'Type', type: 'segmented', options: TX_TYPE_OPTIONS },
      { name: 'amount', label: 'Amount', type: 'number', min: 0, step: 'any', required: true, big: true, placeholder: '0', prefix: 'currency' },
      { name: 'category', label: 'Category', type: 'select', options: OPTIONS.txCategory, half: true },
      { name: 'date', label: 'Date', type: 'date', required: true, half: true },
      { name: 'note', label: 'Description', type: 'text', max: 150, placeholder: 'Optional' },
      { name: 'recurrence', label: 'Repeats', type: 'select', options: OPTIONS.recurrence, hint: 'Labelled only. Future entries are not posted automatically.' }
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
    defaults: () => ({ status: 'Playing', platform: 'PC', hours: 0, progress: 0 }),
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Game title', max: 100 },
      { name: 'platform', label: 'Platform', type: 'select', options: OPTIONS.platform, half: true },
      { name: 'status', label: 'Status', type: 'select', options: OPTIONS.gameStatus, half: true },
      { name: 'hours', label: 'Hours played', type: 'number', min: 0, step: 'any', half: true },
      { name: 'rating', label: 'Rating (1–10)', type: 'number', min: 1, max: 10, step: 1, half: true },
      { name: 'progress', label: 'Progress', type: 'range', min: 0, max: 100, step: 5, suffix: '%', when: v => v.status !== 'Completed' },
      { name: 'cover', label: 'Cover art', type: 'cover', hint: 'Optional. Choose an image from your device; a designed cover is used otherwise.' },
      { name: 'notes', label: 'Notes', type: 'textarea', rows: 2, max: 1500, placeholder: 'Optional' }
    ]
  },
  book: {
    list: 'books', label: 'book', icon: 'book', title: r => r.title,
    defaults: () => ({ status: 'Reading', totalPages: 0, currentPage: 0, rating: 0 }),
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Book title', max: 150 },
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
    defaults: () => ({ kind: 'Note', date: todayStr() }),
    fields: [
      { name: 'kind', label: 'Type', type: 'segmented', options: OPTIONS.noteKind },
      { name: 'title', label: 'Title', type: 'text', placeholder: 'Optional if you add text', max: 150 },
      { name: 'body', label: 'Write', type: 'textarea', rows: 7, max: 8000, placeholder: 'Your thoughts…' },
      { name: 'date', label: 'Date', type: 'date', half: true, required: true },
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
  }
};
