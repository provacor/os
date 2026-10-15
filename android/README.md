# pb Android app

A small native app: one full-screen WebView (`MainActivity`) that shows
https://provacor.github.io/p-b/. It needs no Chrome and no libraries, so the APK is tiny.

- **Offline:** the site's service worker stores the app and the study files on the first launch
  with internet; after that the app opens and works offline. Without that first visit it shows a
  small "needs internet once" page (`assets/offline.html`).
- **Bridge (`window.PbAndroid`):** read-aloud through Android text-to-speech (the WebView has no
  speechSynthesis; `assets/js/a11y.js` maps the page's API onto it) and saving backup files
  (`assets/js/backup.js`). Links outside the site (YouTube, GitHub…) open in their own apps.
- **Build:** `.github/workflows/android.yml` builds the signed APK on every change under
  `android/` (and by hand) and publishes it; latest:
  https://github.com/provacor/p-b/releases/latest/download/pb.apk
- **Signing:** from the repository secrets `PB_KEYSTORE_BASE64` (the keystore file, base64) and
  `PB_KEYSTORE_PASSWORD` (alias `pb`). Until they are set, each build gets a one-off key, so a newer
  APK installs only after uninstalling the older one. The key is never committed.
