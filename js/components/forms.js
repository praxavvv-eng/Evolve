/* Schema-driven forms in a sheet. One builder for every record type, but each form only shows
 * the fields it needs. Handles validation messages, conditional fields, double-submit protection,
 * delete-with-undo and image selection for game covers. */
import * as State from '../core/state.js';
import { schemas } from '../core/schemas.js';
import { saveRecord, removeRecord, restoreTrash } from '../core/records.js';
import { openSheet, confirmDialog } from './modal.js';
import { selectHTML } from './dropdown.js';
import { toast } from './toast.js';
import { esc, currencySymbol, clamp } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { exerciseSummaries } from '../core/stats.js';

let uidn = 0;
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

function subjectOptions(current) {
  const names = ['General', ...State.get().subjects.map(s => s.name)];
  if (current && !names.includes(current)) names.push(current);
  return [...new Set(names)];
}

function nextFreeNo(subject, type) {
  const field = type === 'Practical' ? 'practicalNo' : 'assignmentNo';
  const used = new Set(State.get().academicItems.filter(x => x.type === type && x.subject === subject).map(x => Number(x[field])));
  const sub = State.get().subjects.find(s => s.name === subject);
  const total = Number(type === 'Practical' ? sub?.totalPracticals : sub?.totalAssignments) || 99;
  for (let i = 1; i <= total; i++) if (!used.has(i)) return i;
  return '';
}

function fieldHTML(f, values, fid, errors) {
  const id = `${fid}-${f.name}`, v = values[f.name] ?? '';
  const err = errors[f.name];
  const cls = `field ${f.half ? 'is-half' : ''} ${f.big ? 'field-big' : ''} ${err ? 'has-error' : ''}`;
  const label = f.type === 'segmented' || f.type === 'cover' ? `<span class="field-label">${esc(f.label)}</span>` : `<label for="${id}">${esc(f.label)}${f.required ? ' <span class="req" aria-hidden="true">*</span>' : ''}</label>`;
  let ctl = '';
  switch (f.type) {
    case 'select': {
      const opts = f.options === 'subjects' ? subjectOptions(values.subject) : f.options;
      ctl = selectHTML({ name: f.name, id, value: v, options: opts, label: f.label });
      break;
    }
    case 'segmented': {
      const opts = f.options.map(o => (typeof o === 'object' ? o : { value: o, label: o }));
      ctl = `<div class="seg" role="radiogroup" aria-label="${esc(f.label)}">${opts.map(o => `<label><input type="radio" name="${f.name}" value="${esc(o.value)}" ${String(v) === String(o.value) ? 'checked' : ''}>${esc(o.label)}</label>`).join('')}</div>`;
      break;
    }
    case 'range': {
      const val = clamp(v, f.min, f.max);
      ctl = `<div class="range-row"><input type="range" id="${id}" name="${f.name}" min="${f.min}" max="${f.max}" step="${f.step || 1}" value="${val}" style="--p:${((val - f.min) / (f.max - f.min)) * 100}%"><output for="${id}">${val}${f.suffix || ''}</output></div>`;
      break;
    }
    case 'textarea':
      ctl = `<textarea id="${id}" name="${f.name}" rows="${f.rows || 3}" maxlength="${f.max || 4000}" placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>`;
      break;
    case 'cover':
      ctl = `<div class="cover-pick"><div class="thumb" data-cover-thumb style="${v ? `background-image:url('${esc(v)}')` : ''}">${v ? '' : icon('image', { size: 20 })}</div>
        <div class="stack" style="gap:8px"><label class="btn btn-sm" for="${id}-file">${icon('upload', { size: 16 })} Choose image</label><input class="sr-only" type="file" id="${id}-file" accept="image/*" data-cover-file><button type="button" class="btn btn-sm btn-ghost" data-cover-clear ${v ? '' : 'hidden'}>Remove</button></div>
        <input type="hidden" name="${f.name}" value="${esc(v)}"></div>`;
      break;
    default: {
      const type = f.type === 'number' ? 'number' : f.type;
      const attrs = f.type === 'number' ? `inputmode="decimal" ${f.min !== undefined ? `min="${f.min}"` : ''} ${f.max !== undefined ? `max="${f.max}"` : ''} step="${f.step || 'any'}"` : `maxlength="${f.max || 200}"`;
      const input = `<input id="${id}" name="${f.name}" type="${type}" value="${esc(v)}" placeholder="${esc(f.placeholder || '')}" ${attrs} autocomplete="off" ${err ? 'aria-invalid="true"' : ''}>`;
      ctl = f.prefix ? `<div class="prefix-wrap"><span class="prefix">${esc(currencySymbol())}</span>${input}</div>` : input;
      if (f.suggest === 'exercises') {
        const names = exerciseSummaries(State.get()).slice(0, 6).map(s => s.name);
        if (names.length) ctl += `<div class="suggest" aria-label="Recent exercises">${names.map(n => `<button type="button" data-suggest="${esc(n)}">${esc(n)}</button>`).join('')}</div>`;
      }
    }
  }
  return `<div class="${cls}" data-field="${f.name}" data-key="${f.name}${f.required ? '!' : ''}">${label}${ctl}${f.hint ? `<span class="field-hint">${esc(f.hint)}</span>` : ''}<div class="field-error" role="alert" ${err ? '' : 'hidden'}>${err ? `${icon('alert', { size: 14 })}${esc(err)}` : ''}</div></div>`;
}

export function collect(form) {
  const out = {};
  [...form.elements].forEach(el => {
    if (!el.name || el.disabled) return;
    if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; } else if (el.type === 'checkbox') out[el.name] = el.checked; else out[el.name] = el.value;
  });
  return out;
}

/* ---------- image helpers ---------- */
function readCover(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file is not a usable image.'));
      img.onload = () => {
        const maxW = 420, maxH = 560, k = Math.min(1, maxW / img.width, maxH / img.height);
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.8));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/** Delete with a confirm dialog and an Undo toast (30-day trash in Settings). */
export async function deleteWithUndo(type, id, { onDone, ask = true } = {}) {
  const schema = schemas[type]; const item = State.get()[schema.list].find(x => x.id === id);
  if (!item) return;
  const extra = type === 'subject' ? ' Its assignments, practicals and deadlines are removed with it.' : '';
  if (ask && !await confirmDialog({ title: `Delete this ${schema.label}?`, message: `“${esc(schema.title(item))}” will move to Recently deleted for 30 days.${extra}`, confirmLabel: 'Delete', danger: true })) return;
  const trashId = removeRecord(type, id);
  onDone?.();
  toast(`${cap(schema.label)} deleted`, { action: { label: 'Undo', onClick: () => { restoreTrash(trashId); toast('Restored'); } } });
}

/**
 * Open a create/edit form.
 * @param {string} type schema key
 * @param {{id?:string, prefill?:object, onSaved?:Function, title?:string}} opts
 */
export function openForm(type, { id = '', prefill = {}, onSaved, title } = {}) {
  const schema = schemas[type];
  if (!schema) { console.error('Unknown form type', type); return null; }
  const existing = id ? State.get()[schema.list].find(x => x.id === id) : null;
  if (id && !existing) { toast('That item no longer exists.', { type: 'error' }); return null; }
  const fid = `f${++uidn}`;
  const values = { ...schema.defaults(), ...(existing ? { ...existing, milestones: (existing.milestones || []).join?.('\n') ?? existing.milestones, exercises: Array.isArray(existing.exercises) ? existing.exercises.join('\n') : existing.exercises, tags: Array.isArray(existing.tags) ? existing.tags.join(', ') : existing.tags } : {}), ...prefill };
  if (type === 'academic' && !existing && !values.assignmentNo && !values.practicalNo) {
    const n = nextFreeNo(values.subject, values.type);
    if (values.type === 'Practical') values.practicalNo = n; else values.assignmentNo = n;
  }
  const wide = ['note', 'book'].includes(type);
  const api = openSheet({
    title: title || `${existing ? 'Edit' : 'New'} ${schema.label}`,
    size: wide ? 'wide' : '',
    body: `<form class="form" id="${fid}" novalidate autocomplete="off">${schema.fields.map(f => fieldHTML(f, values, fid, {})).join('')}</form>`,
    footer: `${existing ? `<button class="btn btn-ghost btn-danger" type="button" data-del aria-label="Delete ${esc(schema.label)}">${icon('trash', { size: 18 })}</button>` : `<button class="btn btn-ghost" type="button" data-sheet-close>Cancel</button>`}<button class="btn btn-primary" type="submit" form="${fid}">${existing ? 'Save changes' : 'Add'}</button>`,
    onMount(root) { wire(root); }
  });

  function wire(root) {
    const form = root.querySelector('form');
    const blocks = [...form.querySelectorAll('[data-field]')];
    const defs = schema.fields;

    const syncVisibility = () => {
      const cur = collect(form);
      blocks.forEach((b, i) => {
        const f = defs[i]; const show = !f.when || f.when(cur);
        const wasHidden = b.hidden;
        b.hidden = !show;
        b.querySelectorAll('input,select,textarea').forEach(el => { el.disabled = !show; });
        if (show && wasHidden && cur[f.name] !== undefined) { const el = b.querySelector('input[type=text],textarea'); if (el) el.value = cur[f.name]; }   // carry typed text between same-named fields
      });
    };
    syncVisibility();

    const autoNumber = () => {
      if (type !== 'academic' || existing) return;
      const cur = collect(form), field = cur.type === 'Practical' ? 'practicalNo' : 'assignmentNo';
      const el = form.elements[field]; if (el && !el.dataset.touched) el.value = nextFreeNo(cur.subject, cur.type);
    };
    form.addEventListener('input', e => {
      if (e.target.name === 'assignmentNo' || e.target.name === 'practicalNo') e.target.dataset.touched = '1';
      if (e.target.type === 'range') {
        const f = defs.find(d => d.name === e.target.name);
        e.target.style.setProperty('--p', `${((e.target.value - f.min) / (f.max - f.min)) * 100}%`);
        const out = e.target.parentElement.querySelector('output'); if (out) out.textContent = `${e.target.value}${f.suffix || ''}`;
      }
      const blk = e.target.closest('[data-field]');
      if (blk?.classList.contains('has-error')) { blk.classList.remove('has-error'); const er = blk.querySelector('.field-error'); er.hidden = true; }
    });
    form.addEventListener('change', e => {
      if (['type', 'status', 'subject'].includes(e.target.name)) { syncVisibility(); if (e.target.name !== 'status') autoNumber(); }
    });
    form.addEventListener('click', e => {
      const s = e.target.closest('[data-suggest]');
      if (s) { form.elements.exercise.value = s.dataset.suggest; form.elements.exercise.focus(); }
      if (e.target.closest('[data-cover-clear]')) { form.elements.cover.value = ''; const t = form.querySelector('[data-cover-thumb]'); t.style.backgroundImage = ''; t.innerHTML = icon('image', { size: 20 }); e.target.closest('[data-cover-clear]').hidden = true; }
    });
    form.querySelector('[data-cover-file]')?.addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return;
      try {
        const data = await readCover(file);
        form.elements.cover.value = data;
        const t = form.querySelector('[data-cover-thumb]'); t.style.backgroundImage = `url('${data}')`; t.innerHTML = '';
        form.querySelector('[data-cover-clear]').hidden = false;
      } catch (err) { toast(err.message, { type: 'error' }); }
    });

    form.addEventListener('submit', e => {
      e.preventDefault();
      if (form.dataset.busy) return;                       // blocks double taps and Enter-spam
      form.dataset.busy = '1';
      const btn = root.querySelector('button[type=submit]'); btn.classList.add('is-busy');
      const res = saveRecord(type, collect(form), existing?.id || '');
      if (!res.ok) {
        delete form.dataset.busy; btn.classList.remove('is-busy');
        blocks.forEach(b => { b.classList.remove('has-error'); const er = b.querySelector('.field-error'); er.hidden = true; });
        let first = null;
        Object.entries(res.errors).forEach(([name, msg]) => {
          const b = blocks.find(x => x.dataset.field === name && !x.hidden); if (!b) return;
          b.classList.add('has-error'); const er = b.querySelector('.field-error'); er.hidden = false; er.innerHTML = `${icon('alert', { size: 14 })}${esc(msg)}`;
          first ||= b;
        });
        const target = first?.querySelector('input:not([type=hidden]),textarea,button.dd-trigger'); target?.focus({ preventScroll: false }); first?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
      }
      api.close();
      toast(`${cap(schema.label)} ${res.created ? 'added' : 'saved'}`, { xp: res.xp });
      if (res.saved === false) toast('Saved on screen only: storage is full or unavailable.', { type: 'error' });
      onSaved?.(res.record, res);
    });

    root.querySelector('[data-del]')?.addEventListener('click', () => deleteWithUndo(type, existing.id, { onDone: () => { api.close(); onSaved?.(null, { deleted: true }); } }));
  }
  return api;
}

