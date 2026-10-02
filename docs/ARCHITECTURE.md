# Provacor: structure and architecture

This covers the seven "first deliverable" items: subjects, papers, chapters, section structure, data architecture, folder structure and UI navigation.

## 1. Subjects

| Icon | Subject | ID | Papers |
|------|---------|----|--------|
| 📘 | English | `english` | 2nd Paper only |
| 📐 | Higher Mathematics | `higher_math` | 1st, 2nd |
| ⚡ | Physics | `physics` | 1st, 2nd |
| 🧪 | Chemistry | `chemistry` | 1st, 2nd |
| 🧬 | Biology | `biology` | 1st, 2nd |

## 2. Papers

`english_2nd`, `higher_math_1st`, `higher_math_2nd`, `physics_1st`, `physics_2nd`, `chemistry_1st`, `chemistry_2nd`, `biology_1st`, `biology_2nd`.
English 2nd Paper has one group, **Grammar Topics**. Each topic works like a chapter.

## 3. Chapters

Extracted from the syllabus images in `docs/syllabus-source/`. The full list, with source wording and confidence for each, is in [`SYLLABUS_STRUCTURE_AUDIT.md`](../SYLLABUS_STRUCTURE_AUDIT.md).

| Paper | Chapters |
|-------|----------|
| English 2nd Paper | 10 Grammar Topics (Article added by the user) |
| Higher Math 1st / 2nd | 10 / 10 (2nd Paper chapter 5 was supplied by the user, not the image) |
| Physics 1st / 2nd | 10 / 11 |
| Chemistry 1st / 2nd | 5 / 5 |
| Biology 1st (উদ্ভিদবিজ্ঞান) / 2nd (প্রাণিবিজ্ঞান) | 12 / 12 |

All chapters of a paper sit together under that paper. **Exam groupings (অর্ধ-বার্ষিক / বার্ষিক / প্রাক-নির্বাচনী / নির্বাচনী) are ignored completely.** They are not stored and not shown. A chapter that the source repeats in several exam columns is recorded once.

## 4. Section structure (per chapter)

Defined in `data/section-templates.json`. Each subject picks one template. Changing a template changes every chapter of that subject.

Every science chapter gets the **core** sections: Notes · MCQ · Creative/CQ · Formula · Concepts · Simulation · Mistake Bank · Revision · Progress. The subject's extra sections go between Concepts and Simulation.

| Template | Sections (in order) |
|----------|---------------------|
| `physics` | Notes · MCQ · Creative/CQ · Formula · Concepts · **Derivation · Numerical · Graph · Diagram** · Simulation · Mistake Bank · Revision · Progress |
| `higher_math` | Notes · MCQ · Creative/CQ · Formula · Concepts · **Theorem · Problem Types · Solved Problems · Graph** · Simulation · Mistake Bank · Revision · Progress |
| `chemistry` | Notes · MCQ · Creative/CQ · Formula · Concepts · **Reaction · Conversion · Mechanism · Identification Test** · Simulation · Mistake Bank · Revision · Progress |
| `biology` | Notes · MCQ · Creative/CQ · Formula · Concepts · **Definition · Diagram · Process · Comparison · Classification** · Interactive Diagram / Simulation · Mistake Bank · Revision · Progress |
| `english_grammar_topic` | Notes · Rules · Examples · Practice · MCQ · Board Questions · Mistake Bank · Revision · Progress |
| `default` | the core list |

`node tools/validate.mjs` fails if a science template is missing any core section.

Each section type (`data/section-types.json`) also defines:

- `screenTitle` / `emptyText`: for example "Chapter Notes" / "No notes added yet." and "Chapter MCQ" / "No MCQ added yet."
- `contentKinds`: the future sub-categories. Notes: Full, Short, Revision, Important Points, Diagram, Formula, Example. CQ: CQ, Board, Model, Concept-based, Question Pattern, Solution, Mark Distribution.
- `itemFields`: the future item metadata. MCQ: question, options, correctAnswer, explanation, source, board, year, difficulty, topic, chapter. Formula: formula, symbolMeaning, unit, condition, relatedConcept, example.
- `trackable` (counts toward progress) and `computed` (the Progress section is calculated, not filled with content).

## 5. Data architecture

```
Subject ──< Paper ──< Chapter ──< Section ──< Content item
(subjects.json) (papers.json) (chapters.json) (generated from   (content/<subject>/<sectionId>.json,
                                               template + type)   registered in content/index.json)
```

**Stable IDs**: built only from their parents, never from display names.

| Level | Pattern | Example |
|-------|---------|---------|
| Subject | `<subject>` | `physics` |
| Paper | `<subject>_<1st\|2nd>` | `physics_1st` |
| Chapter | `<paper>_ch<NN>` | `physics_1st_ch01` |
| English topic | `<paper>_<slug>` | `english_2nd_preposition` |
| Section | `<chapter>_<type>` | `physics_1st_ch01_notes`, `physics_1st_ch01_mcq`, `physics_1st_ch01_cq` |
| Content item | `<section>_<NNNN>` | `physics_1st_ch01_mcq_0001` |

Sections are **not stored one by one**. They are generated from the subject's template, so there is no `sections.json` with thousands of repeated rows, and adding a section type to a template adds it to every chapter. The IDs are still deterministic and stable.

**Chapter record**: `id, paperId, groupId?, kind, number, order, name, topics[], source{image,wording,origin}, confidence, verification, note?`. There is no exam field. Chemistry has no printed chapter numbers, so `number` is `null` and `order` follows the source list. Its IDs still use `chNN` from that order.

**Progress**: each trackable section stores a 0–100 value on the device (`localStorage`, key `hscos:progress:v1`). Chapter = average of its trackable sections. Paper = average of its chapters. Subject = average of all its chapters. Everything shows 0% now.

**Content counts**: come from `content/index.json` (empty now), so "Content Added" on the dashboard is 0.

**Validation**: `node tools/validate.mjs` checks ID patterns and uniqueness, parent references, templates, the core sections, that no English 1st Paper exists, that every verified chapter has a source, and that every content registry key is a real section. It uses the same `buildModel()` as the app.

## 6. Folder structure

```
/
├── index.html                  App shell: splash, top bar, breadcrumb, view, bottom nav
├── manifest.webmanifest        Installable on Android ("Add to Home screen")
├── sw.js                       Offline cache (network-first)
├── SYLLABUS_STRUCTURE_AUDIT.md Chapter-by-chapter source audit
├── data/                       ← STRUCTURE (edit these, not the UI code)
├── content/                    ← CONTENT (section JSON + attached PDFs / simulations)
├── assets/
│   ├── css/app.css             Design system: tokens (dark-first + light), subject identity, motion, components
│   └── js/
│       ├── model.js            JSON → Subject/Paper/Chapter/Section tree (pure, shared with tools/)
│       ├── progress.js         Completion state + progress math
│       ├── activity.js         Real usage history: recent chapters, daily activity, streak, recent searches
│       ├── search.js           Search index over structure + content
│       ├── theme.js            Dark / light / system theme
│       ├── icons.js            SVG icon set (subjects, section types, UI)
│       ├── components.js       ProgressRing, ProgressBar, Breadcrumb, EmptyState, Skeleton, SubjectCard, ChapterCard, SectionCard
│       ├── app.js              Boot, router, page transitions, interactions (AppShell)
│       └── views/              home, study (subject / chapter / curriculum map), section, search, progress, more
├── docs/ARCHITECTURE.md        This file
└── tools/                      validate.mjs, serve.mjs
```

No framework and no build step: views return HTML strings built from components, so the app loads fast on mid-range Android phones and can be hosted directly on GitHub Pages.

## 7. UI navigation

```
Bottom nav (floating, animated indicator):  Home · Search · Study · Progress · More

Home  #/                  dashboard: continue studying, real stats, recently opened, subject cards, library
 └─ Subject  #/s/<id>      hero + progress ring, collapsible papers with chapter cards
     (#/p/<paperId> opens the same page with that paper expanded)
     └─ Chapter  #/c/<id>  workspace: hero, topics, "Study now" (sections with content),
         │                 "Other sections" (empty ones, collapsed), progress, prev/next chapter
         └─ Section  #/x/<id>  sticky section tabs; items (PDF / simulation / MCQ) or empty state
Search    #/search         filters, recent searches, suggestions, grouped + highlighted results
Study     #/study          curriculum map (subject → paper → group → chapter, with status)
Progress  #/progress       overall ring, tiles, activity heatmap + streak, subject/paper/chapter progress
More      #/more           theme, syllabus source status, reset data, about
```

- Old links (`#/p/<paper>/<chapter>`, `#/syllabus`) still work.
- Every number on screen comes from real data: completions marked by the user, content in `content/`, and visits recorded on this device. Nothing is estimated.
- Motion: 150–250 ms for micro-interactions and 250–450 ms for page and fold transitions, all with ease-out curves. `prefers-reduced-motion` turns animations off.

## 8. Future content ingestion

A request maps directly to a section ID:

| Request | Resolves to |
|---------|-------------|
| "Physics 1st Paper Chapter 3-এর Notes যোগ করো" | `physics_1st_ch03_notes` |
| "Chemistry 2nd Paper Chapter X-এর MCQ যোগ করো" | `chemistry_2nd_chXX_mcq` |
| "English Preposition-এর Board Questions" | `english_2nd_preposition_board` |

If a request gives no paper (for example "Physics Chapter 3"), ask which paper before writing anything. Both papers have a Chapter 3.

Steps:

1. Write `content/<subjectId>/<sectionId>.json` (format in `content/README.md`).
2. Register it in `content/index.json` with its `count`.
3. Run `node tools/validate.mjs`.

Structure files are never touched when content is added, so new content cannot break the hierarchy.

**Search across content**: `assets/js/search.js` indexes subjects, papers, chapters, topics and sections today. When content files exist, their item text (question, title, body, formula, reaction, …) gets added to the same index. Each result already carries its full path, so a hit in an MCQ opens that chapter's MCQ section.
