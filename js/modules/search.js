/* Global search (Ctrl/Cmd+K or the search button) and the Quick add sheet. */
import * as State from '../core/state.js';
import { esc, money, fmtDate } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { NAV } from '../nav.js';
import { openSheet } from '../components/modal.js';
import { openForm } from '../components/forms.js';
import { norm } from '../core/stats.js';

const go = hash => { location.hash = hash; };

function buildIndex() {
  const s = State.get(), out = [];
  const add = (group, ic, title, sub, hay, run) => out.push({ group, ic, title: String(title || ''), sub, hay: `${title} ${hay || ''}`.toLowerCase(), run });
  s.tasks.forEach(t => add('Tasks', 'check-square', t.title, `${t.done ? 'Done' : 'Open'}${t.due ? ` · due ${fmtDate(t.due)}${t.dueTime ? ` ${t.dueTime}` : ''}` : ''}`, `${t.notes} ${t.category}`, () => openForm('task', { id: t.id })));
  s.habits.forEach(h => add('Habits', 'repeat', h.name, h.schedule, '', () => go(`#/habits/${h.id}`)));
  s.subjects.forEach(x => add('Academics', 'graduation', x.name, 'Subject', x.code, () => go(`#/academics/subject/${x.id}`)));
  s.academicItems.forEach(x => add('Academics', 'graduation', x.title, `${x.subject} · ${x.type}`, x.details, () => openForm('academic', { id: x.id })));
  s.workoutLogs.forEach(w => add('Fitness', 'dumbbell', w.exercise, `${fmtDate(w.date)} · ${w.sets}×${w.reps}`, w.notes, () => go(`#/fitness/exercise/${encodeURIComponent(norm(w.exercise))}`)));
  s.transactions.forEach(t => add('Finance', 'receipt', t.note || t.category, `${money(t.amount)} · ${t.category} · ${fmtDate(t.date)}`, `${t.category} ${t.type}`, () => go(`#/finance/tx/${t.id}`)));
  s.budgets.forEach(b => add('Finance', 'wallet', `${b.category} budget`, b.month, '', () => go('#/finance')));
  s.savingsGoals.forEach(g => add('Finance', 'piggy', g.name, 'Savings goal', '', () => go('#/finance')));
  s.games.forEach(g => add('Gaming', 'gamepad', g.title, `${g.platform} · ${g.status}`, g.notes, () => go(`#/gaming/${g.id}`)));
  s.books.forEach(b => add('Learning', 'book', b.title, b.author || b.status, b.notes, () => go(`#/learning/${b.id}`)));
  s.notes.forEach(n => add('Notes', 'notebook', n.title, `${n.kind} · ${fmtDate(n.date)}`, `${n.body} ${(n.tags || []).join(' ')}`, () => go(`#/journal/${n.id}`)));
  s.events.forEach(e => add('Calendar', 'calendar', e.title, `${fmtDate(e.date)} · ${e.startTime}`, e.notes, () => openForm('event', { id: e.id })));
  s.challenges.forEach(c => add('Discipline', 'shield', c.name, `${c.targetDays}-day challenge`, c.reward, () => go(`#/discipline/${c.id}`)));
  s.goals.forEach(g => add('Goals', 'target', g.title, `${g.status} · ${g.progress}%`, g.milestones?.join(' '), () => openForm('goal', { id: g.id })));
  NAV.forEach(n => add('Go to', n.icon, n.label, n.blurb, n.id, () => go(`#/${n.id}`)));
  return out;
}

function score(item, tokens) {
  const title = item.title.toLowerCase();
  let sc = 0;
  for (const t of tokens) {
    if (!item.hay.includes(t)) return 0;
    sc += title.startsWith(t) ? 5 : title.split(/\s+/).some(w => w.startsWith(t)) ? 3 : title.includes(t) ? 2 : 1;
  }
  return sc;
}
const mark = (text, tokens) => { let out = esc(text); tokens.forEach(t => { if (t) out = out.replace(new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'), '<mark>$1</mark>'); }); return out; };

export function openSearch() {
  const index = buildIndex();
  let results = [], active = 0, only = '';
  const groups = [...new Set(index.map(i => i.group))].filter(g => g !== 'Go to');
  const api = openSheet({ bare: true, overlayClass: 'is-search', dismissable: true,
    body: `<div class="palette" role="dialog" aria-modal="true" aria-label="Search"><div class="palette-input">${icon('search', { size: 20 })}<input type="search" id="pal-q" placeholder="Search everything…" autocomplete="off" spellcheck="false" aria-label="Search" aria-controls="pal-list"><button class="icon-btn" type="button" data-sheet-close aria-label="Close search">${icon('x', { size: 18 })}</button></div><div class="pal-filters" id="pal-filters" role="group" aria-label="Filter results"></div><div class="palette-results" id="pal-list" role="listbox"></div></div>` });
  const input = api.el.querySelector('#pal-q'), list = api.el.querySelector('#pal-list'), filters = api.el.querySelector('#pal-filters');
  const drawFilters = () => { filters.innerHTML = ['', ...groups].map(g => `<button type="button" class="chip ${only === g ? 'is-on' : ''}" data-g="${esc(g)}" aria-pressed="${only === g}">${g || 'All'}</button>`).join(''); filters.hidden = !input.value.trim(); };

  function draw() {
    const q = input.value.trim().toLowerCase(), tokens = q.split(/\s+/).filter(Boolean);
    results = tokens.length ? index.filter(i => !only || i.group === only).map(i => ({ i, sc: score(i, tokens) })).filter(x => x.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, 30).map(x => x.i) : index.filter(i => i.group === 'Go to');
    active = 0; drawFilters();
    if (!results.length) { list.innerHTML = `<div class="pal-empty">No matches for “${esc(input.value.trim())}”.<br>Try a title, a category or part of a note.</div>`; return; }
    let last = '';
    list.innerHTML = results.map((r, k) => `${r.group !== last ? `<div class="pal-group">${(last = r.group, esc(tokens.length ? r.group : 'Jump to'))}</div>` : ''}<button type="button" class="pal-item ${k === 0 ? 'is-active' : ''}" role="option" data-k="${k}" aria-selected="${k === 0}"><span class="row-lead">${icon(r.ic, { size: 16 })}</span><span class="row-main"><span class="row-title trunc">${mark(r.title, tokens)}</span><span class="row-sub trunc">${esc(r.sub || '')}</span></span></button>`).join('');
  }
  const mv = d => { const items = [...list.querySelectorAll('.pal-item')]; if (!items.length) return; items[active]?.classList.remove('is-active'); active = (active + d + items.length) % items.length; items[active].classList.add('is-active'); items[active].setAttribute('aria-selected', 'true'); items[active].scrollIntoView({ block: 'nearest' }); };
  const run = k => { const r = results[k]; if (!r) return; api.close(); setTimeout(() => r.run(), 40); };
  let timer; input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(draw, 70); });   // keep typing instant on large workspaces
  input.addEventListener('keydown', e => { if (e.key === 'ArrowDown') { e.preventDefault(); mv(1); } else if (e.key === 'ArrowUp') { e.preventDefault(); mv(-1); } else if (e.key === 'Enter') { e.preventDefault(); run(active); } });
  filters.addEventListener('click', e => { const b = e.target.closest('[data-g]'); if (!b) return; only = b.dataset.g; draw(); input.focus(); });
  list.addEventListener('click', e => { const b = e.target.closest('.pal-item'); if (b) run(Number(b.dataset.k)); });
  draw(); setTimeout(() => input.focus(), 30);
}

/* ---------------- quick add ---------------- */
/* Grouped by intent. Expense and Income open the amount-first form with the right type already chosen. */
const GROUPS = [
  ['Plan', [['task', 'Task', 'check-square', {}, 'Something to do'], ['event', 'Event', 'calendar', {}, 'On the calendar'], ['goal', 'Goal', 'target', {}, 'With a deadline']]],
  ['Growth', [['habit', 'Habit', 'repeat', {}, 'Build a streak'], ['challenge', 'Challenge', 'shield', {}, 'Stay disciplined']]],
  ['Life', [['transaction', 'Expense', 'arrow-up-right', { type: 'expense' }, 'Money out'], ['transaction', 'Income', 'arrow-down-left', { type: 'income' }, 'Money in'], ['workout', 'Workout', 'dumbbell', {}, 'Sets and reps'], ['academic', 'Study item', 'graduation', {}, 'Assignment or exam'], ['subject', 'Subject', 'graduation', {}, 'Add a course']]],
  ['Library', [['note', 'Note', 'notebook', {}, 'Write something'], ['book', 'Book', 'book', {}, 'Track reading'], ['game', 'Game', 'gamepad', {}, 'Track playtime']]]
];

export function openQuickAdd() {
  const tile = ([type, label, ic, prefill, sub], k) => `<button type="button" class="quick-item" data-k="${k}"><span class="row-lead">${icon(ic, { size: 18 })}</span><span>${esc(label)}<small>${esc(sub)}</small></span></button>`;
  const flat = []; 
  const body = GROUPS.map(([name, items]) => `<div class="qa-group"><span class="t-micro">${name}</span><div class="quick-grid">${items.map(it => { flat.push(it); return tile(it, flat.length - 1); }).join('')}</div></div>`).join('');
  const api = openSheet({ title: 'Quick add', size: 'narrow', body });
  api.el.addEventListener('click', e => {
    const t = e.target.closest('[data-k]'); if (!t) return;
    const [type, , , prefill] = flat[Number(t.dataset.k)];
    api.close(); setTimeout(() => openForm(type, { prefill }), 120);
  });
}
