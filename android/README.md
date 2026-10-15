# pb Android app

A Trusted Web Activity wrapper around https://provacor.github.io/p-b/ (Chrome shows the site
full-screen; phones without Chrome fall back to a WebView). The APK is built and published by
`.github/workflows/android.yml` on every change under `android/`, or by running that workflow by
hand. Latest APK: https://github.com/provacor/p-b/releases/latest/download/pb.apk

- `pb-release.jks` is the signing key (password `pbstudy-app`, alias `pb`). Keep using the same key,
  otherwise installed apps cannot update.
- To hide the small address bar at the top, publish `assetlinks.json` at
  `https://provacor.github.io/.well-known/assetlinks.json` (that needs a repository named
  `provacor.github.io` with this file at `.well-known/assetlinks.json`).
