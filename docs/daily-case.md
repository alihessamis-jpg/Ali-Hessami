# Daily Case Challenge (کیس روز)

One board-level pediatric nephrology case per day on **Today**, solved stage by
stage, archived at `/daily-case`.

## Pieces

| Part | Where |
|---|---|
| Tables, RLS, topic seed, owner-scoped search, Vault secret, cron | `daily_case_migration.sql` |
| Generation / grading / case chat | `supabase/functions/generate-daily-case/` (deploy with `verify_jwt = false`; it checks the JWT or the secret itself) |
| Today card | `src/components/dailyCase/DailyCaseCard.tsx` |
| Case page (stages, hints, skip, feedback, chat, uploads, final) | `src/pages/DailyCasePage.tsx` |
| Archive + per-topic stats | `src/pages/DailyCaseArchivePage.tsx` |
| Scoring / streak / stats (unit-tested) | `src/lib/dailyCase.ts` |

## How a case is made

1. **Topic**: `case_topics` (55 board topics, seeded per user). Priority =
   days since last used (capped) + weakness (100 − average first-attempt score);
   topics used in the last 10 days are held back. Earlier cases of the same
   topic are passed to the model as "do not repeat".
2. **Difficulty**: moderate / hard / board-killer, moved up when the last 5
   scores average ≥ 85, down when < 55.
3. **Retrieval** (no model): `case_search_library()` per short search term over
   the user's library + guidelines + atlas; Harriet Lane monographs for the
   topic's drugs (`drug_reference`); figures from `library_chapter_figures`.
4. **Generate** → JSON schema → validator (7 stages in order, every answer /
   pearl / learning point cited with a real `[S#]`, mcq keys in range, labs ≥ 6
   rows, figure ids real) → one retry with the validator's errors.
5. **Self-check** (second model call): lab arithmetic, doses vs Harriet Lane,
   eGFR, citation support, spoilers, figure relevance. Major issues → one
   **repair** call.

Each step is its own edge invocation (the free plan kills a function after
150 s), chained by the function calling itself with the Vault secret.
Progress is on the row (`phase`, `phase_at`, `work`); a row stuck in
`generating` for 6 min is treated as dead and regenerated.

Nothing image-like is generated: imaging is a text report; pathology links
to real library figures; users can upload their own de-identified images
(private `imaging` bucket, `{uid}/daily-cases/...`).

## Scoring

Each of the 7 stages is worth 1/7. Free text is graded 0–10 by the model
against the stage rubric (falls back to keyword matching if the AI is
unavailable); mcq by key. Each hint costs 25 % of that stage; Skip = 0.
A completed case under 70 is added to the Leitner review queue
(`reading_items`, origin `Daily Case`, first review tomorrow).

## Cron

`daily-case-generator`: `30 23 * * *` UTC = **03:00 Asia/Tehran** (no DST in
Iran since 2022). It POSTs `{"action":"cron"}` with header `x-case-secret`
read from Vault (`daily_case_secret`). Check / change it:

```sql
select jobname, schedule, active from cron.job;
select * from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'daily-case-generator') order by start_time desc limit 5;
select cron.alter_job((select jobid from cron.job where jobname = 'daily-case-generator'), schedule := '30 23 * * *');
```

If the case isn't there when Today opens (cron failed), the card requests it.

## AI provider and quota

Same rule as the assistant: Claude if `ANTHROPIC_API_KEY` is set, otherwise
Gemini (`GEMINI_API_KEY`). On the free Gemini tier the daily request quota is
small and shared with the assistant: one case costs 2–4 requests, each
free-text answer 1, each chat question 1. When the quota is hit, grading falls
back to keyword matching and chat says so. Optional env: `CASE_PROVIDER`,
`CASE_MODEL`, `DAILY_CASE_PHASE_MS` (raise on a paid plan).
