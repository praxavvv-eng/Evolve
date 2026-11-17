/* Record-level merge of two workspaces, used only when another device changed the cloud copy while this device
 * has unsynced edits. Nothing is dropped silently: newer edits win per record, records deleted on either side
 * stay deleted (and recoverable from Recently deleted), new records from either side are kept. */
import { LISTS } from '../storage/migration.js';

const stamp = r => String((r && (r.updatedAt || r.at || r.createdAt)) || '');
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const clone = v => JSON.parse(JSON.stringify(v));

function mergeLogs(a = {}, b = {}) {
  const out = { ...a };
  Object.entries(b).forEach(([d, e]) => { if (!out[d] || stamp(e) > stamp(out[d])) out[d] = e; });
  return out;
}

export function mergeStates(local, remote) {
  const out = clone(local);
  const deleted = new Set([...(local.trashBin || []), ...(remote.trashBin || [])].map(t => t.record?.id).filter(Boolean));

  LISTS.forEach(key => {
    if (key === 'trashBin' || key === 'activityLog') return;
    const mine = Array.isArray(local[key]) ? local[key] : [], theirs = Array.isArray(remote[key]) ? remote[key] : [];
    const byId = new Map(mine.map(r => [r.id, r]));
    theirs.forEach(r => {
      const cur = byId.get(r.id);
      if (!cur) byId.set(r.id, r);
      else if (stamp(r) > stamp(cur)) byId.set(r.id, key === 'challenges' ? { ...r, logs: mergeLogs(cur.logs, r.logs) } : r);
      else if (key === 'challenges') byId.set(r.id, { ...cur, logs: mergeLogs(cur.logs, r.logs) });
    });
    out[key] = [...byId.values()].filter(r => !deleted.has(r.id));
  });

  const trash = new Map([...(local.trashBin || []), ...(remote.trashBin || [])].map(t => [t.id, t]));
  out.trashBin = [...trash.values()].slice(-100);
  const act = new Map([...(local.activityLog || []), ...(remote.activityLog || [])].map(a => [a.id, a]));
  out.activityLog = [...act.values()].sort((x, y) => String(y.date).localeCompare(String(x.date))).slice(0, 120);

  /* per-day maps: union, so a check-in made on either device survives */
  out.habitLogs = { ...(remote.habitLogs || {}) };
  Object.entries(local.habitLogs || {}).forEach(([d, v]) => { out.habitLogs[d] = { ...(out.habitLogs[d] || {}), ...v }; });
  ['habitXPLogs', 'rewardEvents', 'achievements'].forEach(k => { out[k] = { ...(remote[k] || {}), ...(local[k] || {}) }; });
  out.dailyXP = { ...(remote.dailyXP || {}) };
  Object.entries(local.dailyXP || {}).forEach(([d, v]) => { out.dailyXP[d] = Math.max(Number(v) || 0, Number(out.dailyXP[d]) || 0); });

  /* XP only ever grows, so the larger value is the safe one */
  out.xp = Math.max(Number(local.xp) || 0, Number(remote.xp) || 0);
  out.categoryXP = { ...(remote.categoryXP || {}) };
  Object.entries(local.categoryXP || {}).forEach(([k, v]) => { out.categoryXP[k] = Math.max(Number(v) || 0, Number(out.categoryXP[k]) || 0); });
  out.lastLevelSeen = Math.max(Number(local.lastLevelSeen) || 1, Number(remote.lastLevelSeen) || 1);

  /* the original single tracker: keep every recorded day from both sides */
  if (isObj(local.nofap) && isObj(remote.nofap)) {
    out.nofap.dailyLogs = mergeLogs(remote.nofap.dailyLogs, local.nofap.dailyLogs);
    out.nofap.logs = { ...out.nofap.dailyLogs };
    const hist = new Map([...(local.nofap.history || []), ...(remote.nofap.history || [])].map(h => [`${h.challengeId}|${h.endedAt}`, h]));
    out.nofap.history = [...hist.values()];
    out.nofap.bestStreak = Math.max(Number(local.nofap.bestStreak) || 0, Number(remote.nofap.bestStreak) || 0);
  }
  out.removedFeaturesArchive = { ...(remote.removedFeaturesArchive || {}), ...(local.removedFeaturesArchive || {}) };
  out.removedModulesArchive = { ...(remote.removedModulesArchive || {}), ...(local.removedModulesArchive || {}) };
  out.updatedAt = new Date().toISOString();
  return out;   // settings and ui stay as on this device
}
