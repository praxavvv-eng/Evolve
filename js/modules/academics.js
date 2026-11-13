/* Academics: subject overview, per-subject detail (assignments, practicals, attendance, deadlines).
 * All progress maths lives in core/stats.js (subjectStats): only configured or tracked work counts as work. */
import * as State from '../core/state.js';
import { registerActions } from '../core/events.js';
import { setAcademicProgress, markAttendance } from '../core/records.js';
import { esc, todayStr, relDay, num, isDateStr, plural, fmtTime } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { subjectStats, academicOverview } from '../core/stats.js';
import { ring, progressBar } from '../components/charts.js';
import { pageHead, emptyState, addBtn, kebab, sectionHead } from '../components/ui.js';
import { toast } from '../components/toast.js';

const pctText = v => `${Math.round(v)}%`;

function itemRow(x, { showSubject = true } = {}) {
  const done = x.status === 'Completed', overdue = !done && isDateStr(x.due) && x.due < todayStr();
  const tag = x.type === 'Assignment' && x.assignmentNo ? `Assignment ${x.assignmentNo}` : x.type === 'Practical' && x.practicalNo ? `Practical ${x.practicalNo}` : x.type;
  return `<div class="row">
    <button type="button" class="check-wrap" data-action="ac-complete" data-id="${esc(x.id)}" role="checkbox" aria-checked="${done}" aria-label="${done ? 'Mark as not completed' : 'Mark as completed'}: ${esc(x.title)}"><span class="check ${done ? 'is-on' : ''}">${icon('check', { size: 16 })}</span></button>
    <button type="button" class="row-main" data-action="form" data-type="academic" data-id="${esc(x.id)}"><span class="row-title trunc">${esc(x.title)}</span>
      <span class="row-sub trunc ${overdue ? 'neg' : ''}">${esc([showSubject ? x.subject : '', tag, x.due ? `${relDay(x.due, { done })}${x.dueTime ? `, ${fmtTime(x.dueTime)}` : ''}` : 'No date'].filter(Boolean).join(' · '))}</span>
      ${!done && num(x.progress) > 0 ? progressBar(x.progress) : ''}</button>
    <span class="row-end">${kebab('academic', x.id)}</span></div>`;
}

/* ---------------- overview ---------------- */
function renderOverview() {
  const s = State.get(), ov = academicOverview(s), today = todayStr();
  const head = pageHead({ title: 'Academics', sub: s.subjects.length ? plural(s.subjects.length, 'subject') : 'Subjects, work and attendance', actions: `${addBtn('subject', 'Subject', { cls: 'btn btn-sm' })}${addBtn('academic', 'Work')}` });
  if (!s.subjects.length && !s.academicItems.length) return `${head}<div class="card" style="--i:1">${emptyState({ icon: 'graduation', title: 'Set up your first subject', text: 'Add a subject with its number of assignments and practicals, then track work against it.', action: addBtn('subject', 'Add a subject') })}</div>`;
  const dueSoon = ov.upcoming.filter(x => x.due <= `${new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10)}`).length;
  const overdue = ov.pending.filter(x => isDateStr(x.due) && x.due < today).length;
  const card = ({ subject: sub, ...st }) => `<a class="card sub-card lift" href="#/academics/subject/${esc(sub.id)}">
    <div class="between"><div style="min-width:0"><p class="t-micro">${esc(sub.code || 'Subject')}</p><h3 class="t-h2 trunc">${esc(sub.name)}</h3></div>${ring({ value: st.progress, size: 56, stroke: 6, label: pctText(st.progress), title: `${sub.name} progress ${pctText(st.progress)}` })}</div>
    ${progressBar(st.progress, '', { pct: true })}
    <div class="sub-meta"><span><b>${st.assignments.done}/${st.assignments.total}</b> assignments</span>${st.practicals.total ? `<span><b>${st.practicals.done}/${st.practicals.total}</b> practicals</span>` : ''}<span><b>${st.attendance.rate === null ? '–' : pctText(st.attendance.rate)}</b> attendance</span></div>
    ${st.pending.length ? `<p class="t-small">${plural(st.pending.length, 'item')} pending</p>` : `<p class="t-small pos">${st.items.length ? 'All caught up' : 'No work added yet'}</p>`}</a>`;
  return `${head}<div class="stack-lg">
    <section class="card card-pad ac-hero" style="--i:1">${ring({ value: ov.progress, size: 104, stroke: 10, label: pctText(ov.progress), sub: 'overall' })}
      <div class="ac-hero-stats"><div class="stat"><b>${ov.pending.length}</b><span>Pending</span></div><div class="stat"><b class="${overdue ? 'neg' : ''}">${overdue}</b><span>Overdue</span></div><div class="stat"><b>${dueSoon}</b><span>Due in 7 days</span></div><div class="stat"><b>${ov.completed}</b><span>Completed</span></div></div></section>
    ${ov.subs.length ? `<section style="--i:2">${sectionHead('Subjects')}<div class="grid auto-grid">${ov.subs.map(card).join('')}</div></section>` : ''}
    ${ov.upcoming.length ? `<section class="card card-flush" style="--i:3"><div class="panel-head"><div><h2>Deadlines</h2><p>Pending work, soonest first</p></div></div><div class="list">${ov.upcoming.slice(0, 6).map(x => itemRow(x)).join('')}</div></section>` : ''}
    ${ov.loose.length ? `<section class="card card-flush" style="--i:4"><div class="panel-head"><div><h2>General</h2><p>Work without a subject</p></div></div><div class="list">${ov.loose.map(x => itemRow(x, { showSubject: false })).join('')}</div></section>` : ''}</div>`;
}

/* ---------------- subject detail ---------------- */
function slotGrid(st, sub, type, noField) {
  if (!st.slots.length) return `<p class="t-body">${type === 'Practical' ? 'No practicals configured for this subject.' : 'No assignments configured.'} ${addBtn('subject', 'Edit subject', { cls: 'link-btn', id: sub.id })}</p>`;
  return `<div class="slots">${st.slots.map(({ no, item }) => {
    const done = item && (item.status === 'Completed' || num(item.progress) >= 100), part = item && !done;
    const attrs = item ? `data-id="${esc(item.id)}"` : `data-prefill="${esc(JSON.stringify({ subject: sub.name, type, [noField]: no }))}"`;
    return `<button type="button" class="slot ${done ? 'is-done' : part ? 'is-part' : ''}" data-action="form" data-type="academic" ${attrs} aria-label="${type} ${no}: ${done ? 'completed' : part ? `${item.progress}% done` : 'not added'}" title="${item ? esc(item.title) : `Add ${type.toLowerCase()} ${no}`}"><b>${no}</b><small>${done ? icon('check', { size: 14 }) : part ? `${num(item.progress)}%` : icon('plus', { size: 14 })}</small></button>`;
  }).join('')}</div>`;
}

function renderSubject(id) {
  const s = State.get(), sub = s.subjects.find(x => x.id === id);
  if (!sub) return `<div class="card">${emptyState({ icon: 'graduation', title: 'Subject not found', text: 'It may have been deleted.', action: '<a class="btn btn-primary" href="#/academics">Back to Academics</a>' })}</div>`;
  const st = subjectStats(s, sub), today = todayStr();
  const att = st.attendance;
  const pending = st.pending.filter(x => isDateStr(x.due)).sort((a, b) => a.due.localeCompare(b.due) || (a.dueTime || '').localeCompare(b.dueTime || ''));
  const completed = st.items.filter(x => !st.pending.includes(x));
  return `<header class="page-head"><div style="min-width:0"><p class="eyebrow">${esc(sub.code || 'Subject')}</p><h1 class="t-title trunc">${esc(sub.name)}</h1></div>
      <div class="page-head-actions">${addBtn('subject', 'Edit', { cls: 'btn btn-sm', id: sub.id })}${addBtn('academic', 'Work', { prefill: { subject: sub.name } })}</div></header>
    <div class="stack-lg">
      <section class="card card-pad ac-hero" style="--i:1">${ring({ value: st.progress, size: 112, stroke: 10, label: pctText(st.progress), sub: 'progress' })}
        <div class="ac-hero-stats"><div class="stat"><b>${st.assignments.done}/${st.assignments.total}</b><span>Assignments</span></div><div class="stat"><b>${st.practicals.total ? `${st.practicals.done}/${st.practicals.total}` : '–'}</b><span>Practicals</span></div><div class="stat"><b>${att.rate === null ? '–' : pctText(att.rate)}</b><span>Attendance</span></div><div class="stat"><b>${st.pending.length}</b><span>Pending</span></div></div></section>

      <section class="card card-pad" style="--i:2"><div class="between"><h2 class="t-h2">Assignments</h2><span class="t-small t-num">${st.assignments.done} of ${st.assignments.total} done</span></div><div class="mt-3">${progressBar(st.assignments.progress, '', { pct: true })}</div><div class="mt-4">${slotGrid(st.assignments, sub, 'Assignment', 'assignmentNo')}</div></section>
      ${st.practicals.slots.length || sub.totalPracticals ? `<section class="card card-pad" style="--i:3"><div class="between"><h2 class="t-h2">Practicals</h2><span class="t-small t-num">${st.practicals.done} of ${st.practicals.total} done</span></div><div class="mt-3">${progressBar(st.practicals.progress, '', { pct: true })}</div><div class="mt-4">${slotGrid(st.practicals, sub, 'Practical', 'practicalNo')}</div></section>` : ''}

      <section class="card card-pad" style="--i:4"><div class="between"><h2 class="t-h2">Attendance</h2><span class="t-small t-num">${att.attended} of ${att.held} classes</span></div>
        ${att.held ? `<div class="mt-3">${progressBar(att.rate, '', { pct: true })}</div><p class="t-small mt-2">attended</p>` : '<p class="t-body mt-2">No classes recorded yet.</p>'}
        <div class="attend-actions mt-4"><button class="btn btn-soft" type="button" data-action="attend" data-id="${esc(sub.id)}" data-kind="present">${icon('check', { size: 18 })} Present</button><button class="btn" type="button" data-action="attend" data-id="${esc(sub.id)}" data-kind="absent">${icon('x', { size: 18 })} Absent</button></div>
        ${att.held ? `<div class="row-gap mt-3"><button class="link-btn" type="button" data-action="attend" data-id="${esc(sub.id)}" data-kind="undo-present">Undo a present</button><button class="link-btn" type="button" data-action="attend" data-id="${esc(sub.id)}" data-kind="undo-absent">Undo an absent</button></div>` : ''}</section>

      ${pending.length ? `<section class="card card-flush" style="--i:5"><div class="panel-head"><div><h2>Upcoming deadlines</h2></div></div><div class="list">${pending.map(x => itemRow(x, { showSubject: false })).join('')}</div></section>` : ''}
      ${st.other.length ? `<section class="card card-flush" style="--i:6"><div class="panel-head"><div><h2>Exams and projects</h2></div></div><div class="list">${st.other.map(x => itemRow(x, { showSubject: false })).join('')}</div></section>` : ''}
      ${completed.length ? `<section class="card card-flush" style="--i:7"><div class="panel-head"><div><h2>Completed</h2><p>${completed.length} items</p></div></div><div class="list">${completed.slice(0, 20).map(x => itemRow(x, { showSubject: false })).join('')}</div></section>` : ''}
      <div style="--i:8"><button class="btn btn-danger" type="button" data-action="delete" data-type="subject" data-id="${esc(sub.id)}" data-back="#/academics">${icon('trash', { size: 18 })} Delete subject</button></div>
    </div>`;
}

registerActions({
  'ac-complete'(el) {
    const x = State.get().academicItems.find(i => i.id === el.dataset.id); if (!x) return;
    const completing = x.status !== 'Completed';
    setAcademicProgress(x.id, completing ? 100 : 0);
    if (completing) toast('Marked complete', { xp: State.get().rewardEvents[`academic:${x.id}`]?.points || 0 });
  },
  attend(el) { markAttendance(el.dataset.id, el.dataset.kind); }
});

export const route = {
  id: 'academics',
  render: parts => (parts[0] === 'subject' && parts[1] ? renderSubject(parts[1]) : renderOverview()),
  title: parts => (parts[0] === 'subject' ? State.get().subjects.find(x => x.id === parts[1])?.name || 'Subject' : 'Academics')
};
