
/* Central workspace state. One object, saved to localStorage after every update(). */
import {
  loadWorkspace,
  persist,
  KEY_PRE_IMPORT,
  writeRaw,
  readRaw
} from '../storage/storage.js';

import {
  freshState,
  normalizeState
} from '../storage/migration.js';

import { emit } from './events.js';
import { setCurrency } from './utils.js';

let state = freshState();
let locked = false;
let lastSaveOk = true;

export const loadInfo = {
  status: 'fresh',
  from: 0,
  error: '',
  raw: ''
};

export const get = () => state;
export const isLocked = () => locked;
export const unlock = () => { locked = false; };

export function init() {
  const res = loadWorkspace();

  state = res.state;

  Object.assign(loadInfo, {
    status: res.status,
    from: res.from || 0,
    error: res.error || '',
    raw: res.raw || '',
    source: res.source || ''
  });

  locked = res.status === 'corrupt';

  setCurrency(state.settings.currency);

  if (res.status === 'migrated') save();

  if (res.status === 'unavailable') {
    emit('storage:error', {
      message: res.error ||
        'Browser storage is unavailable. Changes will be lost when you close this tab.'
    });
  }

  return res;
}

export function save() {
  if (locked) return false;

  state.updatedAt = new Date().toISOString();

  const result = persist(state);

  if (!result.ok) {
    lastSaveOk = false;

    emit('storage:error', {
      message: `Your latest change could not be saved. ${result.error || ''} Export a backup now.`.trim()
    });

    return false;
  }

  if (!lastSaveOk) {
    lastSaveOk = true;
    emit('storage:ok');
  }

  return true;
}

export function update(mutator, { silent = false } = {}) {
  mutator(state);

  const ok = save();

  setCurrency(state.settings.currency);

  if (!silent) emit('state:changed');

  return ok;
}

export function replaceAll(next, { keepSnapshot = true } = {}) {
  const previous = state;

  if (keepSnapshot) {
    try {
      writeRaw(KEY_PRE_IMPORT, JSON.stringify(previous));
    } catch {
      // Continue without snapshot if browser storage is full.
    }
  }

  locked = false;
  state = normalizeState(next);

  if (!save()) {
    state = previous;
    throw new Error('Storage is full or unavailable, so nothing was replaced.');
  }

  setCurrency(state.settings.currency);

  emit('state:changed');
  emit('settings:changed');

  return state;
}

/* Apply a remote cloud update without triggering another cloud upload. */
export function applyRemote(next) {
  const previous = state;

  state = normalizeState(next);

  if (!save()) {
    state = previous;
    throw new Error('Could not save the downloaded cloud data locally.');
  }

  setCurrency(state.settings.currency);

  emit('state:changed', { remote: true });
  emit('settings:changed');
  emit('view:refresh');

  return state;
}

export function restorePreImportSnapshot() {
  const result = readRaw(KEY_PRE_IMPORT);

  if (!result.ok || !result.value) {
    throw new Error('No earlier snapshot is available.');
  }

  return replaceAll(JSON.parse(result.value), {
    keepSnapshot: false
  });
}

export const hasPreImportSnapshot = () =>
  Boolean(readRaw(KEY_PRE_IMPORT).value);

export function startEmpty() {
  return replaceAll(freshState(), {
    keepSnapshot: false
  });
}
