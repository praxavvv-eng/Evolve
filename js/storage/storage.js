/* localStorage layer.
 * Rules:
 *  - The V6 key is only ever READ. V7 never writes, renames or deletes it.
 *  - If stored data cannot be parsed, the raw text is preserved and the app refuses to overwrite it
 *    until the person makes an explicit choice (see app.js recovery screen).
 */
import { normalizeState, freshState } from './migration.js';

export const KEY_V7 = 'evolve_v7_workspace';
export const KEY_V6 = 'evolve_personal_os_v1';
export const KEY_RECOVERY = 'evolve_v7_recovery_snapshot';
export const KEY_PRE_IMPORT = 'evolve_v7_pre_import_snapshot';

function ls() { try { return window.localStorage; } catch { return null; } }

export function readRaw(key) {
  const store = ls();
  if (!store) return { ok: false, error: 'Browser storage is disabled.' };
  try { return { ok: true, value: store.getItem(key) }; } catch (e) { return { ok: false, error: e.message }; }
}
export function writeRaw(key, value) {
  const store = ls();
  if (!store) return { ok: false, error: 'Browser storage is disabled.' };
  try { store.setItem(key, value); return { ok: true }; } catch (e) { return { ok: false, error: e.name === 'QuotaExceededError' ? 'Browser storage is full.' : e.message }; }
}
export function removeRaw(key) { try { ls()?.removeItem(key); } catch { /* ignore */ } }

/**
 * @returns {{state:object, status:'ok'|'fresh'|'migrated'|'corrupt'|'unavailable', raw?:string, source?:string, from?:number}}
 */
export function loadWorkspace() {
  const v7 = readRaw(KEY_V7);
  if (!v7.ok) return { state: freshState(), status: 'unavailable', error: v7.error };

  if (v7.value) {
    try { return { state: normalizeState(JSON.parse(v7.value)), status: 'ok' }; }
    catch (e) {
      if (!readRaw(KEY_RECOVERY).value) writeRaw(KEY_RECOVERY, v7.value);
      return { state: freshState(), status: 'corrupt', raw: v7.value, source: 'V7', error: e.message };
    }
  }

  const v6 = readRaw(KEY_V6);
  if (v6.ok && v6.value) {
    try {
      const parsed = JSON.parse(v6.value);
      return { state: normalizeState(parsed), status: 'migrated', from: Number(parsed?.version) || 1 };
    } catch (e) {
      return { state: freshState(), status: 'corrupt', raw: v6.value, source: 'V6', error: e.message };
    }
  }
  return { state: freshState(), status: 'fresh' };
}

export function persist(state) {
  try { return writeRaw(KEY_V7, JSON.stringify(state)); }
  catch (e) { return { ok: false, error: e.message }; }
}

export function hasRecoverySnapshot() { return Boolean(readRaw(KEY_RECOVERY).value); }
export function storageEstimate() {
  const raw = readRaw(KEY_V7).value || '';
  return { bytes: new Blob([raw]).size };
}
