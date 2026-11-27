-- Nephron — structured pediatric history for the step-by-step history
-- wizard (/patients/:id/history): informant & family, prenatal, birth,
-- neonatal, feeding, milestones, vaccines, newborn screening, allergies,
-- PMH / family / ROS flags and step progress, in one jsonb column.
-- Until this runs, the wizard keeps these answers on the device only.
--
-- Idempotent: safe to re-run.

alter table public.patients add column if not exists peds_history jsonb;
