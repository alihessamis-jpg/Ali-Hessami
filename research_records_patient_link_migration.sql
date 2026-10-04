-- Nephron — Research Data: link a research record to a patient.
--
-- The "Data" tab's record-entry form had no way to tie a data row to a
-- patient already in the app — every record was just the custom fields
-- defined in Form Builder. This adds an optional patient_id column so each
-- record can (optionally) be linked, same as other patient-linked tables.
--
-- Safe to run multiple times (every statement is idempotent).

alter table public.research_records add column if not exists patient_id uuid references public.patients (id) on delete set null;
create index if not exists research_records_patient_id_idx on public.research_records (patient_id);
