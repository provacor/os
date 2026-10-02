# SYLLABUS STRUCTURE AUDIT

> Phase: **Structure only**. No content is created here.
> Rule: every chapter name must come word-for-word from the uploaded syllabus images. Nothing is guessed.

## 0. Source status: ⚠️ NO SYLLABUS IMAGES RECEIVED

When this audit was written (2026-10-02), **no syllabus image or file was present**: not in the repository, and not attached to the session. The repo held only `README.md` and `.gitignore`.

So:

- **Subjects and papers** come from the project brief and are recorded below (confidence: high, source = brief).
- **Chapters of Higher Math, Physics, Chemistry and Biology are left EMPTY.** No chapter name, number or count was made up. Every one is `[NEEDS VERIFICATION]`.
- **English 2nd Paper grammar items**: the 7 items below are the examples listed in the project brief. The brief says that list is *not* final. They are kept as provisional units, flagged `[VERIFY FROM SOURCE]`, until checked against the image.
- **Exam / cycle grouping** (অর্ধ-বার্ষিক, বার্ষিক, প্রাক-নির্বাচনী, নির্বাচনী): the metadata fields exist on every chapter, but all are `null` (unknown) until read from the images.

**Next step:** upload the syllabus images (commit them to `docs/syllabus-source/`, or attach them to the session). Each chapter is then added to `data/chapters.json` with `source.image`, `source.wording`, `confidence`, and its exam flags, and this table is filled in.

Confidence scale: **high** = read clearly from the source · **medium** = readable but some doubt · **low** = not read from the image · **none** = no source.

---

## 1. Subjects

| # | Subject | ID | Source | Confidence |
|---|---------|----|--------|------------|
| 1 | English (2nd Paper only) | `english` | Project brief | High |
| 2 | Higher Mathematics | `higher_math` | Project brief | High |
| 3 | Physics | `physics` | Project brief | High |
| 4 | Chemistry | `chemistry` | Project brief | High |
| 5 | Biology | `biology` | Project brief | High |

English 1st Paper is **intentionally excluded**, as the brief requires.

## 2. Papers

| Subject | Paper | ID | Source | Chapter list |
|---------|-------|----|--------|--------------|
| English | 2nd Paper | `english_2nd` | Project brief | Provisional (see §3.1) |
| Higher Mathematics | 1st Paper | `higher_math_1st` | Project brief | [NEEDS VERIFICATION] |
| Higher Mathematics | 2nd Paper | `higher_math_2nd` | Project brief | [NEEDS VERIFICATION] |
| Physics | 1st Paper | `physics_1st` | Project brief | [NEEDS VERIFICATION] |
| Physics | 2nd Paper | `physics_2nd` | Project brief | [NEEDS VERIFICATION] |
| Chemistry | 1st Paper | `chemistry_1st` | Project brief | [NEEDS VERIFICATION] |
| Chemistry | 2nd Paper | `chemistry_2nd` | Project brief | [NEEDS VERIFICATION] |
| Biology | 1st Paper | `biology_1st` | Project brief | [NEEDS VERIFICATION] |
| Biology | 2nd Paper | `biology_2nd` | Project brief | [NEEDS VERIFICATION] |

## 3. Chapters

Columns: **Subject · Paper · Chapter · Source Image · Source wording · Confidence**, plus exam coverage (HY = অর্ধ-বার্ষিক, AN = বার্ষিক, PS = প্রাক-নির্বাচনী, S = নির্বাচনী).

### 3.1 English: 2nd Paper → Grammar (provisional)

| Subject | Paper | Unit (ID) | Source Image | Source wording | Confidence | HY | AN | PS | S |
|---------|-------|-----------|--------------|----------------|------------|----|----|----|---|
| English | 2nd | Preposition (`english_2nd_preposition`) | — | [VERIFY FROM SOURCE] | Low (from brief) | ? | ? | ? | ? |
| English | 2nd | Right Form of Verbs (`english_2nd_right_form_of_verbs`) | — | [VERIFY FROM SOURCE] | Low (from brief) | ? | ? | ? | ? |
| English | 2nd | Completing Sentence (`english_2nd_completing_sentence`) | — | [VERIFY FROM SOURCE] | Low (from brief) | ? | ? | ? | ? |
| English | 2nd | Narration / Speech (`english_2nd_narration`) | — | [VERIFY FROM SOURCE] | Low (from brief) | ? | ? | ? | ? |
| English | 2nd | Sentence Connectors (`english_2nd_sentence_connectors`) | — | [VERIFY FROM SOURCE] | Low (from brief) | ? | ? | ? | ? |
| English | 2nd | Antonym / Synonym (`english_2nd_antonym_synonym`) | — | [VERIFY FROM SOURCE] | Low (from brief) | ? | ? | ? | ? |
| English | 2nd | Punctuation (`english_2nd_punctuation`) | — | [VERIFY FROM SOURCE] | Low (from brief) | ? | ? | ? | ? |
| English | 2nd | *Other grammar items in the image* | — | [NEEDS VERIFICATION] | None | | | | |

### 3.2 Higher Mathematics

| Subject | Paper | Chapter | Source Image | Source wording | Confidence |
|---------|-------|---------|--------------|----------------|------------|
| Higher Mathematics | 1st | [NEEDS VERIFICATION] | not received | — | None |
| Higher Mathematics | 2nd | [NEEDS VERIFICATION] | not received | — | None |

### 3.3 Physics

| Subject | Paper | Chapter | Source Image | Source wording | Confidence |
|---------|-------|---------|--------------|----------------|------------|
| Physics | 1st | [NEEDS VERIFICATION] | not received | — | None |
| Physics | 2nd | [NEEDS VERIFICATION] | not received | — | None |

### 3.4 Chemistry

| Subject | Paper | Chapter | Source Image | Source wording | Confidence |
|---------|-------|---------|--------------|----------------|------------|
| Chemistry | 1st | [NEEDS VERIFICATION] | not received | — | None |
| Chemistry | 2nd | [NEEDS VERIFICATION] | not received | — | None |

### 3.5 Biology

| Subject | Paper | Chapter | Source Image | Source wording | Confidence |
|---------|-------|---------|--------------|----------------|------------|
| Biology | 1st | [NEEDS VERIFICATION] | not received | — | None |
| Biology | 2nd | [NEEDS VERIFICATION] | not received | — | None |

## 4. Exam / cycle grouping

| Exam | Bangla (source term) | Metadata key | Status |
|------|----------------------|--------------|--------|
| Half-Yearly | অর্ধ-বার্ষিক | `half_yearly` | Field ready, values unknown |
| Annual | বার্ষিক | `annual` | Field ready, values unknown |
| Pre-Selection | প্রাক-নির্বাচনী | `pre_test` | Field ready, values unknown |
| Selection | নির্বাচনী | `test` | Field ready, values unknown |

If the images show other groupings, add them to `data/exams.json`. Nothing else needs to change.

## 5. How to record a chapter once the image is available

```json
{
  "id": "physics_1st_ch01",
  "paperId": "physics_1st",
  "kind": "chapter",
  "number": 1,
  "order": 1,
  "name": "<exact wording from the image>",
  "topics": ["<topic as written>", "..."],
  "exams": { "half_yearly": true, "annual": true, "pre_test": null, "test": null },
  "source": { "image": "docs/syllabus-source/physics-1st.jpg", "wording": "<exact text as printed>", "origin": "syllabus_image" },
  "confidence": "high",
  "verification": "verified"
}
```

`node tools/validate.mjs` refuses `verified` unless `source.image` and `source.wording` are filled in.
