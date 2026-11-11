/* The one information architecture. Sidebar (wide), Library page (phones) and the tab bar all read this list,
 * so they can never drift apart. `tab` marks the four destinations that live in the phone tab bar. */
export const NAV = [
  { id: 'home', label: 'Home', icon: 'home', group: 'Today', tab: true, blurb: 'Your day at a glance' },
  { id: 'plan', label: 'Plan', icon: 'check-square', group: 'Today', tab: true, blurb: 'Tasks and priorities' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar', group: 'Today', blurb: 'Dates across everything' },
  { id: 'habits', label: 'Habits', icon: 'repeat', group: 'Today', blurb: 'Daily check-ins' },
  { id: 'goals', label: 'Goals', icon: 'target', group: 'Today', blurb: 'Longer-term aims' },
  { id: 'academics', label: 'Academics', icon: 'graduation', group: 'Life', blurb: 'Subjects and deadlines' },
  { id: 'finance', label: 'Finance', icon: 'wallet', group: 'Life', blurb: 'Money and budgets' },
  { id: 'fitness', label: 'Fitness', icon: 'dumbbell', group: 'Life', blurb: 'Training and records' },
  { id: 'gaming', label: 'Gaming', icon: 'gamepad', group: 'Life', blurb: 'Your game library' },
  { id: 'learning', label: 'Learning', icon: 'book', group: 'Life', blurb: 'Books and reading' },
  { id: 'journal', label: 'Notes', icon: 'notebook', group: 'Personal', blurb: 'Notes and journal' },
  { id: 'discipline', label: 'Discipline', icon: 'shield', group: 'Personal', blurb: 'Streaks and challenges' },
  { id: 'levels', label: 'Levels', icon: 'trophy', group: 'Progress', blurb: 'XP and rewards' },
  { id: 'insights', label: 'Insights', icon: 'chart', group: 'Progress', tab: true, blurb: 'Trends from your data' },
  { id: 'settings', label: 'Settings', icon: 'sliders', group: 'System', blurb: 'Appearance and data' }
];
export const GROUPS = ['Today', 'Life', 'Personal', 'Progress', 'System'];
export const navById = id => NAV.find(n => n.id === id);
export const DEFAULT_ROUTE = 'home';
