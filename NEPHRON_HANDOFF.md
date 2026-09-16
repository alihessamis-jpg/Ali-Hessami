# Nephron — Handoff Brief for Claude Code

Give this file to Claude Code along with the current prototype (`index.html`) as your starting prompt. It explains what exists, how it's built, and what to do next.

## What this is

A pediatric nephrology clinical/learning/research workspace, currently built as a **single self-contained HTML file** (vanilla JS, no framework, no build step) that runs entirely in the browser. All data lives in `localStorage` — nothing is synced, shared, or backed by a real database yet.

It covers, in full working form:
- **Clinical**: patient database, a per-patient command center (renal status, vitals, alerts), digital assessment/history/exam, longitudinal labs, trend charts, SOAP progress notes + ward round timeline, imaging gallery (uploads as data URLs), medications, print/PDF summary.
- **Reference tools**: clinical calculators (eGFR/BSA/BMI/fluid/dose), clinical checklists, a searchable/editable renal drug dosing reference, a dialysis medication reference.
- **Learning**: a 12-topic disease Academy with a structured template + case questions, a Study Hub (note import/organize, flashcards, clinical reasoning cases, lab/imaging challenges, spaced repetition, a knowledge-gap log, and "Learn from this case" de-identified case building).
- **Research**: multi-project Research & Thesis Center with a form builder (11 field types incl. calculated fields and file uploads), dynamic data collection, an editable dataset table, basic analytics, and CSV/Excel/PDF export.
- Backup/restore as JSON, approximate growth percentiles, a real in-app search, and a light design pass (touch targets, focus states).

## What's explicitly NOT done (this is the point of moving to Claude Code)

1. **No real backend.** No auth, no multi-user support, no sync across devices, no Row Level Security. Everything is one browser's `localStorage`.
2. **No visual knowledge graph** connecting Academy topics to each other.
3. Growth percentiles are a rough statistical approximation (sparse mean/SD table + normal CDF), not real WHO/CDC LMS chart data.
4. Never tested on a physical iPad.
5. This was built inside a hosted-artifact environment with real constraints (no npm, no arbitrary external scripts, no server) — a proper project won't have those constraints and shouldn't inherit them.

## Recommended stack for the real build

- **Supabase** (Postgres + Auth + Row Level Security + Storage) — this was designed against from the start (the original brief explicitly asked for it), so the data model below maps cleanly to tables.
- A real frontend framework (React/Vite, Next.js, or similar) rather than vanilla JS+innerHTML — the current app re-renders whole pages via `innerHTML` string templates, which was a reasonable shortcut for a single-file prototype but won't scale as a real codebase.
- Supabase Storage for imaging/file uploads instead of base64 data URLs in the database.

## Current data model (from the prototype's `localStorage` keys)

Each top-level key below should become roughly one Postgres table, scoped to the logged-in clinician via RLS (`user_id` / `owner_id` column) unless noted otherwise.

```
patients            : Patient[]                         — one row per patient
labs                : { [patientId]: LabEntry[] }        — longitudinal, never overwritten
notes               : { [patientId]: ProgressNote[] }    — SOAP entries
meds                : { [patientId]: Medication[] }
imaging             : { [patientId]: ImagingEntry[] }    — dataUrl should become a Storage object path
checklists          : { [templateId]: { [itemIndex]: boolean } }   — per-clinician checklist state, not patient-specific in current build
drugRef             : DrugRefEntry[]                     — shared reference data, could be a shared/public table
dialysisRef         : DialysisRefEntry[]                 — shared reference data
academy             : AcademyTopic[]                     — shared content + per-user SRS state (split these on migration: content is shared, review state is per-user)
studyNotes          : StudyNote[]
flashcards          : Flashcard[]                        — has its own SRS fields (intervalIndex, lastReviewed, nextReview, reviewHistory)
reasoningCases       : ReasoningCase[]                    — shared content
labChallenges        : LabChallenge[]                     — shared content
imagingChallenges    : ImagingChallenge[]                 — mix of shared seed content + user-added
researchProjects     : ResearchProject[]
researchForms        : { [projectId]: ResearchField[] }   — the form builder's field definitions
researchRecords      : { [projectId]: ResearchRecord[] }  — dynamic values keyed by field id
knowledgeGaps        : KnowledgeGap[]
personalCases        : PersonalCase[]                     — de-identified, built from patient encounters
```

### Key shapes

```ts
Patient {
  id, name, code, age, sex, dob, doa, bed, diagnosis, underlyingDisease,
  height, weight, heightPct, weightPct, bmiPct,
  baselineCr, baselineEGFR, dialysisStatus, dialysisModality, transplantStatus,
  // plus free-text history/exam fields added via the Assessment tab:
  chiefComplaint, hpi, keyPoints, familyHx, pmh, medHx, allergyHx, dialysisHx, transplantHx,
  vsTemp, vsHR, vsRR, vsBP, vsSpo2, exGeneral, exHeent, exCVS, exResp, exAbd, exGU, exExtrem, exSkin, exNeuro, exEdema, exHydration
}

LabEntry { id, date, category, test, value, unit, ref, comment }
ProgressNote { id, date, weight, bp, uo, S, O, A, P }
Medication { id, name, dose, doseKg, route, freq, start, stop, indication, renalAdj, notes, active }
ImagingEntry { id, category, date, notes, report, impression, dataUrl }

DrugRefEntry { id, medication, indication, normalDose, pediatricDose, doseKg, maxDose, egfrRange, adjustedDose, frequency, notes }
DialysisRefEntry { id, medication, indication, pediatricDose, route, frequency, maxDose, notes }

AcademyTopic {
  id, category, name, summary, keyPoints[], presentation, reasoning, tests, interpretation,
  imaging, treatment, redFlags, pearls, selfTest, caseStem, caseQuestions[], caseDiscussion,
  // SRS state — split into a separate per-user table on migration:
  lastReviewed, nextReview, intervalIndex, reviewHistory[{date, rating}]
}
Flashcard { id, front, back, deck, intervalIndex, lastReviewed, nextReview, reviewHistory[] }
ReasoningCase { id, title, age, sex, chief, history, vitals, exam, labs, imaging, questions[], discussion }
LabChallenge { id, title, values[[test,value,unit]], prompt, discussion }
ImagingChallenge { id, category, context, questions, discussion, dataUrl }

ResearchProject { id, name, createdDate, overview, researchQuestion, objectives, studyDesign, inclusion, exclusion, notes, literature, progress }
ResearchField { id, label, type, required, options, formula, order }
  // type is one of: Text, Number, Date, Checkbox, Radio, Dropdown, Multiple Choice, Laboratory, Calculated Field, Image Upload, File Upload
ResearchRecord { id, date, values: { [fieldId]: any } }

KnowledgeGap { id, topic, description, date, priority, reviewDate, status }
PersonalCase { id, title, createdDate, diagnosisContext, presentation, findings, labPattern, imaging, workingDx, pearls, whatLearned, questionsForFurtherStudy }
```

### Spaced repetition logic (reuse as-is)

```js
const REVIEW_INTERVALS = [1,3,7,14,30,60]; // days
function scheduleReview(item, rating){
  let idx = item.intervalIndex==null || item.intervalIndex<0 ? -1 : item.intervalIndex;
  if(rating==='easy') idx = Math.min(idx+2, REVIEW_INTERVALS.length-1);
  else if(rating==='moderate') idx = Math.min(idx+1, REVIEW_INTERVALS.length-1);
  else idx = 0; // difficult
  item.intervalIndex = idx;
  item.lastReviewed = todayISO();
  item.nextReview = addDays(today, REVIEW_INTERVALS[idx]);
  item.reviewHistory.push({date: item.lastReviewed, rating});
}
```

### eGFR / BSA / BMI formulas (reuse as-is)

```js
schwartzEGFR = (heightCm, crMgDl) => 0.413 * heightCm / crMgDl;   // mL/min/1.73m²
bsaMosteller = (heightCm, weightKg) => Math.sqrt((heightCm*weightKg)/3600);
bmiCalc = (heightCm, weightKg) => weightKg / (heightCm/100)**2;
```

## Suggested migration plan

1. **Scaffold a real project** (Vite + React recommended) and set up Supabase (auth with email/password to start, `patients` table + RLS policy `user_id = auth.uid()` as the pattern for every clinician-owned table).
2. **Port the clinical core first** (Patients, Assessment, Labs, Trends, Progress Notes, Imaging, Medications) — this is the highest-value, most-used part. Move imaging from data-URL storage to Supabase Storage with a signed-URL pattern.
3. **Port reference + calculators** (mostly static, low risk) — drug reference and dialysis reference can be shared/read-only tables seeded once, editable only by the owning clinician if you want per-user customization, or shared across a team if this becomes multi-clinician.
4. **Port the Academy + Study Hub** — split shared content (topics, cases, challenges) from per-user state (SRS scheduling, flashcards, knowledge gaps, personal cases).
5. **Port the Research Center last** — the dynamic form builder is the most complex piece (JSON-shaped `ResearchField[]` + `ResearchRecord.values` keyed by field id maps naturally to a `jsonb` column in Postgres, which avoids needing a fully dynamic schema).
6. **Real growth percentiles** — swap the approximate normal-distribution calculation for actual WHO/CDC LMS growth chart data (publicly available as CSV/JSON) once you're in a real codebase that can bundle static data files.
7. Add the visual knowledge graph as a nice-to-have once the core is solid — likely a simple force-directed graph (e.g. `react-force-graph` or similar) over a small `topic_relations` table (`topic_id`, `related_topic_id`, `relation_label`).

## First prompt to give Claude Code

> I have a working single-file HTML prototype of a pediatric nephrology clinical/learning/research app (attached, plus a handoff brief). I want to rebuild it as a real Vite + React + Supabase project with authentication and row-level security, keeping the same feature set and UI direction. Start by scaffolding the project and Supabase schema for the Patients + Assessment + Labs + Trends + Progress Notes modules (Phase 1 clinical core), matching the data shapes in the handoff brief. Then let's go module by module from there.
