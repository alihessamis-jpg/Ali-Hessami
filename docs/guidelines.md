# Academy → Guidelines

Clinical practice guidelines sit in the Academy's **Guidelines** tab
(`/academy?tab=guidelines`). They are stored in the same library tables as
textbooks: one `library_books` row with `kind = 'guideline'` (plus
`organization`, `doc_status`, `citation`, `scope`, `summary`, `highlights`,
`pdf_path`) and ordinary `library_chapters` rows.

Because guideline chapters are ordinary chapters, the `library_chunks`
triggers index them, so the assistant's `search_library` and `read_section`
tools search the full guideline text. The Reader, highlights, cards and the
"Ask AI" chips also work on them unchanged.

Run [`guidelines_migration.sql`](../guidelines_migration.sql) once to add the
columns.

## Guideline package (`nephron-guidelines/1`)

Content is imported from a JSON file with **Import guideline package** on the
Guidelines tab. The file is not stored in this repository, because guideline
text is copyrighted.

```json
{
  "format": "nephron-guidelines/1",
  "guidelines": [
    {
      "slug": "kdigo-2026-aki-akd-draft",
      "title": "…",
      "edition": "…",
      "publisher": "…",
      "year": 2026,
      "total_pages": 499,
      "organization": "KDIGO",
      "doc_status": "Public review draft",
      "citation": "…",
      "scope": "…",
      "summary": "Persian one-paragraph overview",
      "highlights": [{ "label": "…", "text": "…", "tone": "pearl|flag|info" }],
      "chapters": [
        {
          "part_roman": "A",
          "part_title": "تحلیل و نکات کلیدی (Nephron)",
          "chapter_number": 1,
          "title": "…",
          "subtitle": "…",
          "language": "fa",
          "direction": "rtl",
          "start_page": 1,
          "end_page": 34,
          "note": "markdown in the usual chapter-note format"
        }
      ]
    }
  ]
}
```

- Part `A` is Nephron's Persian analysis. The **تحلیل و نکات کلیدی** button and
  the AI chips open it. The other parts are the original text.
- Put `{p.N}` page markers in notes. The chunker stores them as each
  passage's page range, and the assistant cites those pages.
- Re-importing a package with the same `slug` updates the book and matches
  chapters by `chapter_number`, so reading progress and cards are kept.
- **Attach PDF** stores the original PDF at
  `chapter-figures/<userId>/guidelines/<bookId>.pdf`.
