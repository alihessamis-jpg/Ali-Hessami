# Harriet Lane formulary in Nephron (Reference → Drug dosing)

Source: *The Harriet Lane Handbook*, 23rd ed. (Elsevier, 2023), user's own copy, pages 735–1208.

## What is imported
- **Chapter 30 — Drug Dosages:** 498 monographs (one `drug_reference` row each, `source_key = 'hl23:<slug>'`):
  trade names, drug class, how supplied, the full dosing text (neonate / infant / child / adult, max doses, tables),
  remarks, pregnancy / breastfeeding categories, kidney / liver / pharmacogenomic flags, page numbers (`{p.N}` markers).
  Extracted helper columns: `neonatal_dose`, `meningitis_dose`, `interactions`, `renal_notes`.
- **Chapter 31 — Drugs in Kidney Failure:** Tables 31.1 and 31.2 (119 entries) transcribed from the page images into
  `renal_adjustment` (jsonb) and attached to the matching monograph (4 drugs without a Ch. 30 monograph get their own row).
- **Library:** a new book "The Harriet Lane Handbook" (slug `harriet-lane-23e`) with Ch. 30 front matter (categories,
  BSA, trade → generic drug index, CYP450 Table 30.1) and Ch. 31 (methods, eGFR, both tables) — indexed for the assistant.

Not in the provided PDF: monographs the 23rd edition publishes online only (e.g. procainamide, penicillamine, kanamycin),
Ch. 28 lab values and Ch. 29 (not imported: the PDF text lost the range dashes there).

## Install (Supabase SQL editor, in order)
1. `harriet_lane_reference_migration.sql`
2. `seeds/harriet_lane/01_drug_reference.sql` … `06_drug_reference.sql` (kept out of this public repo — book text)
3. `seeds/harriet_lane/07_library_chapters.sql`
4. Redeploy the edge function: `supabase functions deploy assistant`

All files are idempotent (upsert on `(owner_id, source_key)` / `(book_id, chapter_number)`).

## Assistant
- `drug_reference(medication, section)` returns the full monograph + Ch. 31 rows, labelled with book and pages.
- `search_formulary(terms)` searches inside every monograph (indications, interactions between two drugs, neonatal…).
- The system prompt requires a page citation for every dose and an interaction check across the patient's drugs.

## Dose calculator (`src/lib/doseCalc.ts`)
Arithmetic only on numbers printed on the same line: dose/kg × weight (or /m² × Mosteller BSA), split by ÷ Qn hr /
BID/TID/QID, compared with a max dose stated on that line. eGFR from SCr uses bedside CKiD 0.413 × height / SCr.
Renal rows matching the eGFR (or IHD / PD) are highlighted.

Known text-extraction limits: complex multi-column tables inside monographs are kept as monospace blocks; a few
minus signs inside formulas were lost in the PDF text. Always confirm against the cited page before prescribing.
