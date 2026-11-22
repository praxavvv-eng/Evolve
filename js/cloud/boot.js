
import { auth, db } from '../firebase.js';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';

import { collection, doc, getDoc, getDocs, onSnapshot, runTransaction, serverTimestamp, setDoc, Timestamp, writeBatch } from 'firebase/firestore';

import * as State from '../core/state.js';
import { registerActions, on, emit } from '../core/events.js';
import * as Router from '../router.js';
import { cloudView } from '../core/cloudview.js';
import { esc } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { toast } from '../components/toast.js';
import { setHealth, health } from '../core/syncstatus.js';
import { mergeStates } from './merge.js';
import { LISTS } from '../storage/migration.js';

const WORKSPACE_KEY = 'evolve_cloud_workspace_v1';
const DEVICE_KEY = 'evolve_cloud_device_v1';
const CHUNK_SIZE = 150000;
const MAX_CHUNKS = 450;

let uid = '';
let workspaceId = '';
let deviceId = '';
let unsubscribe = null;
let ready = false;
let dirty = false;
let applyingRemote = false;
let hasLoadedCloud = false;
let pushTimer = null;
let latestCode = '';
let lastRaw = '';          // last workspace text this device uploaded (skips identical uploads)
let lastChunks = [];       // last uploaded chunk payloads (only changed chunks are written)
let lastSeenMs = 0;        // newest cloud update this device has already merged
let retryDelay = 4000;
const toMs = t => (t && typeof t.toMillis === 'function' ? t.toMillis() : Number(t) || 0);

let status = {
  state: 'connecting',
  message: 'Connecting to Firebase...'
};

function setStatus(state, message) {
  status = { state, message };
  const map = { synced: 'idle', syncing: 'syncing', connecting: 'connecting', waiting: 'connecting', error: 'error' };
  const patch = { status: state === 'error' && navigator.onLine === false ? 'offline' : (map[state] || state) };
  if (state === 'synced') { patch.lastOk = Date.now(); patch.lastError = ''; }
  if (state === 'error') { patch.lastError = message; patch.lastErrorAt = Date.now(); }
  setHealth(patch);
  emit('view:refresh');
}

/** Join the chunk documents of one cloud snapshot into a workspace object (null while chunks are still arriving). */
function assemble(docs, meta) {
  const total = Number(meta.total);
  if (!Number.isInteger(total) || total < 1 || total > MAX_CHUNKS) throw new Error('Invalid cloud workspace structure.');
  const chunks = new Array(total);
  docs.forEach(item => {
    if (!item.id.startsWith('chunk_')) return;
    const data = item.data();
    if (Number.isInteger(data.index) && data.index >= 0 && data.index < total) chunks[data.index] = data.payload;
  });
  return chunks.some(part => typeof part !== 'string') ? null : JSON.parse(chunks.join(''));
}

/** Another device saved since we last looked: merge its changes into ours instead of overwriting them. */
function mergeRemote(remoteState, remoteMs) {
  const merged = mergeStates(State.get(), remoteState);
  applyingRemote = true;
  try { State.applyRemote(merged); } finally { applyingRemote = false; }
  lastSeenMs = remoteMs; lastChunks = []; lastRaw = '';
  setHealth({ conflicts: health.conflicts + 1 });
  toast('Merged changes from another device');
}

function randomToken(bytes = 32) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);

  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);

  if (!id) {
    id = randomToken(16);
    localStorage.setItem(DEVICE_KEY, id);
  }

  return id;
}

async function getUser() {
  if (auth.currentUser) return auth.currentUser;

  return new Promise((resolve, reject) => {
    let stop;

    stop = onAuthStateChanged(auth, async user => {
      stop();

      if (user) {
        resolve(user);
        return;
      }

      try {
        const result = await signInAnonymously(auth);
        resolve(result.user);
      } catch (error) {
        reject(error);
      }
    }, reject);
  });
}

function splitData(raw) {
  const parts = [];
  let start = 0;

  while (start < raw.length) {
    let end = Math.min(start + CHUNK_SIZE, raw.length);

    // Never split a UTF-16 surrogate pair.
    if (
      end < raw.length &&
      raw.charCodeAt(end - 1) >= 0xD800 &&
      raw.charCodeAt(end - 1) <= 0xDBFF
    ) {
      end--;
    }

    parts.push(raw.slice(start, end));
    start = end;
  }

  return parts;
}

function schedulePush(delay = 1500) {
  if (!ready || applyingRemote) return;

  dirty = true;
  clearTimeout(pushTimer);

  pushTimer = setTimeout(() => {
    pushWorkspace().then(() => { retryDelay = 4000; }).catch(error => {
      setStatus('error', error.message || 'Cloud saving failed.');
      if (dirty && navigator.onLine !== false) { setTimeout(() => schedulePush(0), retryDelay); retryDelay = Math.min(60000, retryDelay * 2); }   // retry with backoff; local data is untouched
    });
  }, delay);
}

async function pushWorkspace() {
  if (!ready || !workspaceId || applyingRemote) return;

  const chunkCollection = collection(db, 'workspaces', workspaceId, 'chunks');

  /* Never overwrite newer cloud data: if another device saved since we last looked, merge it in first. */
  const metaSnap = await getDoc(doc(chunkCollection, 'meta'));
  if (metaSnap.exists()) {
    const m = metaSnap.data();
    if (m.deviceId !== deviceId && toMs(m.updatedAt) > lastSeenMs) {
      try {
        const all = await getDocs(chunkCollection);
        const remoteState = assemble(all.docs, m);
        if (!remoteState) throw new Error('Cloud data is still uploading. Will retry.');
        mergeRemote(remoteState, toMs(m.updatedAt));
      } catch (error) {
        throw new Error(`Not uploaded, to protect newer cloud data. ${error.message}`);
      }
    }
  }

  const raw = JSON.stringify(State.get());
  if (raw === lastRaw) { dirty = false; setStatus('synced', 'Your data is saved and synced with Firebase.'); return; }   // nothing changed since the last upload

  const chunks = splitData(raw);

  if (chunks.length > MAX_CHUNKS) {
    throw new Error('Workspace is too large for this sync setup. Export a backup before continuing.');
  }

  setStatus('syncing', 'Saving your latest changes to Firebase...');

  const batch = writeBatch(db);

  chunks.forEach((payload, index) => {
    if (lastChunks[index] === payload) return;           // unchanged chunk: no write
    batch.set(doc(chunkCollection, `chunk_${index}`), { index, payload, deviceId });
  });

  batch.set(doc(chunkCollection, 'meta'), {
    total: chunks.length,
    deviceId,
    updatedAt: serverTimestamp(),
    schemaVersion: 7
  });

  await batch.commit();

  lastRaw = raw;
  lastChunks = chunks;
  dirty = false;

  setStatus('synced', 'Your data is saved and synced with Firebase.');
}

async function connectWorkspace() {
  lastRaw = ''; lastChunks = []; lastSeenMs = 0;
  ready = false;
  hasLoadedCloud = false;
  dirty = false;

  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }

  setStatus('connecting', 'Connecting your device...');

  const user = await getUser();
  uid = user.uid;
  deviceId = getDeviceId();

  let storedWorkspace = localStorage.getItem(WORKSPACE_KEY);

  if (!storedWorkspace) {
    storedWorkspace = uid;
    localStorage.setItem(WORKSPACE_KEY, uid);
  }

  if (storedWorkspace !== uid) {
    const memberRef = doc(
      db,
      'workspaces',
      storedWorkspace,
      'members',
      uid
    );

    const member = await getDoc(memberRef);

    if (!member.exists()) {
      storedWorkspace = uid;
      localStorage.setItem(WORKSPACE_KEY, uid);
    }
  }

  workspaceId = storedWorkspace;

  const workspaceRef = doc(db, 'workspaces', workspaceId);
  const workspace = await getDoc(workspaceRef);

  if (!workspace.exists()) {
    if (workspaceId !== uid) {
      throw new Error('This device is not paired with that workspace.');
    }

    await setDoc(workspaceRef, {
      ownerUid: uid,
      schemaVersion: 7,
      createdAt: serverTimestamp()
    });
  }

  const chunkCollection = collection(
    db,
    'workspaces',
    workspaceId,
    'chunks'
  );

  unsubscribe = onSnapshot(
    chunkCollection,
    async snapshot => {
      try {
        const metaDoc = snapshot.docs.find(
          item => item.id === 'meta'
        );

        if (!metaDoc) {
          if (snapshot.empty && workspaceId === uid) {
            ready = true;
            await pushWorkspace();
          } else {
            setStatus(
              'waiting',
              'Waiting for the main device to upload its workspace...'
            );
          }

          return;
        }

        const meta = metaDoc.data();

        ready = true;

        if (meta.deviceId === deviceId) {
          lastSeenMs = Math.max(lastSeenMs, toMs(meta.updatedAt));
          setStatus('synced', 'Your data is saved and synced with Firebase.');
          return;
        }

        const remoteState = assemble(snapshot.docs, meta);
        if (!remoteState) return;
        const remoteMs = toMs(meta.updatedAt);

        /* Unsynced local edits: merge both sides, then upload the merged result. */
        if (dirty) {
          mergeRemote(remoteState, remoteMs);
          schedulePush(300);
          return;
        }

        /* First load on a device that already holds its own records: merge, so neither side is lost. */
        const local = State.get();
        const hasLocalData = LISTS.some(k => Array.isArray(local[k]) && local[k].length && k !== 'trashBin' && k !== 'activityLog') || Number(local.xp) > 0;
        if (!hasLoadedCloud && hasLocalData) {
          mergeRemote(remoteState, remoteMs);
          hasLoadedCloud = true;
          schedulePush(300);
          return;
        }

        applyingRemote = true;

        try {
          if (!hasLoadedCloud) {
            State.replaceAll(remoteState, { keepSnapshot: true });
            hasLoadedCloud = true;
          } else {
            State.applyRemote(remoteState);
          }
        } finally {
          applyingRemote = false;
        }

        lastSeenMs = remoteMs; lastChunks = []; lastRaw = '';
        setStatus('synced', 'Latest workspace data received from Firebase.');

      } catch (error) {
        setStatus('error', error.message || 'Could not read cloud data.');
      }
    },
    error => {
      setStatus('error', error.message || 'Firebase connection failed.');
    }
  );
}

export async function createPairingCode() {
  if (!ready || !workspaceId) {
    throw new Error('Wait until Firebase finishes connecting.');
  }

  const code = randomToken(32);

  const inviteRef = doc(db, 'pairingInvites', code);

  await setDoc(inviteRef, {
    ownerUid: workspaceId,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + 10 * 60 * 1000),
    used: false
  });

  latestCode = code;
  emit('view:refresh');

  return code;
}

export async function joinWorkspace(code) {
  const cleanCode = String(code || '').trim();

  if (!/^[A-Za-z0-9_-]{43}$/.test(cleanCode)) {
    throw new Error('Enter the complete pairing code.');
  }

  const user = await getUser();
  uid = user.uid;

  const inviteRef = doc(db, 'pairingInvites', cleanCode);
  const invite = await getDoc(inviteRef);

  if (!invite.exists()) {
    throw new Error('Pairing code not found.');
  }

  const memberWorkspace = invite.data().ownerUid;

  await runTransaction(db, async transaction => {
    const currentInvite = await transaction.get(inviteRef);

    if (!currentInvite.exists()) {
      throw new Error('Pairing code not found.');
    }

    const data = currentInvite.data();

    if (data.used) {
      throw new Error('This pairing code has already been used.');
    }

    if (!data.expiresAt || data.expiresAt.toMillis() < Date.now()) {
      throw new Error('Pairing code has expired. Generate a new one.');
    }

    const memberRef = doc(
      db,
      'workspaces',
      memberWorkspace,
      'members',
      uid
    );

    transaction.set(memberRef, {
      uid,
      inviteId: cleanCode,
      joinedAt: serverTimestamp()
    });

    transaction.update(inviteRef, {
      used: true,
      usedBy: uid
    });
  });

  // The existing browser data is backed up when cloud data arrives.
  localStorage.setItem(WORKSPACE_KEY, memberWorkspace);

  latestCode = '';

  await connectWorkspace();
}

function renderCloudPage() {
  const connected = status.state === 'synced';
  const when = ms => new Date(ms).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  const LABEL = { off: 'Not connected', connecting: 'Connecting…', idle: 'Up to date', syncing: 'Syncing…', offline: 'Offline', error: 'Needs attention', conflict: 'Merged changes' };
  const tone = health.status === 'error' ? 'is-error' : health.status === 'offline' ? 'is-warn' : connected || health.status === 'idle' ? 'is-ok' : 'is-wait';

  return `
    <header class="page-head">
      <div>
        <h1 class="t-title">Cloud sync</h1>
        <p class="t-body">Keep your Evolve workspace on your devices.</p>
      </div>
    </header>

    <div class="stack-lg">

      <section class="card card-pad set-card cloud-card">
        <div class="set-head">${icon('cloud', { size: 20 })}<h2 class="t-h2">Connection</h2></div>
        <div class="cloud-status ${tone}"><span class="cs-dot" aria-hidden="true"></span><div><b>${esc(LABEL[health.status] || status.state)}</b><p>${esc(status.message)}</p></div></div>
        <dl class="kv">
          <div><dt>Workspace ID</dt><dd class="t-num">${esc(workspaceId ? workspaceId.slice(0, 12) + '…' : 'Connecting')}</dd></div>
          <div><dt>Last successful sync</dt><dd>${health.lastOk ? esc(when(health.lastOk)) : 'Not synced yet'}</dd></div>
          ${health.lastError ? `<div><dt>Last problem</dt><dd>${esc(health.lastError)}${health.lastErrorAt ? `<br><span class="t-small">${esc(when(health.lastErrorAt))}</span>` : ''}</dd></div>` : ''}
          ${health.conflicts ? `<div><dt>Merged conflicts</dt><dd>${esc(String(health.conflicts))}</dd></div>` : ''}
        </dl>
      </section>

      <section class="card card-pad set-card cloud-card">
        <div class="set-head">${icon('smartphone', { size: 20 })}<h2 class="t-h2">Pair another device</h2></div>
        <p class="t-body">Generate a one-time code here. On your other device, open Evolve and enter that code in Settings, Cloud sync.</p>
        <p class="t-small">The code expires after 10 minutes and can only be used once.</p>
        <div class="set-actions">
          <button class="btn btn-primary" type="button" data-action="cloud-create-code" ${ready ? '' : 'disabled'}>${icon('plus', { size: 17 })} Generate pairing code</button>
        </div>
        ${latestCode ? `
          <div class="field mt-4">
            <label for="cloud-latest-code">Pairing code</label>
            <input id="cloud-latest-code" value="${esc(latestCode)}" readonly aria-label="Pairing code" style="font-family:var(--font-mono);font-size:0.85rem">
          </div>
          <button class="btn mt-2" type="button" data-action="cloud-copy-code">${icon('copy', { size: 16 })} Copy code</button>` : ''}
      </section>

      <section class="card card-pad set-card cloud-card">
        <div class="set-head">${icon('link', { size: 20 })}<h2 class="t-h2">Join an existing workspace</h2></div>
        <p class="t-body">Enter the pairing code generated on your other device. Joining replaces this browser's active workspace with the paired workspace. A snapshot of the previous local data is kept.</p>
        <div class="field mt-3">
          <label for="cloud-pairing-code">Pairing code</label>
          <input id="cloud-pairing-code" type="text" autocomplete="off" spellcheck="false" placeholder="Paste your pairing code" data-keep>
        </div>
        <div class="set-actions"><button class="btn btn-primary" type="button" data-action="cloud-join">Join workspace</button></div>
      </section>

      <p class="t-small faint">Your app opens without a login screen. Firebase creates a private anonymous device identity in the background. Keep at least one paired device available as a recovery device.</p>

    </div>
  `;
}

// Cloud sync lives in Settings now. The screen is shared with Settings through core/cloudview.js,
// and the old #/cloud address still works by forwarding there.
cloudView.render = renderCloudPage;
Router.register({
  id: 'cloud',
  render() {
    queueMicrotask(() => location.replace('#/settings/cloud'));
    return '';
  }
});
emit('view:refresh');

registerActions({
  'cloud-open'() {
    location.hash = '#/settings/cloud';
  },

  async 'cloud-create-code'() {
    try {
      await createPairingCode();
      toast('Pairing code generated.');
    } catch (error) {
      toast(error.message, { type: 'error' });
    }
  },

  async 'cloud-copy-code'() {
    if (!latestCode) return;

    try {
      await navigator.clipboard.writeText(latestCode);
      toast('Pairing code copied.');
    } catch {
      window.prompt('Copy this pairing code:', latestCode);
    }
  },

  async 'cloud-join'() {
    const code = document
      .querySelector('#cloud-pairing-code')
      ?.value.trim();

    try {
      await joinWorkspace(code);
      toast('Device paired successfully.');
      Router.navigate('home');
    } catch (error) {
      toast(error.message, { type: 'error' });
    }
  }
});

// Local changes are saved to Firestore after a short delay.
on('state:changed', detail => {
  if (detail?.remote || applyingRemote) return;
  schedulePush();
});

window.addEventListener('online', () => {
  if (dirty) schedulePush(100);
});

// Start Firebase after the normal Evolve app has initialized.
connectWorkspace().catch(error => {
  console.error('[Evolve Cloud]', error);

  const message = error.code === 'auth/operation-not-allowed'
    ? 'Enable Anonymous Authentication in Firebase Console → Authentication → Sign-in method.'
    : error.message || 'Could not connect to Firebase.';

  setStatus('error', message);
});

/* Offline handling: keep working locally, resume automatically when the connection returns. */
window.addEventListener('offline', () => setHealth({ status: 'offline' }));
window.addEventListener('online', () => { if (dirty) schedulePush(400); else setHealth({ status: ready ? 'idle' : health.status }); });
