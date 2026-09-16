# Nephron

A pediatric nephrology clinical/learning/research workspace, being rebuilt
from a single-file HTML prototype into a Vite + React + Supabase app. See
[`NEPHRON_HANDOFF.md`](./NEPHRON_HANDOFF.md) for the full background and
[`docs/database-schema-overview.md`](./docs/database-schema-overview.md) for
how the prototype's data model maps to the Postgres schema.

## Status

**Phase 1 (clinical core) is implemented:** authentication, Patients list,
and a per-patient workspace with Assessment, Labs, Trends, and Progress
Notes tabs.

Not yet ported: Medications/Imaging tabs, reference tools (drug/dialysis
reference, calculators beyond eGFR/BSA/BMI), Academy + Study Hub, and the
Research & Thesis Center. The schema for all of these already exists in
`db/schema.sql` (see the overview doc) so later phases are additive.

## Setup

1. Create a [Supabase](https://supabase.com) project.
2. Run [`db/schema.sql`](./db/schema.sql) against it (SQL editor or `supabase db push`).
3. Copy `.env.example` to `.env` and fill in your project's URL and anon key:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```
4. Install dependencies and start the dev server:
   ```
   npm install
   npm run dev
   ```
5. Sign up for an account from the login screen (Supabase email/password auth).
   Row Level Security scopes all patient data to the signed-in user.

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — type-check and build for production
- `npm run lint` — run ESLint
