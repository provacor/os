# Turning on the shared leaderboard (Firebase)

The leaderboard stays off until `assets/js/firebase-config.js` holds a Firebase web config.

1. Go to https://console.firebase.google.com → **Add project** (Google Analytics can be off).
2. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable**.
3. **Build → Firestore Database → Create database** → production mode → a nearby region (e.g. `asia-south1`).
4. Firestore → **Rules** tab → replace everything with the contents of `firestore.rules` → **Publish**.
5. Project settings (gear) → **Your apps** → Web (`</>`) → register the app → copy the `firebaseConfig = { … }` object.
6. Paste it into `assets/js/firebase-config.js` as `export const firebaseConfig = { … };`, run `node tools/bump-version.mjs`, commit and push.
7. Authentication → Settings → **Authorized domains** → add `provacor.github.io`.

What is sent: for the current Saturday–Friday week, `{ name (or null when Anonymous), seconds, updatedAt }` per device.
Photos never leave the device. "যোগ দেব না" deletes the row and stops sending.
