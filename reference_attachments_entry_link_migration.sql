-- Nephron — let a Reference attachment (photo/PDF) link to a specific
-- drug_reference or dialysis_reference row, instead of only being tied to
-- the whole "drug" or "dialysis" category.
--
-- No FK constraint on entry_id since the target table depends on `category`
-- (drug_reference vs dialysis_reference) — enforced at the app level.
--
-- Idempotent: safe to re-run.

alter table public.reference_attachments add column if not exists entry_id uuid;
create index if not exists reference_attachments_entry_id_idx on public.reference_attachments (entry_id);
