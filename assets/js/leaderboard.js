// Shared weekly leaderboard on Firebase (Firestore + anonymous sign-in).
// Each device signs in anonymously and writes one row for the current week:
//   weeks/{saturday-date}/users/{uid} = { name: string|null, seconds: int, updatedAt }
// Only the name (when the person chose to show it) and the seconds are sent;
// the photo never leaves the device. Off until firebase-config.js is filled in.

import { firebaseConfig } from './firebase-config.js?v=202610021341';
import { getProfile, weekSeconds, weekKey } from './profile.js?v=202610021341';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';
export const leaderboardReady = () => !!firebaseConfig;

let fb = null;
async function connect() {
  if (!firebaseConfig) return null;
  fb ??= (async () => {
    const [{ initializeApp }, auth, store] = await Promise.all([
      import(`${SDK}/firebase-app.js`),
      import(`${SDK}/firebase-auth.js`),
      import(`${SDK}/firebase-firestore.js`),
    ]);
    const app = initializeApp(firebaseConfig);
    const a = auth.getAuth(app);
    const user = a.currentUser ?? (await auth.signInAnonymously(a)).user;
    return { db: store.getFirestore(app), uid: user.uid, store };
  })().catch((e) => {
    fb = null;
    throw e;
  });
  return fb;
}

let lastSent = -1;
export async function syncLeaderboard() {
  const p = getProfile();
  const c = await connect();
  if (!c) return;
  const { db, uid, store } = c;
  const ref = store.doc(db, 'weeks', weekKey(), 'users', uid);
  if (p.leaderboard === false) {
    if (lastSent !== -2) await store.deleteDoc(ref);
    lastSent = -2;
    return;
  }
  const seconds = Math.floor(weekSeconds());
  const name = p.anonymous ? null : p.name || null;
  const sig = `${seconds}|${name}`;
  if (sig === lastSent) return;
  await store.setDoc(ref, { name, seconds, updatedAt: store.serverTimestamp() });
  lastSent = sig;
}

export async function topUsers(n = 20) {
  const c = await connect();
  if (!c) return null;
  const { db, uid, store } = c;
  const q = store.query(store.collection(db, 'weeks', weekKey(), 'users'), store.orderBy('seconds', 'desc'), store.limit(n));
  const snap = await store.getDocs(q);
  return snap.docs.map((d) => ({ ...d.data(), me: d.id === uid }));
}

export function startLeaderboard() {
  if (!firebaseConfig) return;
  const run = () => syncLeaderboard().catch(() => {});
  setTimeout(run, 5000);
  setInterval(() => document.visibilityState === 'visible' && run(), 60000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && run());
}
