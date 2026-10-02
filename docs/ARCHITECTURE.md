# HSC Science Study OS: structure and architecture

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
English 2nd Paper has one group, **Grammar**. Each grammar item is a unit.

## 3. Chapters

No chapter lists exist yet. See [`SYLLABUS_STRUCTURE_AUDIT.md`](../SYLLABUS_STRUCTURE_AUDIT.md): no syllabus images were received, so nothing was invented.
English has 7 provisional grammar units, taken from the brief and flagged `VERIFY FROM SOURCE`.

## 4. Section structure (per chapter)

Defined in `data/section-templates.json`. Each subject picks one template. Changing a template changes every chapter of that subject.

| Template | Sections (in order) |
|----------|---------------------|
| `physics` | Notes · MCQ · Creative/CQ · Formula · Concepts · Derivation · Numerical · Graph · Diagram · Simulation · Mistake Bank · Revision · Progress |
| `chemistry` | Notes · MCQ · Creative/CQ · Formula / Equation · Concepts · Reaction · Conversion · Mechanism · Identification Test · Simulation · Mistake Bank · Revision · Progress |
| `higher_math` | Notes · MCQ · Creative/CQ · Formula · Concepts · Theorem · Problem Types · Graph · Solved Problems · Simulation · Mistake Bank · Revision · Progress |
| `biology` | Notes · MCQ · Creative/CQ · Concepts · Definition · Diagram · Process · Comparison · Classification · Simulation / Interactive Diagram · Mistake Bank · Revision · Progress |
| `english_grammar_unit` | Notes · Practice · MCQ · Board Questions · Mistakes · Revision · Progress |
| `default` | Notes · MCQ · Creative/CQ · Formula · Concepts · Simulation · Mistake Bank · Revision · Progress |

Template decisions (each is one line to change in `data/section-templates.json`):

- Every template has the core trio **Notes, MCQ, Creative/CQ**. English grammar units use the brief's own list (Notes, Practice, MCQ, Board Questions, Mistakes, Revision), which has no CQ.
- The general list (brief §5–6) adds **Concepts** and **Progress** to every chapter. The subject-specific lists (§11–14) leave them out, so they are added to each subject list.
- **Biology has no Formula section**, because the Biology list in brief §14 does not include one.

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
| English unit | `<paper>_<slug>` | `english_2nd_preposition` |
| Section | `<chapter>_<type>` | `physics_1st_ch01_notes`, `physics_1st_ch01_mcq`, `physics_1st_ch01_cq` |
| Content item | `<section>_<NNNN>` | `physics_1st_ch01_mcq_0001` |

Sections are **not stored one by one**. They are generated from the subject's template, so there is no `sections.json` with thousands of repeated rows, and adding a section type to a template adds it to every chapter. The IDs are still deterministic and stable.

**Chapter record**: `id, paperId, groupId?, kind, number, order, name, topics[], exams{half_yearly,annual,pre_test,test: true|false|null}, source{image,wording,origin}, confidence, verification`.
The exam grouping is **metadata only**. The navigation hierarchy is never split by exam.

**Progress**: each trackable section stores a 0–100 value on the device (`localStorage`, key `hscos:progress:v1`). Chapter = average of its trackable sections. Paper = average of its chapters. Subject = average of all its chapters. Everything shows 0% now.

**Content counts**: come from `content/index.json` (empty now), so "Content Added" on the dashboard is 0.

**Validation**: `node tools/validate.mjs` checks ID patterns and uniqueness, parent references, templates, the core sections, that no English 1st Paper exists, that every verified chapter has a source, and that every content registry key is a real section. It uses the same `buildModel()` as the app.

## 6. Folder structure

```
/
├── index.html                  App shell (header, breadcrumb, view, bottom nav)
├── manifest.webmanifest        Installable on Android ("Add to Home screen")
├── sw.js                       Offline cache (network-first)
├── icon.svg
├── SYLLABUS_STRUCTURE_AUDIT.md Chapter-by-chapter source audit
├── data/                       ← STRUCTURE (edit these, not the UI code)
│   ├── subjects.json
│   ├── papers.json
│   ├── chapters.json
│   ├── section-types.json
│   ├── section-templates.json
│   └── exams.json
├── content/                    ← CONTENT (empty in this phase)
│   ├── index.json              sectionId → { file, count }
│   └── README.md               content file format
├── assets/
│   ├── css/app.css             Design tokens, light/dark, mobile-first
│   └── js/
│       ├── model.js            JSON → Subject/Paper/Chapter/Section tree (pure)
│       ├── progress.js         Progress framework
│       ├── search.js           Global structure search
│       └── app.js              Router + views + accordion
├── docs/ARCHITECTURE.md        This file
└── tools/
    ├── validate.mjs            Structure integrity check
    └── serve.mjs               Zero-dependency local server
```

The app is plain HTML/CSS/ES modules with no build step and no dependencies, so it loads fast on a phone and can be hosted directly on GitHub Pages.

## 7. UI navigation

```
Bottom nav:  🏠 Home   🔍 Search   📊 Progress   📋 Syllabus

Home  #/
 └─ Subject card (papers · chapters · content · done %)
     └─ Paper screen  #/p/<paperId>          ← paper tabs: [1st Paper | 2nd Paper]
         └─ Chapter accordion  #/p/<paperId>/<chapterId>   (one open at a time)
             ├─ progress bar, exam-coverage chips, topics
             └─ Section tiles (Notes, MCQ, CQ, …)
                 └─ Section screen  #/x/<sectionId>
                     ├─ sibling-section chip row (switch with one tap)
                     ├─ empty state: "Content not added yet" + [+ Add Content]
                     └─ future categories (all 0) + planned item fields
```

- A breadcrumb is shown on every screen below Home, for example `Home › Physics › 1st Paper › Ch 1 › Notes`.
- Every screen has a deep link, so the Android back button works.
- Dark/light mode follows the system setting, with a manual toggle that is remembered.
- Touch targets are at least 44px, there is no horizontal page overflow at 360px width, and reduced-motion is respected.

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
