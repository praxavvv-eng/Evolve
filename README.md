# Evolve V7

A private, mobile-first personal life-management app: tasks, habits, academics, finance, fitness, gaming, reading, notes, goals, discipline tracking, levels and insights. Everything is stored in your browser. There is no server, no account and no API key.

## Run it

1. Unzip `Evolve-V7.zip`.
2. Open the `Evolve-V7` folder in VS Code.
3. Right-click `index.html` and choose **Open with Live Server**.

No `npm install`, no build step. The app uses ES modules, so open it through Live Server (or any local web server). Opening `index.html` by double-click (`file://`) will not work because browsers block modules there.

Any static host works too: upload the folder as-is.

## Moving your V6 data

V7 reads V6 data automatically when it is served from the **same address and port** as V6 (the same `localhost:5500`, for example). It copies the data into a new V7 storage key and never changes or deletes the V6 key, so V6 keeps working.

If V7 runs from a different address (a different port counts), the browser keeps storage separate. In that case:

1. Open V6, go to its backup/export, and download the JSON file.
2. Open V7, go to **Settings → Your data → Import backup**.
3. Review the preview and confirm. V7 keeps a snapshot, so **Restore the data you had before the last import** undoes it.

During migration the Learning module is restored from the books V6 archived. The V6 archive copy stays in the data. V6 Focus Mode sessions stay archived and are not shown.

## What changed from V6

- New design system: deep black / charcoal / ivory with a champagne accent, no purple. Themes: dark, light, system, true black, six accents plus a custom colour, glass intensity, density, text size, reduced motion, restore defaults.
- One information architecture: floating bottom bar plus a Library page on phones, collapsible sidebar on wide screens. Focus Mode, "My Space" and the old branding text are gone; the logo is a new simple mark.
- Compact bottom-sheet forms (centred dialogs on wide screens), custom dropdowns that are never clipped, inline validation, double-submit protection, delete with Undo and a 30-day trash.
- Home: greeting, daily progress ring, today's tasks, habits, upcoming deadlines, a 7-day activity strip, quick actions.
- Finance: wallet card, month navigation, category donut, budgets, savings goals, filterable history, transaction detail. All figures come from recorded transactions.
- Academics: subject cards, subject detail with assignment/practical slots, attendance and deadlines. Progress only counts configured or tracked work.
- Fitness: overview, history, exercise library and detail with personal records, plans with a session logger, and body measurements kept separate from training.
- Gaming: cover-art library, designed placeholders (no fake artwork), optional cover image from your device, detail with recorded status history.
- Learning (books), Notes and Journal, Goals with milestones, Calendar, Discipline (daily tracker separate from the challenge), Levels and rewards, Insights with date ranges.
- XP: each event pays once ever, a daily cap applies, and level-ups and achievements are celebrated.
- Settings: backup export, validated import with preview, undo of the last import or reset, finance CSV, reset with a typed confirmation.

## Project structure

```
index.html  manifest.json  service-worker.js
assets/      logo and app icons
css/         tokens, base, layout, navigation, components, animations, responsive
css/modules/ per-module styles
js/app.js    boot, shell, recovery screen
js/router.js hash router
js/nav.js    the single navigation list
js/core/     state, events, xp, stats, records, schemas, validation, appearance, utils, icons
js/storage/  storage, migration, backup
js/components/ modal (sheets), dropdown, forms, toast, charts, calendar, celebrate, ui
js/modules/  one file per screen
```

## Data safety

- Storage keys: `evolve_v7_workspace` (V7 data), `evolve_personal_os_v1` (V6, read only).
- If stored data cannot be parsed, Evolve shows a recovery screen and does not overwrite anything until you choose.
- If the browser cannot save (storage full or disabled), a visible banner says so.
- Clearing site data erases everything. Export a backup now and then.

## Tests performed

Run in headless Chromium with Playwright against a local server (the test scripts are not shipped in this ZIP):

- 37 scripted checks, all passing, with no console errors. They cover: launch and all 16 routes, tab and Library navigation, task create/edit/complete/delete/undo, XP paying once and the daily cap, validation errors, double-submit, habits, subjects and assignment numbering with duplicate and out-of-range blocking, progress maths, attendance, transactions and balance maths, budgets (including duplicate blocking), savings goals, finance filters and search, workout logging and plan sessions, game status changes with history, discipline check-in/challenge/correction rules, global search, every appearance setting and persistence across reload, system theme following the OS, backup export, rejection of five kinds of bad backup, valid import, undo import, V6-format import, reset, V6 to V7 migration (V6 key byte-identical afterwards), refresh persistence, corrupted-storage recovery, desktop sidebar, dropdown and focus-trap behaviour.
- Layout sweep at 320, 360, 375, 390, 430, 768, 1024 and 1440 px over 22 screens with realistic data: no horizontal overflow, clipped elements or duplicate IDs.
- Screenshots reviewed at 390 px (several screens) and 1440 px (Finance).

## Known limitations

- Not tested on real phones or iOS Safari. Glass blur, safe areas, the on-screen keyboard and haptics are untested there.
- Not tested with a screen reader. Controls have labels, roles, focus handling and keyboard support, but there was no formal accessibility audit.
- Light theme and tablet layouts had fewer visual checks than dark mobile and desktop.
- Offline mode (service worker) is implemented but was not tested.
- Data is per browser and per address. There is no sync between devices.
- Recurring transactions are labels only; future entries are not posted automatically.
- Savings goals track their own saved amount and do not change the wallet balance.
- Gaming playtime is stored as a total, so it cannot be charted over time.
- Corrections to discipline days update streaks and the calendar but leave a past challenge's recorded outcome unchanged.
- The cover image you pick is downscaled and stored in browser storage, which has a size limit of a few MB.
