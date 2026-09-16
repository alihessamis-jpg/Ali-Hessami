# Database schema overview

This documents the relational schema in [`db/schema.sql`](../db/schema.sql), which
replaces Nephron's in-memory / `localStorage` data model with Supabase
(Postgres + Auth + RLS + Storage). Field names mirror the prototype's data
shapes (see `NEPHRON_HANDOFF.md`) so the client's TS interfaces map to rows
with minimal translation.

Tables are grouped by the handoff brief's migration phases. **Phase 1
(clinical core) is what the current app build targets**; later phases are
included in the schema now so it doesn't need revisiting per module.

## Phase 1 — Clinical core

| Prototype shape | Table | Notes |
|---|---|---|
| `patients: Patient[]` | `patients` | One row per patient, scoped by `owner_id`. The Assessment tab's history/exam fields (`chiefComplaint`, `hpi`, vitals, exam findings, etc.) are columns on this same row — the prototype stores them inline on the patient object, not in a separate table, so the schema keeps that shape. |
| `labs: { [patientId]: LabEntry[] }` | `lab_entries` | Append-only, FK to `patients`; rows are never updated in place. |
| `notes: { [patientId]: ProgressNote[] }` | `progress_notes` | SOAP fields (`S`/`O`/`A`/`P`) stored as `subjective`/`objective`/`assessment`/`plan`. |
| `meds: { [patientId]: Medication[] }` | `medications` | FK to `patients`. |
| `imaging: { [patientId]: ImagingEntry[] }` | `imaging_entries` | `dataUrl` → `storage_path`, a Supabase Storage object key resolved to a signed URL at read time. |
| Trends | *(none — derived)* | The trend charts are computed client-side from `lab_entries` grouped by `test`/`category` over `date`; no separate table. |

## Phase 2 — Reference + calculators

`drugRef` → `drug_reference`, `dialysisRef` → `dialysis_reference`. Both are
shared, read-mostly tables with no owner column and no RLS policy — every
authenticated user reads the same rows. Calculators (eGFR/BSA/BMI/fluid/dose)
are pure functions in the client, not backed by a table.

## Phase 3 — Academy + Study Hub

| Prototype shape | Table | Notes |
|---|---|---|
| `academy: AcademyTopic[]` | `academy_topics` + `academy_progress` | Split as the brief specifies: topic content (`summary`, `keyPoints`, `caseQuestions`, etc.) is shared in `academy_topics`; SRS state (`intervalIndex`, `lastReviewed`, `nextReview`, `reviewHistory`) is per-user in `academy_progress`. |
| `studyNotes: StudyNote[]` | `study_notes` | Personal, scoped by `user_id`. |
| `flashcards: Flashcard[]` | `flashcards` | Personal; keeps its own SRS columns — a separate schedule from `academy_progress`, matching the prototype. |
| `reasoningCases: ReasoningCase[]` | `reasoning_cases` | Shared content. |
| `labChallenges: LabChallenge[]` | `lab_challenges` | Shared content; `values` (`[[test, value, unit], ...]`) kept as `jsonb`. |
| `imagingChallenges: ImagingChallenge[]` | `imaging_challenges` | Mixed shared/user content: `created_by` is `null` for seed rows, set for user-added ones. `dataUrl` → `storage_path`. |
| `knowledgeGaps: KnowledgeGap[]` | `knowledge_gaps` | Personal. |
| `personalCases: PersonalCase[]` | `personal_cases` | De-identified; `source_patient_id` is nullable and `ON DELETE SET NULL` so the case survives independently of the source patient once de-identified. |

## Phase 4 — Research & Thesis Center

| Prototype shape | Table | Notes |
|---|---|---|
| `researchProjects: ResearchProject[]` | `research_projects` | Owned by `owner_id`. |
| `researchForms: { [projectId]: ResearchField[] }` | `research_fields` | Field definitions per project, ordered by `order_index`. `type` is one of the 11 field types the form builder supports. |
| `researchRecords: { [projectId]: ResearchRecord[] }` | `research_records` | `values` stored as `jsonb`, keyed by `research_fields.id`, because the field set is user-authored per project and would otherwise force a schema migration on every form edit. |

## Design decisions

- **Ownership boundary.** Patient-linked clinical tables (labs, notes, meds,
  imaging) are scoped through `patients.owner_id`; personal tables
  (study notes, flashcards, knowledge gaps, personal cases, academy
  progress, research projects) carry their own `user_id`/`owner_id`. Shared
  reference/content tables (drug/dialysis reference, academy topics,
  reasoning cases, lab challenges, seed imaging challenges) have no owner
  and no RLS — every authenticated user reads the same rows, and writes to
  them are intentionally left to migrations/seed scripts rather than the
  client.
- **RLS pattern.** Every owner-scoped table uses the same
  `owner_id = auth.uid()` (or the equivalent join through `patients`)
  policy the brief calls out as the template for every clinician-owned
  table.
- **Binary content lives in Storage, not the database.** `imaging_entries`
  and `imaging_challenges` both replace `dataUrl` with `storage_path`.
- **`research_records` stays schemaless on purpose,** for the reason given
  in the Phase 4 table above.
