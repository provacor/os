# Provacor — working notes for Claude

The owner writes in Bengali; reply in Bengali.

## Chapter content generation (owner's master rule)

Every time the owner sends material for a chapter:

1. Identify the **subject** and **chapter**.
2. Identify which **sources** were given: **Notes**, a **Combined Chapter PDF**, or both.
3. Unlock content by source, then build **only** what is unlocked.

### Unlock rule

| Sources given | What to build |
|---|---|
| Notes + Combined Chapter PDF | All 14 contents of that subject (below). |
| Combined Chapter PDF only | Only these 5: MCQ, Creative / CQ, ক, খ, Formula. Nothing else. |
| Notes only | The notes workflow below (Notes + mind map + simulations). |
| Neither | Build nothing. Never invent content. |

When both sources are given, read the Notes first, then the Combined PDF. Merge them without
dropping anything important from either, and cut unnecessary duplication.

### The 14 contents per subject (= the section templates in `data/section-templates.json`)

- **Physics:** Notes, MCQ, Creative / CQ, ক, খ, Formula, Concepts, Derivation, Numerical, Graph,
  Diagram, Simulation, Mistake Bank, Revision
- **Chemistry:** Notes, MCQ, Creative / CQ, ক, খ, Formula, Concepts, Reaction, Conversion,
  Mechanism, Identification Test, Simulation, Mistake Bank, Revision

Never mix the subject-specific contents:
- Derivation, Numerical, Graph and Diagram belong to Physics only.
- Reaction, Conversion, Mechanism and Identification Test belong to Chemistry only.

(Progress is computed by the app and is not content.)

### Strict / no-hallucination rules

- Build only unlocked contents. Never add a new category or section, and never put one
  content in another's place.
- If a content has no source material, leave it empty. Do not guess or pad it out.
- Never invent formulas, reactions, board questions, board names or years, question numbers,
  numerical data, book facts, or teacher quotes that are not in the source.
- Final rule: as much source as there is, that much work; as much as is unlocked, that much content.
- Never show the name of a book, guide, digest, lecture series or PDF that the notes/PDFs were made
  from, anywhere in the app (no `source` field on items, no book names in titles or text).

### Notes workflow (Notes given)

1. **Notes:** add the PDF to `content/files/<chapterId>_notes/` and an item to
   `content/<subject>/<chapterId>_notes.json`, then register the section in `content/index.json`.
2. **Mind map:** read the notes and build `content/mindmaps/<chapterId>.json`
   (`{chapterId, source, updated, note, root:{id,text,hint?,children}}`), then register it in
   `content/mindmaps/index.json`. Formulas must follow the notes' own sign conventions, and
   corrections printed in the notes must be applied.
3. **Simulations:** build as many interactive simulations as the notes allow, one for every
   formula or phenomenon that can be shown visually.
   - Put them in one self-contained HTML lab at
     `content/files/<chapterId>_simulation/<name>-lab.html`.
   - The lab needs tabs, sliders, live readouts of the notes' formulas, a Bengali UI,
     light/dark support, and no external requests.
   - Add an item (`format: "html"`) to `content/<subject>/<chapterId>_simulation.json` and
     register the section in `content/index.json`.
   - Examples: `content/files/physics_1st_ch09_simulation/wave-lab.html` and
     `content/files/physics_2nd_ch07_simulation/physical-optics-lab.html`.
   - If the topic has nothing that can be simulated, skip this step and say so.

### Shipping

After adding or changing chapter content, run `node tools/build-toc.mjs` to rebuild the topic-wise contents (`content/toc.json`, the সূচিপত্র on each chapter page: every item placed under its topic). Then run `node tools/validate.mjs` (it fails if an item sits under no topic). Open any new lab in headless Chromium and click every tab
(there must be no JS errors). Then ship through the usual flow: branch → PR → squash-merge.
