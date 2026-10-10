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

## Where things are

- `SYLLABUS_STRUCTURE_AUDIT.md`: what was extracted from the syllabus, the source and confidence for each item, and what still **needs verification**.
- `docs/ARCHITECTURE.md`: subjects, papers, section templates, ID scheme, folder layout, navigation, and how future content is added.
- `data/*.json`: the structure. Edit these, not the UI code.
- `content/`: added content (section JSON files + attached PDFs).
