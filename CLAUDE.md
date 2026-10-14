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

### Game Zone (automatic — owner's standing request)

Every chapter's content is also playable in the Game Zone (`#/games`). The owner has asked once for all
time: whatever can be turned into a game must be. That covers MCQs and also short-answer content
(ক questions, "এক কথায় প্রকাশ" definitions), concepts, formulas, reactions, tests, mistakes,
figures and mind maps. Do this for every new chapter and subject (English, math, physics,
chemistry, biology…) without being asked again.

- Games are generated from the content by `assets/js/gamedata.js`. Nothing is written by hand and
  nothing is invented: questions, answers and wrong options are all text that already exists in the
  chapter.
- To make new content playable, keep the standard item shapes:
  - `question`+`answer` (ক/খ)
  - `title`+`body` (concepts)
  - `formulas`+`symbols` (formula)
  - `formulas` (reaction)
  - `steps` (derivation/mechanism/conversion)
  - `ভুল:`/`সঠিক:` lines (mistakes)
  - `বিকারক/পরীক্ষা:`/`পর্যবেক্ষণ:`/`সিদ্ধান্ত:` lines (identification)
  - `figure` (graph/diagram)
  - mind map nodes with `hint`
- A chapter that only has notes still gets games from its mind map (its branches become the topics).
- If a new section type or item shape appears that `gamedata.js` doesn't turn into questions yet,
  extend `gamedata.js` in the same change, rather than leaving that content out of the games.
- After shipping content, open `#/games/<chapterId>` and check that the new content shows up as
  game sources.
- The new game zone (`#/arena`, 12 games in `assets/js/arena/`) reads the same `gamedata.js`, so a new
  chapter appears there automatically, topic by topic and for every content type. Also open
  `#/arena/kingdom/<chapterId>` to check it.
- Both zones share one learning store (`assets/js/learnstore.js`): mastery is two right answers in a
  row, XP and coins are paid once per question per day, and one-time rewards are claimed by key. Keep
  it that way so replays never pay twice.

### Shipping

After adding or changing chapter content, run `node tools/build-toc.mjs` to rebuild the topic-wise contents (`content/toc.json`, the সূচিপত্র on each chapter page: every item placed under its topic). Then run `node tools/validate.mjs` (it fails if an item sits under no topic). Open any new lab in headless Chromium and click every tab
(there must be no JS errors). Then ship through the usual flow: branch → PR → squash-merge.
