# Provacor

A personal, mobile-first HSC Science study app:
**Subject → Paper → Chapter → Section → Content**.

> The full structure is in place. Content is added section by section from the user's own material (see `content/`). The first notes added are Physics 2nd Paper ch. 6 and English Article.

## Run

```bash
node tools/serve.mjs        # → http://localhost:8080
node tools/validate.mjs     # check the structure data
node tools/bump-version.mjs # after changing anything in assets/: stamps a new version on CSS/JS
```

Always run `bump-version` before deploying UI changes. Phones cache files, and without a new version a phone can mix new HTML with old CSS/JS, which breaks the layout.

The app is static (HTML + CSS + ES modules, no dependencies), so it also runs on GitHub Pages: Settings → Pages → deploy from branch, root folder. On Android, open the URL in Chrome and use **Add to Home screen**.

### Android app (APK)

`tools/apk/` wraps the web app in an Android app. The web app (except the notes PDFs) is bundled inside, so it works offline from the first launch. When the phone is online it updates itself from the website. The APK is published password-locked at `apk/` (`apk/index.html` decrypts it in the browser). Only someone with the password can download it.

1. Push a change under `tools/apk/`, or run the **APK (unsigned)** workflow. GitHub Actions builds the unsigned APK with the official Android SDK and pushes it to the `apk-unsigned` branch.
2. Sign and lock it locally. The password also unlocks the signing key `tools/apk/release-key.p12`; it is never stored in the repo.
   ```bash
   git fetch origin apk-unsigned && git show origin/apk-unsigned:unsigned.apk > /tmp/u.apk
   APK_PASSWORD=… python3 tools/apk/build.py sign /tmp/u.apk   # → apk/provacor.apk.enc
   ```
   Keep using the same password and key: Android installs an update only if it is signed with the same key.

## Where things are

- `SYLLABUS_STRUCTURE_AUDIT.md`: what was extracted from the syllabus, the source and confidence for each item, and what still **needs verification**.
- `docs/ARCHITECTURE.md`: subjects, papers, section templates, ID scheme, folder layout, navigation, and how future content is added.
- `data/*.json`: the structure. Edit these, not the UI code.
- `content/`: added content (section JSON files + attached PDFs).
