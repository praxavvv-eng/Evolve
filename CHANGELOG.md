# Changelog

## 9.1.0: refinement update

- Header: Cloud icon removed. Cloud Sync now lives in Settings > Cloud sync (connection status, pairing code, join workspace); `#/cloud` forwards there. Firebase, pairing and merge logic are unchanged.
- Navigation: new independent Icon style setting (Outline, Rounded, Filled, Duotone) for the bottom bar and sidebar. Tabs are equal-width slots in all four bar styles, the active marker stays inside its slot, bars are shorter, and the space reserved under content is measured from the real bar (safe area included).
- Icon picker for Habits, Discipline challenges and Goals (grouped, searchable, stored as `iconId`). Older items get an automatic icon from their name; nothing is migrated. Legacy emoji data is kept untouched but no longer displayed.
- Home: refined progress card (ring, count-up numbers, task/habit bars) that animates only when values change; Quick Add is now four equal tiles with no horizontal overflow.
- Finance: new balance card with Income / Expenses / Net, Indian grouping everywhere (-₹2,028, ₹1,25,000), animated figures, duplicate "Other" donut slice fixed at its cause.
- Custom in-app date picker (month/year navigation, Today, Cancel/Confirm) replaces the native picker in forms.
- Library: Notes preview removed from the landing page (Notes module untouched); stray ledge strip removed.
- Gaming: separate portrait poster and landscape artwork (`banner`, additive). Featured card, Library "now playing" and game detail use the artwork, with an undistorted poster fallback; Dropped and On hold are separate; duplicate playtime controls removed.
- Habits: heatmaps rebuilt as one responsive grid that uses the card width, with sticky weekday labels, month labels and a scroll fade where scrolling is needed.
- Books and Games: fixed status order and a "Change status" picker; "Want to read" is a display label for the stored value "To read".

## 9.0.0: complete UI/UX redesign

- New brand: Evolve mark (E built from stepped bars), app icon, PWA icons (192, 512, maskable, Apple touch), splash screen.
- New design system: pure white light theme, true AMOLED black dark theme, System; seven accents plus custom colour with automatic contrast correction.
- Four appearance styles (Minimal, Glass, Cinematic, Classic) and four bottom-navigation styles (Minimal, Cinematic, Glass, Casual), selectable in Settings and persisted.
- Redesigned shell: compact top bar (one action capsule), Quick Add grouped by intent, search with filters.
- Home rebuilt as a daily command centre; empty states are compact; only real data is shown.
- Planner: compact task rows, sorting, priority/area filters, quick add field, task and event detail sheets; calendar fixes (stale selected day after midnight, events clamped to 24h, all-day band in Week view).
- Growth: new habit streak engine (weekly targets, custom weekdays, rest days), per-habit colour yearly contribution graph with weekday and month labels, combined consistency graph, weekly history.
- Life: Finance redesign with amount-first transaction entry, category icons, wallet overview; Fitness stepper-based logging; Academics restyle.
- Library: bookshelf, poster-based game library with cinematic hero and playtime logging, notes with search, tags and reading view.
- Module-specific forms with dirty-state protection, steppers, weekday picker, category grid, writing layout.
- Settings split into Appearance Studio, Navigation, Preferences, Data and backup, Recently deleted and About.
