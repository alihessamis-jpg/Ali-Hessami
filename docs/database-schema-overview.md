# Database schema overview

This documents the relational schema in [`db/schema.sql`](../db/schema.sql), which
replaces the app's in-memory / localStorage data model. It's written for
Postgres (Supabase conventions: `uuid` primary keys, `auth.users`, RLS
policies), but the table design applies to any relational backend.

## Mapping from the old in-memory model

| Old shape | New table(s) | Notes |
|---|---|---|
| `patients: Patient[]` | `patients` | One row per patient; `created_by` scopes it to the clinician who owns it. |
| `labs: { [patientId]: LabEntry[] }` | `lab_entries` | Append-only, FK to `patients`; never updated in place, matching "never overwritten". |
| `notes: { [patientId]: ProgressNote[] }` | `progress_notes` | SOAP fields as columns, FK to `patients`. |
| `meds: { [patientId]: Medication[] }` | `medications` | FK to `patients`. |
| `imaging: { [patientId]: ImagingEntry[] }` | `imaging_entries` | `dataUrl` → `storage_path`, a key into a Storage bucket resolved to a signed URL at read time, not stored inline. |
| `checklists: { [templateId]: { [itemIndex]: boolean } }` | `checklist_templates`, `checklist_items`, `checklist_completions` | Completion state stays per-clinician (`user_id`), not tied to a patient, matching current behavior. |
| `drugRef: DrugRefEntry[]` | `drug_reference` | Shared reference data, world-readable. |
| `dialysisRef: DialysisRefEntry[]` | `dialysis_reference` | Shared reference data, world-readable. |
| `academy: AcademyTopic[]` | `academy_topics` + `academy_progress` | Split as instructed: topic content is shared; SRS review state (`intervalIndex`, `lastReviewed`, `nextReview`, `reviewHistory`) is per-user in `academy_progress`. |
| `studyNotes: StudyNote[]` | `study_notes` | Personal, scoped by `user_id`. |
| `flashcards: Flashcard[]` | `flashcards` | Personal; keeps its own SRS columns distinct from `academy_progress` since the two decks don't share a review schedule. |
| `reasoningCases: ReasoningCase[]` | `reasoning_cases` | Shared content. |
| `labChallenges: LabChallenge[]` | `lab_challenges` | Shared content. |
| `imagingChallenges: ImagingChallenge[]` | `imaging_challenges` | Mixed shared/user content: `is_seed` flags seed rows, `created_by` is null for seed content and set for user-added rows. |
| `researchProjects: ResearchProject[]` | `research_projects` | Owned by a user (`owner_id`). |
| `researchForms: { [projectId]: ResearchField[] }` | `research_fields` | Field definitions per project, ordered by `order_index`. |
| `researchRecords: { [projectId]: ResearchRecord[] }` | `research_records` | Dynamic values kept as `jsonb`, keyed by the same field ids `research_fields` defines, since the field set is user-defined per project rather than a fixed columnar shape. |
| `knowledgeGaps: KnowledgeGap[]` | `knowledge_gaps` | Personal. |
| `personalCases: PersonalCase[]` | `personal_cases` | De-identified; `source_patient_id` is nullable and `ON DELETE SET NULL` so the case record survives independently of the source patient. |

## Design decisions

- **Ownership boundary.** Patient-linked clinical data (patients, labs, notes,
  meds, imaging) is scoped by `patients.created_by`; personal study/tracking
  data (study notes, flashcards, knowledge gaps, personal cases, checklist
  completions, academy progress, research projects) is scoped by its own
  `user_id`/`owner_id`. Shared reference/content tables (drug reference,
  dialysis reference, academy topics, reasoning cases, lab challenges, seed
  imaging challenges) carry no owner and are readable by any authenticated
  user.
- **Binary content lives in Storage, not the database.** Both `imaging_entries`
  and `imaging_challenges` replace `dataUrl` with `storage_path`, a reference
  to an object in a Storage bucket. This keeps row sizes small and lets the
  client fetch a signed URL only when needed.
- **`research_records` stays schemaless on purpose.** Because
  `research_fields` is a user-authored form builder (fields can be added,
  renamed, or reordered per project), record values are stored as `jsonb`
  keyed by field id rather than as fixed columns, so the schema doesn't need
  a migration every time a researcher edits a form.
- **Row-level security** is defined per the ownership boundary above: owner-
  or self-scoped `for all` policies on personal/clinical tables, and no
  client-write policy on shared reference/content tables (those are
  maintained out-of-band, e.g. via migrations or a service role).
