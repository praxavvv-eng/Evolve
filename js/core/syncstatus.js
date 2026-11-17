/* Shared, honest record of cloud sync state. The cloud module writes it; Settings reads it.
 * Nothing here is ever invented: lastOk is only set after a push or pull really completed. */
export const health = { status: 'off', lastOk: 0, lastError: '', lastErrorAt: 0, conflicts: 0 };
export function setHealth(patch) { Object.assign(health, patch); document.dispatchEvent(new CustomEvent('evolve:sync')); }
