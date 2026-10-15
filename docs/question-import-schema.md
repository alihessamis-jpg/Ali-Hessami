# Question import JSON schema

Used by Library → "Import questions" to load a chapter's exam questions
into Board Questions, linked to that chapter the same way flashcards are
(`chapter_id`). Convert a department exam (usually a `.docx` with the
correct answer highlighted) into this shape, then import it from the
Library page.

## Top level

```json
{
  "chapter_number": 73,
  "chapter_title": "Anemia in Chronic Kidney Disease",
  "chapter_title_fa": "کم‌خونی در بیماری مزمن کلیه (CKD)",
  "book": "Pediatric Nephrology (textbook)",
  "source": "آزمون درون‌بخشی فلوشیپ نفرولوژی کودکان",
  "source_file": "CKD_Anemia_73_with_answers.docx",
  "language": "fa",
  "questions": [ ... ]
}
```

- `chapter_number` (required) — used to auto-select the matching chapter in
  the import preview (you can still override it there).
- `chapter_title_fa` (or `chapter_title` if absent) becomes the question's
  `topic` string, so it groups correctly with everything else that keys off
  chapter title (Board Readiness, Dashboard).
- `source` — a short label distinguishing where the questions came from
  (e.g. `"آزمون درون‌بخشی فلوشیپ نفرولوژی کودکان"` for an in-house exam vs.
  something else for AI-suggested or other question banks). Lets you filter
  "my department's exam questions" apart from everything else.
- `source_file` — the original file name. Combined with the chapter and a
  question's `number`, this makes re-importing the same file idempotent
  (upsert instead of duplicate) — see "Idempotent re-import" below.

## Each item in `questions`

Common to every type:

```json
{
  "number": 1,
  "type": "mcq" | "true_false" | "essay",
  "stem": "...",
  "explanation": "...",      // optional, shown after answering
  "answer_verified": true,   // optional, default true -- set false if the
                              // original key didn't clearly mark an answer
  "note": "..."               // optional, free text (e.g. why unverified)
}
```

- `number` must be unique within the file — it's part of the idempotent
  import key, and a duplicate is flagged in the preview as an error.
- `stem` keeps its line breaks (e.g. multi-line lab values) — rendered with
  `white-space: pre-line`, RTL/LTR auto-detected.

### `mcq`

```json
{
  "type": "mcq",
  "options": [
    { "key": "الف", "text": "..." },
    { "key": "ب", "text": "..." },
    { "key": "ج", "text": "..." },
    { "key": "د", "text": "..." }
  ],
  "correct": "ب"
}
```

- `options[].key` can be any short label (الف/ب/ج/د, or 1/2/3/4 like
  question 12 in the chapter-73 example, where the stem itself lists what's
  being counted). The imported option text is stored as `"<key>) <text>"`
  so the original label always shows.
- `correct` must match one `options[].key` exactly, or the row is flagged
  in the preview and can't be imported until fixed.

### `true_false`

```json
{
  "type": "true_false",
  "correct": true
}
```

### `essay`

```json
{
  "type": "essay",
  "model_answer": "..."
}
```

No auto-grading — the model answer is revealed after you write your own,
then you self-grade (correct / wrong), same as the existing fill-in-the-blank
flow.

## `answer_verified: false`

Set this when the original answer key didn't clearly mark a correct answer
and you had to guess. The app shows an "answer not verified" badge on that
question (in practice and in the question bank) until someone edits and
saves it — which clears the flag automatically. MCQ questions can be edited
in Board Questions → Manage questions; true_false/essay questions aren't
editable in the UI yet (fix their JSON and re-import instead).

## Idempotent re-import

Each question's import key is `"<chapterId>:<source_file>:<number>"`.
Re-importing the same file (even after editing some answers in the JSON)
updates the existing rows instead of creating duplicates. Manually-created
questions (made in the app, not imported) never have an import key and are
unaffected.
