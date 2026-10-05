-- Nephron — add the HUS activity LDH threshold to per-clinician settings.
--
-- Used by the new "HUS disease activity" banner in the Labs tab: for any
-- patient whose diagnosis/underlying disease names HUS, the disease is
-- considered active as long as the latest LDH is above this value.
--
-- Safe to run multiple times (idempotent).

alter table public.user_settings add column if not exists hus_ldh_upper_limit numeric not null default 450;
