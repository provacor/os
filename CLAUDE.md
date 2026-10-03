# Provacor — working notes for Claude

The owner writes in Bengali; reply in Bengali.

## Standing rule: when the owner sends notes for a chapter/topic

Do all of the following automatically, without being asked again:

1. **Notes** — add the PDF to `content/files/<chapterId>_notes/` and an item to
   `content/<subject>/<chapterId>_notes.json`; register the section in `content/index.json`.
2. **Mind map** — read the notes and build `content/mindmaps/<chapterId>.json`
   (`{chapterId, source, updated, note, root:{id,text,hint?,children}}`), then register it in
   `content/mindmaps/index.json`. Formulas must follow the notes' own sign conventions.
3. **Simulations** — read the notes and build as many interactive simulations as the topic
   allows (every formula/phenomenon that can be shown visually). Put them in one self-contained
   HTML lab at `content/files/<chapterId>_simulation/<name>-lab.html` (tabs, sliders, live
   readouts of the notes' formulas, Bengali UI, light/dark support, no external requests), add
   an item (`format: "html"`) to `content/<subject>/<chapterId>_simulation.json`, and register
   the section in `content/index.json`. Example: `content/files/physics_1st_ch09_simulation/wave-lab.html`.
   Skip only when the topic genuinely has nothing simulatable, and say so.

Then run `node tools/validate.mjs`, open the lab in headless Chromium and click every tab
(no JS errors), and ship via the usual branch → PR → squash-merge flow.
