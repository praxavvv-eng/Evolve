/* Backup export + validation.
 * Accepts V7 wrapped backups and raw V1–V6 workspace exports. Validation never mutates the live workspace. */
import { normalizeState, summarize, SCHEMA_VERSION } from './migration.js';
import { downloadFile, todayStr } from '../core/utils.js';

const KNOWN = ['tasks', 'habits', 'subjects', 'academicItems', 'workoutLogs', 'transactions', 'games', 'notes', 'goals', 'nofap', 'books', 'budgets'];
const MAX_BYTES = 25 * 1024 * 1024;

export function buildBackup(state) {
  return { app: 'evolve', kind: 'workspace-backup', backupVersion: 1, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data: state };
}

export function exportBackupFile(state) {
  downloadFile(`evolve-backup-${todayStr()}.json`, JSON.stringify(buildBackup(state), null, 2));
}

/** @returns {{ok:true,state:object,summary:object,sourceVersion:number,exportedAt:string}|{ok:false,error:string}} */
export function validateBackup(text) {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, error: 'The file is empty.' };
  if (text.length > MAX_BYTES) return { ok: false, error: 'The file is larger than 25 MB, which is not a normal backup.' };
  let parsed;
  try { parsed = JSON.parse(text); } catch { return { ok: false, error: 'This is not valid JSON. Choose a backup file exported from Evolve.' }; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: false, error: 'The backup has an unexpected structure.' };

  const wrapped = parsed.kind === 'workspace-backup' && parsed.data && typeof parsed.data === 'object';
  const data = wrapped ? parsed.data : parsed;
  const sourceVersion = Number(wrapped ? parsed.schemaVersion : data.version) || 1;
  if (sourceVersion > SCHEMA_VERSION) return { ok: false, error: `This backup is from a newer version (v${sourceVersion}). Update the app first.` };
  if (!KNOWN.some(k => k in data)) return { ok: false, error: 'No Evolve data was found in this file.' };

  /* type checks: a known list that is present must be an array, the tracker must be an object */
  for (const k of KNOWN) {
    if (!(k in data)) continue;
    if (k === 'nofap' ? (data[k] === null || typeof data[k] !== 'object' || Array.isArray(data[k])) : !Array.isArray(data[k])) return { ok: false, error: `The "${k}" section is damaged or has the wrong type.` };
  }
  let state;
  try { state = normalizeState(data); } catch (e) { return { ok: false, error: `The backup could not be read: ${e.message}` }; }
  return { ok: true, state, summary: summarize(state), sourceVersion, exportedAt: wrapped ? parsed.exportedAt || '' : '' };
}
