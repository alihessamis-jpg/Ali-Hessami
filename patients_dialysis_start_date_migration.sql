-- Nephron — add dialysis_start_date to patients, so the Dialysis tab can
-- show how long a patient has been on dialysis (years/months), alongside
-- the existing underlying_disease (cause of ESRD) and transplant_hx fields
-- it now also edits.
--
-- Idempotent: safe to re-run.

alter table public.patients add column if not exists dialysis_start_date date;
