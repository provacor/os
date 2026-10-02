# SYLLABUS STRUCTURE AUDIT

> Phase: **Structure only**. No content is created here.
> Rule: chapter names come word-for-word from the uploaded syllabus images. Nothing is guessed.
> Exam groupings (অর্ধ-বার্ষিক / বার্ষিক / প্রাক-নির্বাচনী / নির্বাচনী) are **ignored**. Each chapter is listed **once** under its paper, even if the source repeats it in several exam columns.

## Source status: ⚠️ no syllabus images received

As of 2026-10-02, no syllabus image or file has been provided, either in the repository or attached to the session. So:

- **Subjects and papers** come from the project brief.
- **The chapter lists for Higher Mathematics, Physics, Chemistry and Biology are empty.** No chapter name or count was made up.
- **English 2nd Paper → Grammar Topics** holds the 7 items named in the brief. The brief says the real list must come from the image, so these stay provisional.

**Next step:** provide the syllabus images (attach them to the session, or commit them to `docs/syllabus-source/`). Each chapter is then added to `data/chapters.json` and to this table.

Confidence: **High** = read clearly from the source · **Medium** = readable, some doubt · **Low** = not read from the image · **None** = no source.

| Subject | Paper | Chapter | Source wording | Confidence |
|---------|-------|---------|----------------|------------|
| English | 2nd Paper | Preposition | [NEEDS VERIFICATION]: named in brief, not yet seen in image | Low |
| English | 2nd Paper | Right Form of Verbs | [NEEDS VERIFICATION]: named in brief, not yet seen in image | Low |
| English | 2nd Paper | Completing Sentence | [NEEDS VERIFICATION]: named in brief, not yet seen in image | Low |
| English | 2nd Paper | Narration / Speech | [NEEDS VERIFICATION]: named in brief, not yet seen in image | Low |
| English | 2nd Paper | Sentence Connectors | [NEEDS VERIFICATION]: named in brief, not yet seen in image | Low |
| English | 2nd Paper | Antonym / Synonym | [NEEDS VERIFICATION]: named in brief, not yet seen in image | Low |
| English | 2nd Paper | Punctuation | [NEEDS VERIFICATION]: named in brief, not yet seen in image | Low |
| English | 2nd Paper | *other grammar topics in the source* | [NEEDS VERIFICATION] | None |
| Higher Mathematics | 1st Paper | [NEEDS VERIFICATION] | — | None |
| Higher Mathematics | 2nd Paper | [NEEDS VERIFICATION] | — | None |
| Physics | 1st Paper | [NEEDS VERIFICATION] | — | None |
| Physics | 2nd Paper | [NEEDS VERIFICATION] | — | None |
| Chemistry | 1st Paper | [NEEDS VERIFICATION] | — | None |
| Chemistry | 2nd Paper | [NEEDS VERIFICATION] | — | None |
| Biology | 1st Paper | [NEEDS VERIFICATION] | — | None |
| Biology | 2nd Paper | [NEEDS VERIFICATION] | — | None |

English 1st Paper is intentionally excluded.

## How a verified chapter is recorded (`data/chapters.json`)

```json
{
  "id": "physics_1st_ch01",
  "paperId": "physics_1st",
  "kind": "chapter",
  "number": 1,
  "order": 1,
  "name": "<exact wording from the image>",
  "topics": [],
  "source": { "wording": "<exact text as printed>", "origin": "syllabus_image" },
  "confidence": "high",
  "verification": "verified"
}
```

`node tools/validate.mjs` rejects a chapter that repeats a name already in the same paper. It also rejects any `exams` field.
