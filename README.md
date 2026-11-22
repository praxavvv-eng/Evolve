# Evolve

A private, mobile-first personal life-management app: tasks, calendar, habits and streaks, discipline challenges, goals, levels, academics, finance, fitness, books, games, notes, insights and optional cloud sync. Vanilla JavaScript, HTML and CSS, built with Vite, Firebase for optional sync. No framework.

## Run it

```bash
npm install
npm run dev        # local development
npm run build      # production build into dist/
npm run preview    # serve the production build
```

Deploy `dist/` to any static host (Vercel, Netlify, Firebase Hosting). The Firebase web config lives in `js/firebase.js` (web API keys are public by design; protect data with Firestore security rules).

## Where things are

- Cloud sync: Settings > Cloud sync (rendered by `js/cloud/boot.js`, shown through `js/core/cloudview.js`).
- Navigation icon families: `js/core/navicons.js`. Per-item icons: `js/core/itemicons.js`. Date picker: `js/components/datepicker.js`. Animated numbers: `js/components/countup.js`.
- Additive fields: `settings.navIcons`, `habit/challenge/goal.iconId`, `game.banner`.

## Design system

Everything visual is defined once.

| File | Purpose |
| --- | --- |
| `css/tokens.css` | Colour (pure white light theme, AMOLED black dark theme), type scale, spacing, radius, motion, elevation |
| `css/styles.css` | The four appearance styles: Minimal, Glass, Cinematic, Classic. Each only redefines card/backdrop tokens |
| `css/base.css` | Typography, buttons, fields, segmented control, chips, cards, progress, list rows |
| `css/navigation.css` | Four bottom-bar styles (Minimal, Cinematic, Glass, Casual) and the desktop sidebar |
| `css/layout.css` | App shell, top bar, page container, grids |
| `css/components.css`, `css/forms.css` | Sheets, menus, toasts, charts, search, and the purpose-built form layouts |
| `css/modules/*.css` | Module-specific screens |

`js/core/appearance.js` applies the settings to `<html>` (`data-scheme`, `data-style`, `data-navstyle`) and computes accessible accent colours: filled controls always get readable text (4.5:1), and accent-coloured text is adjusted per theme.

Settings that drive it (all stored in `settings`, additive and backwards compatible): `theme` (light / dark / system), `amoled`, `accent`, `customAccent`, `style`, `navStyle`, `glass`, `density`, `textSize`, `motion`.

## Habit rules (`js/core/stats.js`)

- One check-in per habit per day (`habitLogs[date][habitId]`), local dates only.
- Future days are never missed. Unscheduled days never break a streak. Rest days (`habit.skips[date]`) are not failures.
- Schedules: Daily, Weekdays, Weekends, Specific days (`habit.days`), or Flexible N days per week (`habit.perWeek`, streak counted in weeks).
- `node tests/streak.test.mjs` runs the streak rule tests (no dependencies).

## Data safety

Storage keys, collections, schemas, backup format, trash, migrations, service worker and the Firebase sync code are unchanged. New fields are additive (`settings.style`, `settings.navStyle`, `habit.days`, `habit.perWeek`, `habit.skips`); records without them still load. Older accent ids are mapped to the nearest current accent.

## Search

Ctrl / ⌘ K opens search from anywhere.
