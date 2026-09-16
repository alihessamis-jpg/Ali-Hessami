-- ============================================================================
-- Nephron database schema (Supabase / Postgres)
--
-- Field names below mirror the prototype's data shapes exactly (see
-- NEPHRON_HANDOFF.md / docs/database-schema-overview.md) so the client can
-- map rows to the existing TS interfaces with minimal translation.
--
-- Tables are grouped by migration phase (see docs/database-schema-overview.md
-- "Suggested migration plan"). Phase 1 (Patients, Assessment, Labs, Trends,
-- Progress Notes) is what the current app build targets; later phases are
-- included here so the schema doesn't need revisiting per module.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Phase 1: clinical core
-- ----------------------------------------------------------------------------

-- Patient record. The "Assessment" tab in the app (chief complaint, history,
-- exam) is just another view onto this same row, not a separate table --
-- matching how the prototype stores it inline on the patient object.
create table public.patients (
    id                  uuid primary key default gen_random_uuid(),
    owner_id            uuid not null references auth.users (id) on delete cascade,

    -- identity / demographics
    name                text not null,
    code                text,
    age                 numeric,
    sex                 text,
    dob                 date,
    doa                 date,
    bed                 text,

    -- diagnosis / status
    diagnosis           text,
    underlying_disease  text,
    height              numeric,
    weight              numeric,
    height_pct          numeric,
    weight_pct          numeric,
    bmi_pct             numeric,
    baseline_cr         numeric,
    baseline_egfr       numeric,
    dialysis_status     text,
    dialysis_modality   text,
    transplant_status   text,

    -- assessment: history
    chief_complaint     text,
    hpi                 text,
    key_points           text,
    family_hx           text,
    pmh                 text,
    med_hx              text,
    allergy_hx          text,
    dialysis_hx         text,
    transplant_hx       text,

    -- assessment: vitals
    vs_temp             numeric,
    vs_hr               numeric,
    vs_rr               numeric,
    vs_bp               text,
    vs_spo2             numeric,

    -- assessment: exam
    ex_general          text,
    ex_heent            text,
    ex_cvs              text,
    ex_resp             text,
    ex_abd              text,
    ex_gu               text,
    ex_extrem           text,
    ex_skin             text,
    ex_neuro            text,
    ex_edema            text,
    ex_hydration        text,

    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

create index patients_owner_id_idx on public.patients (owner_id);

-- Labs — longitudinal, append-only per patient (never overwritten/edited).
-- "Trends" is a chart computed client-side from this table, grouped by
-- category/test over time; no separate table needed.
create table public.lab_entries (
    id          uuid primary key default gen_random_uuid(),
    patient_id  uuid not null references public.patients (id) on delete cascade,
    date        date not null,
    category    text,
    test        text not null,
    value       numeric,
    unit        text,
    ref         text,
    comment     text,
    created_at  timestamptz not null default now()
);

create index lab_entries_patient_id_idx on public.lab_entries (patient_id, date desc);
create index lab_entries_patient_test_idx on public.lab_entries (patient_id, test, date);

-- Progress notes (SOAP) + ward round timeline.
create table public.progress_notes (
    id          uuid primary key default gen_random_uuid(),
    patient_id  uuid not null references public.patients (id) on delete cascade,
    date        date not null,
    weight      numeric,
    bp          text,
    uo          text,
    subjective  text,
    objective   text,
    assessment  text,
    plan        text,
    created_at  timestamptz not null default now()
);

create index progress_notes_patient_id_idx on public.progress_notes (patient_id, date desc);

-- Medications.
create table public.medications (
    id             uuid primary key default gen_random_uuid(),
    patient_id     uuid not null references public.patients (id) on delete cascade,
    name           text not null,
    dose           text,
    dose_kg        numeric,
    route          text,
    freq           text,
    start_date     date,
    stop_date      date,
    indication     text,
    renal_adj      text,
    notes          text,
    active         boolean not null default true,
    created_at     timestamptz not null default now()
);

create index medications_patient_id_idx on public.medications (patient_id);

-- Imaging — dataUrl replaced by storage_path (Supabase Storage object key),
-- resolved to a signed URL at read time instead of stored inline.
create table public.imaging_entries (
    id           uuid primary key default gen_random_uuid(),
    patient_id   uuid not null references public.patients (id) on delete cascade,
    category     text,
    date         date,
    notes        text,
    report       text,
    impression   text,
    storage_path text,
    created_at   timestamptz not null default now()
);

create index imaging_entries_patient_id_idx on public.imaging_entries (patient_id);

-- Care reminders driving the Dashboard's alerts. `event_date` means different
-- things per type: for 'follow_up'/'custom' it's the day the task is due; for
-- 'surgery' it's the surgery date itself, and the dashboard alerts the day
-- before (so pre-op work happens on time) rather than storing a separate
-- "prep date" the clinician would have to compute by hand.
create table public.patient_reminders (
    id          uuid primary key default gen_random_uuid(),
    patient_id  uuid not null references public.patients (id) on delete cascade,
    type        text not null, -- 'follow_up' | 'surgery' | 'custom'
    title       text not null,
    note        text,
    event_date  date not null,
    done        boolean not null default false,
    created_at  timestamptz not null default now()
);

create index patient_reminders_patient_id_idx on public.patient_reminders (patient_id);
create index patient_reminders_event_date_idx on public.patient_reminders (event_date);

-- ----------------------------------------------------------------------------
-- Phase 2: reference + calculators
--
-- Each clinician maintains their own reference list (owner_id-scoped) rather
-- than a single shared/public table, so one user's edits can't silently
-- change dosing information another clinician relies on. Calculators
-- (eGFR/BSA/BMI/fluid/dose) are pure functions in the client, not tables.
-- ----------------------------------------------------------------------------

create table public.drug_reference (
    id              uuid primary key default gen_random_uuid(),
    owner_id        uuid not null references auth.users (id) on delete cascade,
    medication      text not null,
    indication      text,
    normal_dose     text,
    pediatric_dose  text,
    dose_kg         text,
    max_dose        text,
    egfr_range      text,
    adjusted_dose   text,
    frequency       text,
    notes           text
);

create table public.dialysis_reference (
    id              uuid primary key default gen_random_uuid(),
    owner_id        uuid not null references auth.users (id) on delete cascade,
    medication      text not null,
    indication      text,
    pediatric_dose  text,
    route           text,
    frequency       text,
    max_dose        text,
    notes           text
);

-- Clinical checklists — templates are clinician-authored; completion state is
-- per-clinician and NOT patient-specific, matching the prototype.
create table public.checklist_templates (
    id          uuid primary key default gen_random_uuid(),
    owner_id    uuid not null references auth.users (id) on delete cascade,
    name        text not null,
    description text
);

create table public.checklist_items (
    id          uuid primary key default gen_random_uuid(),
    template_id uuid not null references public.checklist_templates (id) on delete cascade,
    item_index  integer not null,
    label       text not null,
    unique (template_id, item_index)
);

create table public.checklist_completions (
    user_id     uuid not null references auth.users (id) on delete cascade,
    item_id     uuid not null references public.checklist_items (id) on delete cascade,
    checked     boolean not null default false,
    updated_at  timestamptz not null default now(),
    primary key (user_id, item_id)
);

-- ----------------------------------------------------------------------------
-- Phase 3: Academy + Study Hub
--
-- The handoff brief describes Academy/case/challenge content as shared, but
-- since this build has no seed content to share, every content table here is
-- owner_id-scoped (authored by the clinician who created it) rather than a
-- single public table, consistent with the reference tables above. Per-user
-- SRS state stays split out from content either way, per the brief.
-- ----------------------------------------------------------------------------

create table public.academy_topics (
    id              uuid primary key default gen_random_uuid(),
    owner_id        uuid not null references auth.users (id) on delete cascade,
    category        text,
    name            text not null,
    summary         text,
    key_points      jsonb not null default '[]'::jsonb,
    presentation    text,
    reasoning       text,
    tests           text,
    interpretation  text,
    imaging         text,
    treatment       text,
    red_flags       text,
    pearls          text,
    self_test       text,
    case_stem       text,
    case_questions  jsonb not null default '[]'::jsonb,
    case_discussion text
);

-- Per-user SRS state for an academy topic (split out per the handoff brief).
create table public.academy_progress (
    user_id         uuid not null references auth.users (id) on delete cascade,
    topic_id        uuid not null references public.academy_topics (id) on delete cascade,
    last_reviewed   date,
    next_review     date,
    interval_index  integer not null default -1,
    review_history  jsonb not null default '[]'::jsonb,
    primary key (user_id, topic_id)
);

create table public.study_notes (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users (id) on delete cascade,
    title       text,
    content     text,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

-- Flashcards carry their own SRS fields, independent of academy_progress.
create table public.flashcards (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid not null references auth.users (id) on delete cascade,
    front           text not null,
    back            text not null,
    deck            text,
    interval_index  integer not null default -1,
    last_reviewed   date,
    next_review     date,
    review_history  jsonb not null default '[]'::jsonb,
    created_at      timestamptz not null default now()
);

create table public.reasoning_cases (
    id          uuid primary key default gen_random_uuid(),
    owner_id    uuid not null references auth.users (id) on delete cascade,
    title       text not null,
    age         numeric,
    sex         text,
    chief       text,
    history     text,
    vitals      text,
    exam        text,
    labs        text,
    imaging     text,
    questions   jsonb not null default '[]'::jsonb,
    discussion  text
);

create table public.lab_challenges (
    id          uuid primary key default gen_random_uuid(),
    owner_id    uuid not null references auth.users (id) on delete cascade,
    title       text not null,
    values      jsonb not null default '[]'::jsonb, -- [[test, value, unit], ...]
    prompt      text,
    discussion  text
);

create table public.imaging_challenges (
    id           uuid primary key default gen_random_uuid(),
    owner_id     uuid not null references auth.users (id) on delete cascade,
    category     text,
    context      text,
    questions    text,
    discussion   text,
    storage_path text
);

create table public.knowledge_gaps (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users (id) on delete cascade,
    topic       text not null,
    description text,
    date        date not null default current_date,
    priority    text,
    review_date date,
    status      text
);

-- De-identified, built from a patient encounter. source_patient_id is kept
-- only for the owning clinician's own audit trail; cleared if the patient
-- record is deleted, since the case must stand on its own once de-identified.
create table public.personal_cases (
    id                       uuid primary key default gen_random_uuid(),
    user_id                  uuid not null references auth.users (id) on delete cascade,
    source_patient_id        uuid references public.patients (id) on delete set null,
    title                    text not null,
    created_date             date not null default current_date,
    diagnosis_context        text,
    presentation             text,
    findings                 text,
    lab_pattern              text,
    imaging                  text,
    working_dx               text,
    pearls                   text,
    what_learned             text,
    questions_for_further_study text
);

-- ----------------------------------------------------------------------------
-- Phase 4: Research & Thesis Center
-- ----------------------------------------------------------------------------

create table public.research_projects (
    id                 uuid primary key default gen_random_uuid(),
    owner_id           uuid not null references auth.users (id) on delete cascade,
    name               text not null,
    created_date       date not null default current_date,
    overview           text,
    research_question  text,
    objectives         text,
    study_design       text,
    inclusion          text,
    exclusion          text,
    notes              text,
    literature         text,
    progress           text
);

-- Form builder field definitions. `type` matches one of: Text, Number, Date,
-- Checkbox, Radio, Dropdown, "Multiple Choice", Laboratory,
-- "Calculated Field", "Image Upload", "File Upload".
create table public.research_fields (
    id          uuid primary key default gen_random_uuid(),
    project_id  uuid not null references public.research_projects (id) on delete cascade,
    label       text not null,
    type        text not null,
    required    boolean not null default false,
    options     jsonb,
    formula     text,
    order_index integer not null default 0
);

-- Dynamic values keyed by research_fields.id, kept as jsonb since the field
-- set is user-defined per project and changes without a schema migration.
create table public.research_records (
    id          uuid primary key default gen_random_uuid(),
    project_id  uuid not null references public.research_projects (id) on delete cascade,
    date        date not null default current_date,
    values      jsonb not null default '{}'::jsonb,
    created_at  timestamptz not null default now()
);

create index research_records_project_id_idx on public.research_records (project_id);

-- ============================================================================
-- Row-level security
-- ============================================================================

alter table public.patients enable row level security;
alter table public.lab_entries enable row level security;
alter table public.progress_notes enable row level security;
alter table public.medications enable row level security;
alter table public.imaging_entries enable row level security;
alter table public.patient_reminders enable row level security;
alter table public.drug_reference enable row level security;
alter table public.dialysis_reference enable row level security;
alter table public.checklist_templates enable row level security;
alter table public.checklist_items enable row level security;
alter table public.checklist_completions enable row level security;
alter table public.academy_topics enable row level security;
alter table public.academy_progress enable row level security;
alter table public.study_notes enable row level security;
alter table public.flashcards enable row level security;
alter table public.reasoning_cases enable row level security;
alter table public.lab_challenges enable row level security;
alter table public.imaging_challenges enable row level security;
alter table public.knowledge_gaps enable row level security;
alter table public.personal_cases enable row level security;
alter table public.research_projects enable row level security;
alter table public.research_fields enable row level security;
alter table public.research_records enable row level security;

create policy patients_owner_access on public.patients
    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy lab_entries_owner_access on public.lab_entries
    for all using (exists (
        select 1 from public.patients p
        where p.id = lab_entries.patient_id and p.owner_id = auth.uid()
    ));

create policy progress_notes_owner_access on public.progress_notes
    for all using (exists (
        select 1 from public.patients p
        where p.id = progress_notes.patient_id and p.owner_id = auth.uid()
    ));

create policy medications_owner_access on public.medications
    for all using (exists (
        select 1 from public.patients p
        where p.id = medications.patient_id and p.owner_id = auth.uid()
    ));

create policy imaging_entries_owner_access on public.imaging_entries
    for all using (exists (
        select 1 from public.patients p
        where p.id = imaging_entries.patient_id and p.owner_id = auth.uid()
    ));

create policy patient_reminders_owner_access on public.patient_reminders
    for all using (exists (
        select 1 from public.patients p
        where p.id = patient_reminders.patient_id and p.owner_id = auth.uid()
    ));

create policy drug_reference_owner_access on public.drug_reference
    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy dialysis_reference_owner_access on public.dialysis_reference
    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy checklist_templates_owner_access on public.checklist_templates
    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy checklist_items_owner_access on public.checklist_items
    for all using (exists (
        select 1 from public.checklist_templates t
        where t.id = checklist_items.template_id and t.owner_id = auth.uid()
    ));

create policy checklist_completions_self_access on public.checklist_completions
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy academy_topics_owner_access on public.academy_topics
    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy academy_progress_self_access on public.academy_progress
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy study_notes_self_access on public.study_notes
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy flashcards_self_access on public.flashcards
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy reasoning_cases_owner_access on public.reasoning_cases
    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy lab_challenges_owner_access on public.lab_challenges
    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy imaging_challenges_owner_access on public.imaging_challenges
    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy knowledge_gaps_self_access on public.knowledge_gaps
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy personal_cases_self_access on public.personal_cases
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy research_projects_owner_access on public.research_projects
    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy research_fields_owner_access on public.research_fields
    for all using (exists (
        select 1 from public.research_projects rp
        where rp.id = research_fields.project_id and rp.owner_id = auth.uid()
    ));

create policy research_records_owner_access on public.research_records
    for all using (exists (
        select 1 from public.research_projects rp
        where rp.id = research_records.project_id and rp.owner_id = auth.uid()
    ));
