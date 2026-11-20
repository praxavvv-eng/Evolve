/* Schema-driven forms in a sheet. One builder for every record type, but each form only shows
 * the fields it needs. Handles validation messages, conditional fields, double-submit protection,
 * delete-with-undo and image selection for game covers. */
import * as State from '../core/state.js';
import { schemas, CAT_ICONS, OPTIONS, WEEKDAYS } from '../core/schemas.js';
import { saveRecord, removeRecord, restoreTrash } from '../core/records.js';
import { openSheet, confirmDialog } from './modal.js';
import { selectHTML } from './dropdown.js';
import { toast } from './toast.js';
import { esc, currencySymbol, clamp, addDays, todayStr } from '../core/utils.js';
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

const GROUPED = ['segmented', 'cover', 'colors', 'pills', 'weekdays', 'categories', 'txtype'];
function catList(type, current) {
  const list = [...(type === 'income' ? OPTIONS.incomeCategory : OPTIONS.expenseCategory)];
  if (current && !list.includes(current)) list.push(current);          // never hide the category of an existing record
  return list;
}
function catGrid(name, list, value, fid) {
  return list.map(c => `<label class="cat-opt"><input type="radio" name="${name}" value="${esc(c)}" ${c === value ? 'checked' : ''}><span>${icon(CAT_ICONS[c] || 'tag', { size: 22 })}${esc(c)}</span></label>`).join('');
}
const quickSets = { true: [['Today', 0], ['Tomorrow', 1], ['+1 week', 7]], past: [['Today', 0], ['Yesterday', -1]], finance: [['Today', 0], ['Yesterday', -1]] };

function fieldHTML(f, values, fid, errors) {
  const id = `${fid}-${f.name}`, v = values[f.name] ?? '';
  const err = errors[f.name];
  const cls = `field ${f.half ? 'is-half' : ''} ${f.big ? 'field-big' : ''} ${f.cls || ''} ${err ? 'has-error' : ''}`;
  const labelText = GROUPED.includes(f.type) ? `<span class="field-label ${f.hideLabel ? 'sr-only' : ''}">${esc(f.label)}</span>` : `<label for="${id}" class="${f.hideLabel ? 'sr-only' : ''}">${esc(f.label)}${f.required ? ' <span class="req" aria-hidden="true">*</span>' : ''}</label>`;
  const label = f.type === 'amount' || f.type === 'txtype' ? '' : f.clearable ? `<div class="label-row">${labelText}<button type="button" class="mini-link" data-clear="${f.name}" ${v ? '' : 'hidden'}>Clear</button></div>` : labelText;
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
    case 'colors':
      ctl = `<div class="color-pick" role="radiogroup" aria-label="${esc(f.label)}">${f.options.map(o => `<label class="color-opt" title="${esc(o.name)}" style="--c:${o.hex}"><input type="radio" name="${f.name}" value="${o.hex}" ${String(v).toLowerCase() === o.hex ? 'checked' : ''} aria-label="${esc(o.name)}"><span>${icon('check', { size: 16 })}</span></label>`).join('')}</div>`;
      break;
    case 'range': {
      const val = clamp(v, f.min, f.max);
      ctl = `<div class="range-row"><input type="range" id="${id}" name="${f.name}" min="${f.min}" max="${f.max}" step="${f.step || 1}" value="${val}" style="--p:${((val - f.min) / (f.max - f.min)) * 100}%"><output for="${id}">${val}${f.suffix || ''}</output></div>`;
      break;
    }
    case 'textarea':
      ctl = `<textarea id="${id}" name="${f.name}" rows="${f.rows || 3}" maxlength="${f.max || 4000}" placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>`;
      break;
    case 'pills':
      ctl = `<div class="pill-seg" role="radiogroup" aria-label="${esc(f.label)}">${f.options.map(o => `<label style="--pc:${o.color || 'var(--accent)'}"><input type="radio" name="${f.name}" value="${esc(o.value)}" ${String(v) === String(o.value) ? 'checked' : ''}><span>${esc(o.label)}</span></label>`).join('')}</div>`;
      break;
    case 'weekdays': {
      const sel = (Array.isArray(v) && v.length ? v : [1, 2, 3, 4, 5, 6, 0]).map(Number);
      ctl = `<div class="weekdays" role="group" aria-label="${esc(f.label)}">${WEEKDAYS.map(d => `<label class="wd-opt" title="${d.n}"><input type="checkbox" data-multi name="${f.name}" value="${d.v}" ${sel.includes(d.v) ? 'checked' : ''} aria-label="${d.n}"><span aria-hidden="true">${d.l}</span></label>`).join('')}</div>`;
      break;
    }
    case 'stepper':
      ctl = `<div class="stepper"><button type="button" data-step="-1" aria-label="Decrease ${esc(f.label)}">${icon('minus', { size: 18 })}</button><input id="${id}" name="${f.name}" type="number" inputmode="decimal" value="${esc(v)}" min="${f.min ?? ''}" max="${f.max ?? ''}" step="${f.step || 1}" data-step-size="${f.step || 1}" autocomplete="off"><button type="button" data-step="1" aria-label="Increase ${esc(f.label)}">${icon('plus', { size: 18 })}</button></div>`;
      break;
    case 'txtype':
      ctl = `<div class="type-seg" role="radiogroup" aria-label="Transaction type">${f.options.map(o => `<label><input type="radio" name="${f.name}" value="${esc(o.value)}" ${String(v) === String(o.value) ? 'checked' : ''}>${icon(o.value === 'income' ? 'arrow-down-left' : 'arrow-up-right', { size: 18 })}${esc(o.label)}</label>`).join('')}</div>`;
      break;
    case 'amount':
      ctl = `<div class="amount-hero"><label class="ah-label" for="${id}">${esc(f.label)}</label><div class="amount-line ${values.type === 'income' ? 'is-income' : ''}"><span class="sym" aria-hidden="true">${esc(currencySymbol())}</span><input id="${id}" name="${f.name}" type="number" inputmode="decimal" min="0" step="any" value="${esc(v)}" placeholder="0" autocomplete="off" ${err ? 'aria-invalid="true"' : ''} data-amount></div></div>`;
      break;
    case 'categories':
      ctl = `<div class="cat-grid" role="radiogroup" aria-label="${esc(f.label)}" data-cats>${catGrid(f.name, catList(values.type, v), v, fid)}</div>`;
      break;
    case 'cover':
      ctl = `<div class="cover-pick"><div class="thumb ${f.poster ? 'is-poster' : ''}" data-cover-thumb style="${v ? `background-image:url('${esc(v)}')` : ''}">${v ? '' : icon('image', { size: 20 })}</div>
        <div class="cover-actions"><label class="btn btn-sm" for="${id}-file">${icon('upload', { size: 16 })} Choose image</label><input class="sr-only" type="file" id="${id}-file" accept="image/*" data-cover-file><button type="button" class="btn btn-sm btn-ghost" data-cover-clear ${v ? '' : 'hidden'}>Remove</button></div>
        <input type="hidden" name="${f.name}" value="${esc(v)}"></div>`;
      break;
    default: {
      const type = f.type === 'number' ? 'number' : f.type;
      const attrs = f.type === 'number' ? `inputmode="decimal" ${f.min !== undefined ? `min="${f.min}"` : ''} ${f.max !== undefined ? `max="${f.max}"` : ''} step="${f.step || 'any'}"` : `maxlength="${f.max || 200}"`;
      const input = `<input id="${id}" name="${f.name}" type="${type}" value="${esc(v)}" placeholder="${esc(f.placeholder || '')}" ${attrs} autocomplete="off" ${err ? 'aria-invalid="true"' : ''}>`;
      ctl = f.prefix ? `<div class="amount-wrap"><span class="amount-sym" aria-hidden="true">${esc(currencySymbol())}</span>${input}</div>` : input;
      if (f.presets) ctl += `<div class="suggest quick-presets" aria-label="Presets">${f.presets.map(n => `<button type="button" data-preset="${n}">${n}</button>`).join('')}</div>`;
      if (f.quick) ctl += `<div class="suggest quick-dates" aria-label="Quick dates">${(quickSets[f.quick] || quickSets.true).map(([l, n]) => `<button type="button" data-quick="${n}" class="${v && v === addDays(todayStr(), n) ? 'is-on' : ''}">${l}</button>`).join('')}</div>`;
      if (f.suggest === 'exercises') {
        const names = exerciseSummaries(State.get()).slice(0, 6).map(s => s.name);
        if (names.length) ctl += `<div class="suggest" aria-label="Recent exercises">${names.map(n => `<button type="button" data-suggest="${esc(n)}">${esc(n)}</button>`).join('')}</div>`;
      }
    }
  }
  return `<div class="${cls}" data-field="${f.name}" data-key="${f.name}${f.required ? '!' : ''}" ${f.when && !f.when(values) ? 'hidden' : ''}>${label}${ctl}${f.hint ? `<span class="field-hint">${esc(f.hint)}</span>` : ''}<div class="field-error" role="alert" ${err ? '' : 'hidden'}>${err ? `${icon('alert', { size: 14 })}${esc(err)}` : ''}</div></div>`;
}

export function collect(form) {
  const out = {};
  [...form.elements].forEach(el => {
    if (!el.name || el.disabled) return;
    if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
    else if (el.type === 'checkbox' && el.dataset.multi !== undefined) { (out[el.name] ||= []); if (el.checked) out[el.name].push(el.value); }
    else if (el.type === 'checkbox') out[el.name] = el.checked;
    else out[el.name] = el.value;
  });
  return out;
}

/* ---------- image helpers ---------- */
/** Poster pipeline: centre-crop to 3:4, step-down scaling for sharp results, JPEG sized to stay practical for storage and cloud sync. */
function readCover(file, R = 3 / 4) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file is not a usable image.'));
      img.onload = () => {
        let cw = img.width, ch = cw / R;
        if (ch > img.height) { ch = img.height; cw = ch * R; }
        const sx = (img.width - cw) / 2, sy = (img.height - ch) / 2;
        const outW = Math.min(600, Math.round(cw)), outH = Math.round(outW / R);
        const make = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; return [c, x]; };
        let [cur, cx] = make(Math.round(cw), Math.round(ch));
        cx.drawImage(img, sx, sy, cw, ch, 0, 0, cur.width, cur.height);
        while (cur.width / 2 >= outW) {                       // halve repeatedly: much sharper than one big jump
          const [next, nx] = make(Math.floor(cur.width / 2), Math.floor(cur.height / 2));
          nx.drawImage(cur, 0, 0, next.width, next.height); cur = next;
        }
        const [out, ox] = make(outW, outH);
        ox.fillStyle = '#000'; ox.fillRect(0, 0, outW, outH);
        ox.drawImage(cur, 0, 0, outW, outH);
        let q = 0.88, data = out.toDataURL('image/jpeg', q);
        while (data.length > 190000 && q > 0.66) { q -= 0.06; data = out.toDataURL('image/jpeg', q); }
        resolve(data);
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
  const cfg = schema.form || {}, layout = cfg.layout || '';
  const more = schema.fields.filter(f => f.more), main = schema.fields.filter(f => !f.more);
  const moreHTML = more.length ? `<details class="form-more" ${existing ? 'open' : ''}><summary>More options ${icon('chevron-down', { size: 18 })}</summary><div class="form-more-body form">${more.map(f => fieldHTML(f, values, fid, {})).join('')}</div></details>` : '';
  const api = openSheet({
    title: title || (existing ? (cfg.edit || `Edit ${schema.label}`) : (cfg.create || `New ${schema.label}`)),
    size: cfg.size || '',
    body: `<form class="form ${layout ? `is-${layout}` : ''}" id="${fid}" novalidate autocomplete="off">${main.map(f => fieldHTML(f, values, fid, {})).join('')}${moreHTML}</form>`,
    footer: `${existing ? `<button class="btn btn-ghost btn-danger" type="button" data-del aria-label="Delete ${esc(schema.label)}">${icon('trash', { size: 18 })}</button><button class="btn btn-ghost" type="button" data-sheet-close>Cancel</button>` : `<button class="btn btn-ghost" type="button" data-sheet-close>Cancel</button>`}<button class="btn btn-primary" type="submit" form="${fid}">${existing ? 'Save changes' : (cfg.submit || 'Add')}</button>`,
    onMount(root) { wire(root); }
  });

  function wire(root) {
    const form = root.querySelector('form');
    const blocks = [...form.querySelectorAll('[data-field]')];
    const defs = [...schema.fields.filter(f => !f.more), ...schema.fields.filter(f => f.more)];   // DOM order: main fields, then "More options"

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
    const amt = form.querySelector('[data-amount]');
    if (amt) { const fit = () => { amt.style.width = `${Math.min(9, Math.max(1.2, String(amt.value).length + 0.3))}ch`; }; amt.addEventListener('input', fit); fit(); }   // the figure and the currency symbol stay together
    syncVisibility();
    if (layout === 'amount' && !existing) setTimeout(() => form.querySelector('[data-amount]')?.focus({ preventScroll: true }), 380);   // amount first: the keypad opens straight away

    const autoNumber = () => {
      if (type !== 'academic' || existing) return;
      const cur = collect(form), field = cur.type === 'Practical' ? 'practicalNo' : 'assignmentNo';
      const el = form.elements[field]; if (el && !el.dataset.touched) el.value = nextFreeNo(cur.subject, cur.type);
    };
    let dirty = false;
    api.guard = () => !dirty;                                // taps outside the sheet never discard typed data
    api.onBlocked = async () => {                            // X, Cancel, Escape and drag-down all end up here when there is unsaved input
      if (await confirmDialog({ title: 'Discard changes?', message: 'What you typed has not been saved.', confirmLabel: 'Discard', cancelLabel: 'Keep editing', danger: true })) { dirty = false; api.close(); }
    };
    form.addEventListener('input', () => { dirty = true; }, { once: true });
    form.addEventListener('change', () => { dirty = true; }, { once: true });
    form.addEventListener('focusin', e => { if (e.target.matches('input,textarea,.dd-trigger')) setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 320); });   // keep the active field above the keyboard
    form.addEventListener('input', e => {
      if (e.target.name === 'assignmentNo' || e.target.name === 'practicalNo') e.target.dataset.touched = '1';
      if (e.target.type === 'range') {
        const f = defs.find(d => d.name === e.target.name);
        e.target.style.setProperty('--p', `${((e.target.value - f.min) / (f.max - f.min)) * 100}%`);
        const out = e.target.parentElement.querySelector('output'); if (out) out.textContent = `${e.target.value}${f.suffix || ''}`;
      }
      if (e.target.matches('input[type=date],input[type=time]')) syncClear(e.target);
      const blk = e.target.closest('[data-field]');
      if (blk?.classList.contains('has-error')) { blk.classList.remove('has-error'); const er = blk.querySelector('.field-error'); er.hidden = true; }
    });
    form.addEventListener('change', e => {
      if (['type', 'status', 'subject', 'schedule'].includes(e.target.name)) { syncVisibility(); if (e.target.name !== 'status') autoNumber(); }
      if (type === 'transaction' && e.target.name === 'type') {                  // Expense and Income offer different categories
        const grid = form.querySelector('[data-cats]'), cur = collect(form), list = catList(cur.type, '');
        if (grid) grid.innerHTML = catGrid('category', list, list.includes(cur.category) ? cur.category : list[0], fid);
        form.querySelector('.amount-line')?.classList.toggle('is-income', cur.type === 'income');
        const sub = root.querySelector('button[type=submit]'); if (sub && !existing) sub.textContent = cur.type === 'income' ? 'Add income' : 'Add expense';
      }
      if (e.target.matches('input[type=date]')) syncQuick(e.target);
    });
    const syncQuick = el => { const wrap = el.closest('[data-field]'); wrap?.querySelectorAll('[data-quick]').forEach(b => b.classList.toggle('is-on', el.value === addDays(todayStr(), Number(b.dataset.quick)))); };
    const syncClear = el => { const btn = el.closest('[data-field]')?.querySelector('[data-clear]'); if (btn) btn.hidden = !el.value; };
    form.addEventListener('click', e => {
      const st = e.target.closest('[data-step]');
      if (st) {
        const inp = st.parentElement.querySelector('input'), step = Number(inp.dataset.stepSize) || 1, min = inp.min === '' ? -Infinity : Number(inp.min), max = inp.max === '' ? Infinity : Number(inp.max);
        const next = Math.min(max, Math.max(min, Math.round(((Number(inp.value) || 0) + step * Number(st.dataset.step)) * 100) / 100));
        inp.value = String(next); inp.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const qd = e.target.closest('[data-quick]');
      if (qd) { const inp = qd.closest('[data-field]').querySelector('input[type=date]'); inp.value = addDays(todayStr(), Number(qd.dataset.quick)); inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); syncQuick(inp); }
      const ps = e.target.closest('[data-preset]');
      if (ps) { const inp = ps.closest('[data-field]').querySelector('input'); inp.value = ps.dataset.preset; inp.dispatchEvent(new Event('input', { bubbles: true })); }
      const cl = e.target.closest('[data-clear]');
      if (cl) { const inp = cl.closest('[data-field]').querySelector('input'); inp.value = ''; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.focus(); }
      const s = e.target.closest('[data-suggest]');
      if (s) { form.elements.exercise.value = s.dataset.suggest; form.elements.exercise.focus(); }
      if (e.target.closest('[data-cover-clear]')) { form.elements.cover.value = ''; const t = form.querySelector('[data-cover-thumb]'); t.style.backgroundImage = ''; t.innerHTML = icon('image', { size: 20 }); e.target.closest('[data-cover-clear]').hidden = true; }
    });
    form.querySelector('[data-cover-file]')?.addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return;
      try {
        const data = await readCover(file, defs.find(d => d.type === 'cover')?.ratio || 3 / 4);
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

