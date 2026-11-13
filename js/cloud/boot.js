
import { auth, db } from '../firebase.js';
import {
  signInAnonymously,
  onAuthStateChanged
} from 'firebase/auth';

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch
} from 'firebase/firestore';

import * as State from '../core/state.js';
import { registerActions, on, emit } from '../core/events.js';
import * as Router from '../router.js';
import { esc } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { toast } from '../components/toast.js';

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

let status = {
  state: 'connecting',
  message: 'Connecting to Firebase...'
};

function setStatus(state, message) {
  status = { state, message };
  emit('view:refresh');
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

function schedulePush(delay = 900) {
  if (!ready || applyingRemote) return;

  dirty = true;
  clearTimeout(pushTimer);

  pushTimer = setTimeout(() => {
    pushWorkspace().catch(error => {
      setStatus('error', error.message || 'Cloud saving failed.');
    });
  }, delay);
}

async function pushWorkspace() {
  if (!ready || !workspaceId || applyingRemote) return;

  const raw = JSON.stringify(State.get());
  const chunks = splitData(raw);

  if (chunks.length > MAX_CHUNKS) {
    throw new Error('Workspace is too large for this sync setup. Export a backup before continuing.');
  }

  setStatus('syncing', 'Saving your latest changes to Firebase...');

  const batch = writeBatch(db);
  const chunkCollection = collection(
    db,
    'workspaces',
    workspaceId,
    'chunks'
  );

  chunks.forEach((payload, index) => {
    batch.set(doc(chunkCollection, `chunk_${index}`), {
      index,
      payload,
      deviceId
    });
  });

  batch.set(doc(chunkCollection, 'meta'), {
    total: chunks.length,
    deviceId,
    updatedAt: serverTimestamp(),
    schemaVersion: 7
  });

  await batch.commit();

  dirty = false;

  setStatus('synced', 'Your data is saved and synced with Firebase.');
}

async function connectWorkspace() {
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
          setStatus('synced', 'Your data is saved and synced with Firebase.');
          return;
        }

        const total = Number(meta.total);

        if (!Number.isInteger(total) || total < 1 || total > MAX_CHUNKS) {
          throw new Error('Invalid cloud workspace structure.');
        }

        const chunks = new Array(total);

        snapshot.docs.forEach(item => {
          if (!item.id.startsWith('chunk_')) return;

          const data = item.data();

          if (
            Number.isInteger(data.index) &&
            data.index >= 0 &&
            data.index < total
          ) {
            chunks[data.index] = data.payload;
          }
        });

        if (chunks.some(part => typeof part !== 'string')) {
          return;
        }

        // Avoid replacing unsaved local edits with another device's update.
        if (dirty) {
          schedulePush(100);
          return;
        }

        const remoteState = JSON.parse(chunks.join(''));

        applyingRemote = true;

        try {
          if (!hasLoadedCloud) {
            State.replaceAll(remoteState, {
              keepSnapshot: true
            });

            hasLoadedCloud = true;
          } else {
            State.applyRemote(remoteState);
          }
        } finally {
          applyingRemote = false;
        }

        setStatus(
          'synced',
          'Latest workspace data received from Firebase.'
        );

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

  return `
    <header class="page-head">
      <div>
        <h1 class="t-title">Cloud sync</h1>
        <p class="t-body">Keep your Evolve workspace on your devices.</p>
      </div>
    </header>

    <div class="stack-lg">

      <section class="card card-pad">
        <div class="set-head">
          ${icon('cloud', { size: 20 })}
          <h2 class="t-h2">Connection</h2>
        </div>

        <p class="t-body">${esc(status.message)}</p>

        <p class="t-small">
          ${connected ? 'Connected' : 'Connection status: ' + esc(status.state)}
        </p>

        <p class="t-small">
          Workspace ID: ${esc(workspaceId ? workspaceId.slice(0, 12) + '…' : 'Connecting')}
        </p>
      </section>

      <section class="card card-pad">
        <div class="set-head">
          ${icon('smartphone', { size: 20 })}
          <h2 class="t-h2">Pair another device</h2>
        </div>

        <p class="t-body">
          Generate a one-time code here. On your other device,
          open Evolve and enter that code in Cloud sync.
        </p>

        <p class="t-small">
          The code expires after 10 minutes and can only be used once.
        </p>

        <button
          class="btn btn-primary"
          type="button"
          data-action="cloud-create-code"
          ${ready ? '' : 'disabled'}
        >
          ${icon('plus', { size: 17 })} Generate pairing code
        </button>

        ${latestCode ? `
          <div class="field mt-4">
            <label>Pairing code</label>
            <input
              value="${esc(latestCode)}"
              readonly
              aria-label="Pairing code"
              style="font-family:monospace;font-size:13px"
            >
          </div>

          <button
            class="btn mt-2"
            type="button"
            data-action="cloud-copy-code"
          >
            ${icon('copy', { size: 16 })} Copy code
          </button>
        ` : ''}
      </section>

      <section class="card card-pad">
        <div class="set-head">
          ${icon('link', { size: 20 })}
          <h2 class="t-h2">Join an existing workspace</h2>
        </div>

        <p class="t-body">
          Enter the pairing code generated on your other device.
          Joining replaces this browser's active workspace with
          the paired workspace. A snapshot of the previous local
          data is kept.
        </p>

        <div class="field mt-3">
          <label for="cloud-pairing-code">Pairing code</label>
          <input
            id="cloud-pairing-code"
            type="text"
            autocomplete="off"
            spellcheck="false"
            placeholder="Paste your pairing code"
          >
        </div>

        <button
          class="btn btn-primary mt-3"
          type="button"
          data-action="cloud-join"
        >
          Join workspace
        </button>
      </section>

      <p class="t-small">
        Your app opens without a login screen. Firebase creates
        a private anonymous device identity in the background.
        Keep at least one paired device available as a recovery device.
      </p>

    </div>
  `;
}

Router.register({
  id: 'cloud',
  render: renderCloudPage
});

// Add a Cloud sync shortcut to the existing top bar.
const topbarEnd = document.querySelector('.topbar-end');

if (topbarEnd && !document.querySelector('[data-action="cloud-open"]')) {
  const button = document.createElement('button');

  button.type = 'button';
  button.className = 'icon-btn is-solid';
  button.dataset.action = 'cloud-open';
  button.setAttribute('aria-label', 'Cloud sync');
  button.title = 'Cloud sync';
  button.innerHTML = icon('cloud', { size: 20 });

  topbarEnd.append(button);
}

registerActions({
  'cloud-open'() {
    Router.navigate('cloud');
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
