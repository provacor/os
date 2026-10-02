# HSC Science Study OS

A personal, mobile-first study app for HSC Science:
**Subject → Paper → Chapter → Section → Content**.

> **Phase 1: structure only.** All sections are empty on purpose. No notes, MCQ, CQ, formulas or other study content are included.

## Run

```bash
node tools/serve.mjs        # → http://localhost:8080
node tools/validate.mjs     # check the structure data
```

The app is static (HTML + CSS + ES modules, no dependencies), so it also runs on GitHub Pages: Settings → Pages → deploy from branch, root folder. On Android, open the URL in Chrome and use **Add to Home screen**.

## Where things are

- `SYLLABUS_STRUCTURE_AUDIT.md`: what was extracted from the syllabus, the source and confidence for each item, and what still **needs verification**.
- `docs/ARCHITECTURE.md`: subjects, papers, section templates, ID scheme, folder layout, navigation, and how future content is added.
- `data/*.json`: the structure. Edit these, not the UI code.
- `content/`: where content will go (empty now).
