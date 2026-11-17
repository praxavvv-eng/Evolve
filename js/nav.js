/* The one information architecture: five destinations. Sidebar (wide screens), tab bar (phones) and the
 * sub-navigation inside each destination all read from this file, so they cannot drift apart. */
export const NAV = [
  { id: 'home', label: 'Today', icon: 'home', blurb: 'Your day at a glance' },
  { id: 'plan', label: 'Tasks', icon: 'check-square', blurb: 'Tasks and priorities' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar', blurb: 'Month, week and day' },
  { id: 'habits', label: 'Habits', icon: 'repeat', blurb: 'Daily check-ins and streaks' },
  { id: 'discipline', label: 'Discipline', icon: 'shield', blurb: 'Your own challenges' },
  { id: 'goals', label: 'Goals', icon: 'target', blurb: 'Longer-term aims' },
  { id: 'levels', label: 'Levels', icon: 'trophy', blurb: 'XP and rewards' },
  { id: 'academics', label: 'Academics', icon: 'graduation', blurb: 'Subjects and deadlines' },
  { id: 'finance', label: 'Finance', icon: 'wallet', blurb: 'Money and budgets' },
  { id: 'fitness', label: 'Fitness', icon: 'dumbbell', blurb: 'Training and records' },
  { id: 'learning', label: 'Books', icon: 'book', blurb: 'Your bookshelf' },
  { id: 'gaming', label: 'Games', icon: 'gamepad', blurb: 'Your game library' },
  { id: 'journal', label: 'Notes', icon: 'notebook', blurb: 'Notes and journal' },
  { id: 'library', label: 'Library', icon: 'book', blurb: 'Books, games and notes' },
  { id: 'insights', label: 'Insights', icon: 'chart', blurb: 'Trends from your data' },
  { id: 'settings', label: 'Settings', icon: 'sliders', blurb: 'Appearance and data' }
];

/** The five main destinations. `route` is the default landing; `items` are the screens inside it. */
export const HUBS = [
  { id: 'today', label: 'Today', icon: 'home', route: 'home', items: ['home'] },
  { id: 'planner', label: 'Planner', icon: 'calendar', route: 'plan', items: ['plan', 'calendar'] },
  { id: 'growth', label: 'Growth', icon: 'trending-up', route: 'habits', items: ['habits', 'discipline', 'goals', 'levels'] },
  { id: 'life', label: 'Life', icon: 'layers', route: 'academics', items: ['academics', 'finance', 'fitness'] },
  { id: 'library', label: 'Library', icon: 'book', route: 'library', items: ['library', 'learning', 'gaming', 'journal'] }
];
/** Secondary destinations, reachable from the More menu. */
export const MORE = ['insights', 'settings'];

export const navById = id => NAV.find(n => n.id === id);
export const hubOf = id => HUBS.find(h => h.items.includes(id)) || null;
export const DEFAULT_ROUTE = 'home';

/** Segmented sub-navigation shown at the top of a screen that shares its destination with others. */
export function subnavHTML(id) {
  const hub = hubOf(id);
  const items = hub ? hub.items.filter(x => x !== 'library') : [];
  if (!hub || items.length < 2 || id === 'library') return '';
  return `<nav class="subnav" aria-label="${hub.label}">${items.map(x => `<a href="#/${x}" ${x === id ? 'aria-current="page"' : ''}>${navById(x).label}</a>`).join('')}</nav>`;
}
