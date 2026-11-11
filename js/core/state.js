/* Central workspace state. One object, saved to localStorage after every update().
 * Views never write to storage directly; they call update(mutator). */
import { loadWorkspace, persist, KEY_PRE_IMPORT, writeRaw, readRaw } from '../storage/storage.js';
import { freshState, normalizeState } from '../storage/migration.js';
import { emit } from './events.js';
import { setCurrency } from './utils.js';

let state = freshState();
let locked = false;          // true while unreadable data is being protected from overwrite
let lastSaveOk = true;
export const loadInfo = { status: 'fresh', from: 0, error: '', raw: '' };

export const get = () => state;
export const isLocked = () => locked;
export const unlock = () => { locked = false; };

export function init() {
  const res = loadWorkspace();
  state = res.state;
  Object.assign(loadInfo, { status: res.status, from: res.from || 0, error: res.error || '', raw: res.raw || '', source: res.source || '' });
  locked = res.status === 'corrupt';
  setCurrency(state.settings.currency);
  if (res.status === 'migrated') save();                 // write V7 copy; V6 key stays untouched
  if (res.status === 'unavailable') emit('storage:error', { message: res.error || 'Browser storage is unavailable. Changes will be lost when you close this tab.' });
  return res;
}

export function save() {
  if (locked) return false;
  state.updatedAt = new Date().toISOString();
  const r = persist(state);
  if (!r.ok) {
    lastSaveOk = false;
    emit('storage:error', { message: `Your latest change could not be saved. ${r.error || ''} Export a backup now.`.trim() });
    return false;
  }
  if (!lastSaveOk) { lastSaveOk = true; emit('storage:ok'); }
  return true;
}

/** Mutate state, persist, notify. Returns whether the change was saved. */
export function update(mutator, { silent = false } = {}) {
  mutator(state);
  const ok = save();
  setCurrency(state.settings.currency);
  if (!silent) emit('state:changed');
  return ok;
}

/** Replace the whole workspace (import / reset). A pre-import snapshot is kept so the swap can be undone once. */
export function replaceAll(next, { keepSnapshot = true } = {}) {
  const previous = state;
  if (keepSnapshot) { try { writeRaw(KEY_PRE_IMPORT, JSON.stringify(previous)); } catch { /* quota: continue without snapshot */ } }
  locked = false;
  state = normalizeState(next);
  if (!save()) { state = previous; throw new Error('Storage is full or unavailable, so nothing was replaced.'); }
  setCurrency(state.settings.currency);
  emit('state:changed'); emit('settings:changed');
  return state;
}

export function restorePreImportSnapshot() {
  const r = readRaw(KEY_PRE_IMPORT);
  if (!r.ok || !r.value) throw new Error('No earlier snapshot is available.');
  return replaceAll(JSON.parse(r.value), { keepSnapshot: false });
}
export const hasPreImportSnapshot = () => Boolean(readRaw(KEY_PRE_IMPORT).value);

export function startEmpty() { return replaceAll(freshState(), { keepSnapshot: false }); }
