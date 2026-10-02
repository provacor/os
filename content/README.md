# content/

This folder is empty in the structure phase. Content arrives later, one section at a time.

## Layout

```
content/
├── index.json                         registry: sectionId → { file, count }
└── <subjectId>/<sectionId>.json       one file per section
```

## Section file format

```json
{
  "sectionId": "physics_1st_ch03_mcq",
  "updated": "YYYY-MM-DD",
  "items": [
    {
      "id": "physics_1st_ch03_mcq_0001",
      "kind": null,
      "...": "fields listed under itemFields for this section type in data/section-types.json"
    }
  ]
}
```

- `id`: `<sectionId>_<NNNN>`. Never reuse or renumber an ID, because progress and mistake-bank entries point to it.
- `kind`: one of the section type's `contentKinds`, for example `short` for Short Notes. Use `null` when the type has no kinds.

## Registry entry

```json
"physics_1st_ch03_mcq": { "file": "content/physics/physics_1st_ch03_mcq.json", "count": 25 }
```

Then run `node tools/validate.mjs`.
