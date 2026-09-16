# Nephron

A pediatric nephrology clinical/learning/research workspace, rebuilt from a
single-file HTML prototype into a Vite + React + Supabase app. See
[`NEPHRON_HANDOFF.md`](./NEPHRON_HANDOFF.md) for the full background and
[`docs/database-schema-overview.md`](./docs/database-schema-overview.md) for
how the prototype's data model maps to the Postgres schema.

## Status

All four migration phases from the handoff brief are implemented:

- **Dashboard** (the landing page) — surfaces abnormal labs from the last 14
  days, care reminders due today (including a day-before nudge for upcoming
  surgery dates), and Academy/flashcard reviews due today.
- **Clinical core** — auth, Patients list, and a per-patient workspace with
  Assessment, Labs, Trends, Progress Notes, Medications, Imaging, and
  Reminders tabs.
- **Reference + calculators** — a personal (per-clinician) drug/dialysis
  reference list, clinical checklists, and eGFR/BSA/BMI/fluid/dose
  calculators.
- **Academy + Study Hub** — Academy topics with spaced-repetition review,
  Study Notes, Flashcards, Reasoning Cases, Lab/Imaging Challenges,
  Knowledge Gaps, and de-identified Personal Cases (buildable directly from
  a patient's record).
- **Research & Thesis Center** — projects, a dynamic form builder (11 field
  types), data collection, basic analytics, and CSV export.

**Important content note:** this build ships with no seeded medical
content — no drug dosing tables, no Academy topics, no reference data. The
original prototype's actual content wasn't available during this rebuild,
so every reference/content table is empty until a clinician fills it in
through the app. Don't treat an empty reference page as "nothing to enter" —
add and verify your own entries before relying on them clinically.

Because of that, drug reference, dialysis reference, checklists, Academy
topics, reasoning cases, and lab/imaging challenges are **per-clinician**
(`owner_id`-scoped), not a single shared table — see
[`docs/database-schema-overview.md`](./docs/database-schema-overview.md) for
why, and how to add real shared/seeded content later if you want it.

## Setup

1. Create a [Supabase](https://supabase.com) project.
2. Run [`db/schema.sql`](./db/schema.sql) against it (SQL editor or `supabase db push`).
3. Create a **private** Storage bucket named `imaging` (Storage → New bucket,
   uncheck "Public"). Patient imaging and imaging-challenge uploads go here,
   read back via short-lived signed URLs — add a Storage policy scoping each
   user to their own `{user_id}/...` folder prefix if you want the same
   per-user isolation Postgres RLS gives every other table.
4. Copy `.env.example` to `.env` and fill in your project's URL and anon key:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```
5. Install dependencies and start the dev server:
   ```
   npm install
   npm run dev
   ```
6. Sign up for an account from the login screen (Supabase email/password auth).
   Row Level Security scopes all data to the signed-in user.

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — type-check and build for production
- `npm run lint` — run ESLint
