# pb Android app

A Trusted Web Activity wrapper around https://provacor.github.io/p-b/ (Chrome shows the site
full-screen; phones without Chrome fall back to a WebView). The APK is built and published by
`.github/workflows/android.yml` on every change under `android/`, or by running that workflow by
hand. Latest APK: https://github.com/provacor/p-b/releases/latest/download/pb.apk

- Signing: the workflow reads the key from the repository secrets `PB_KEYSTORE_BASE64` (the
  keystore file, base64) and `PB_KEYSTORE_PASSWORD` (alias `pb`). Until they are set, each build is
  signed with a one-off key, so a newer APK only installs after uninstalling the older one. The key
  is never committed.
- Once a fixed key is in the secrets, the small address bar at the top can be hidden by publishing
  a Digital Asset Links file for that key's SHA-256 fingerprint at
  `https://provacor.github.io/.well-known/assetlinks.json` (a repository named `provacor.github.io`).
