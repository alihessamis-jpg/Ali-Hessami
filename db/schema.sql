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

    -- care_status separates the "Inpatient" and "Discharged" patient lists
    -- shown on the Patients page -- new patients start as inpatient, and
    -- discharging one just flips this flag rather than moving/archiving the
    -- record.
    care_status         text not null default 'inpatient'
                          check (care_status in ('inpatient', 'discharged')),

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
    value_text  text, -- semi-quantitative dipstick results (Negative/Trace/+1.."+4") that don't fit `value`
    micro_details jsonb, -- culture results: { organism, colonyCount, collectionMethod, onAntibiotics, susceptibilities: [{antibiotic, result}] }
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

-- General per-patient file attachments (e.g. a scanned pre-filled paper
-- chart/data-collection sheet) -- separate from imaging_entries, which
-- carries radiology-specific report/impression fields. A patient can have
-- any number of these.
create table public.patient_documents (
    id           uuid primary key default gen_random_uuid(),
    patient_id   uuid not null references public.patients (id) on delete cascade,
    storage_path text not null,
    filename     text,
    created_at   timestamptz not null default now()
);

create index patient_documents_patient_id_idx on public.patient_documents (patient_id);

-- Urine output entries, logged per interval (e.g. hourly) so a rate in
-- mL/kg/hr can be computed against the patient's weight -- used to catch
-- oliguria and, especially after relieving an obstruction (e.g. post-PUV
-- surgery), post-obstructive polyuria.
create table public.urine_output_entries (
    id              uuid primary key default gen_random_uuid(),
    patient_id      uuid not null references public.patients (id) on delete cascade,
    recorded_at     timestamptz not null default now(),
    volume_ml       numeric not null,
    duration_hours  numeric not null default 1,
    notes           text,
    created_at      timestamptz not null default now()
);

create index urine_output_entries_patient_id_idx on public.urine_output_entries (patient_id);

-- Nephrotic syndrome course events (diagnosis / relapse / remission / no
-- response after 4 weeks of daily steroids), used to derive whether the
-- patient is steroid-sensitive, steroid-dependent, frequently relapsing,
-- or steroid-resistant. during_taper marks a relapse that happened during
-- steroid therapy or within 2 weeks of stopping it (steroid-dependent
-- criterion) -- irrelevant for other event types.
create table public.nephrotic_events (
    id            uuid primary key default gen_random_uuid(),
    patient_id    uuid not null references public.patients (id) on delete cascade,
    date          date not null,
    event_type    text not null, -- 'diagnosis' | 'relapse' | 'remission' | 'no_response_4wk'
    during_taper  boolean not null default false,
    notes         text,
    created_at    timestamptz not null default now()
);

create index nephrotic_events_patient_id_idx on public.nephrotic_events (patient_id);

-- Longitudinal growth/vitals measurements (height, weight, head
-- circumference, blood pressure). Percentiles are computed client-side from
-- WHO/CDC reference data + the patient's dob/sex, not stored here.
create table public.growth_entries (
    id             uuid primary key default gen_random_uuid(),
    patient_id     uuid not null references public.patients (id) on delete cascade,
    date           date not null,
    height_cm      numeric,
    weight_kg      numeric,
    head_circ_cm   numeric,
    bp_systolic    numeric,
    bp_diastolic   numeric,
    created_at     timestamptz not null default now()
);

create index growth_entries_patient_id_idx on public.growth_entries (patient_id, date desc);

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

-- Pending orders awaiting results/reports -- distinct from patient_reminders
-- (which are date-driven todos): this tracks things sent out that haven't
-- come back yet (a culture, a specialized serology panel, an operative
-- note), so nothing falls through the cracks.
create table public.follow_up_items (
    id             uuid primary key default gen_random_uuid(),
    patient_id     uuid not null references public.patients (id) on delete cascade,
    category       text not null, -- 'culture' | 'imaging' | 'document' | 'specialized_lab' | 'other'
    description    text not null,
    ordered_date   date not null,
    resolved       boolean not null default false,
    resolved_date  date,
    notes          text,
    created_at     timestamptz not null default now()
);

create index follow_up_items_patient_id_idx on public.follow_up_items (patient_id);

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

-- Images/PDFs of reference material (e.g. a dosing table photographed from a
-- textbook) the clinician wants to keep alongside the Drug/Dialysis
-- reference lists -- not tied to a single medication row.
create table public.reference_attachments (
    id            uuid primary key default gen_random_uuid(),
    owner_id      uuid not null references auth.users (id) on delete cascade,
    category      text not null, -- 'drug' | 'dialysis'
    storage_path  text not null,
    filename      text,
    created_at    timestamptz not null default now()
);

create index reference_attachments_owner_category_idx on public.reference_attachments (owner_id, category);

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
    section     text, -- optional group header (e.g. "Before infusion"); null renders with no header
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
    -- Optional parent topic, e.g. "Anemia of CKD" / "CKD-MBD" / "Dialysis"
    -- nested under a "CKD" parent topic. Null for a top-level topic.
    parent_topic_id uuid references public.academy_topics (id) on delete set null,
    name            text not null,
    summary         text,
    key_points      jsonb not null default '[]'::jsonb,
    study_links     jsonb not null default '[]'::jsonb, -- [{ label, url }] -- external references (UpToDate, NotebookLM, etc.)
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

create index academy_topics_parent_topic_id_idx on public.academy_topics (parent_topic_id);

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

-- Files attached to a study topic (PDF summaries, NotebookLM-style podcast
-- audio, self-made test PDFs) -- a topic can have any number of these.
create table public.academy_topic_attachments (
    id            uuid primary key default gen_random_uuid(),
    topic_id      uuid not null references public.academy_topics (id) on delete cascade,
    storage_path  text not null,
    filename      text,
    kind          text not null default 'other', -- 'pdf' | 'audio' | 'other'
    created_at    timestamptz not null default now()
);

create index academy_topic_attachments_topic_id_idx on public.academy_topic_attachments (topic_id);

-- Manual many-to-many link between a study topic and real patients the
-- clinician has managed, so a topic's review page can show their actual
-- presentation/course alongside the summary material.
create table public.academy_topic_patients (
    topic_id    uuid not null references public.academy_topics (id) on delete cascade,
    patient_id  uuid not null references public.patients (id) on delete cascade,
    linked_at   timestamptz not null default now(),
    notes       text,
    primary key (topic_id, patient_id)
);

create index academy_topic_patients_patient_id_idx on public.academy_topic_patients (patient_id);

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

-- Fixed-interval spaced review of things read (papers, chapters, guidelines)
-- -- distinct from academy_progress/flashcards' adaptive SRS. Each item gets
-- reminded at 3/7/14/30/90 days after reading, independent of the others.
create table public.reading_items (
    id               uuid primary key default gen_random_uuid(),
    user_id          uuid not null references auth.users (id) on delete cascade,
    title            text not null,
    source           text,
    date_read        date not null default current_date,
    review_3d_done   boolean not null default false,
    review_7d_done   boolean not null default false,
    review_14d_done  boolean not null default false,
    review_30d_done  boolean not null default false,
    review_90d_done  boolean not null default false,
    -- Optional link to an Academy topic, so a reading item's linked patients
    -- (via academy_topic_patients) surface without a second linking system.
    topic_id         uuid references public.academy_topics (id) on delete set null,
    created_at       timestamptz not null default now()
);

create index reading_items_topic_id_idx on public.reading_items (topic_id);

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

-- Fellowship case log: tracks clinical exposure (diagnosis category, role,
-- procedure) for board/certification case-mix requirements and for spotting
-- underexposed categories to focus study on. patient_id is optional and set
-- null (never cascade-deleted) so a case entry survives even if the linked
-- patient chart is later removed -- the exposure itself already happened.
create table public.case_log_entries (
    id          uuid primary key default gen_random_uuid(),
    owner_id    uuid not null references auth.users (id) on delete cascade,
    patient_id  uuid references public.patients (id) on delete set null,
    date        date not null default current_date,
    category    text not null,
    diagnosis   text not null,
    role        text not null, -- 'managed' | 'performed' | 'assisted' | 'observed' | 'consulted'
    procedure   text,
    setting     text, -- 'Inpatient' | 'Outpatient' | 'Consult' | 'ICU'
    notes       text,
    created_at  timestamptz not null default now()
);

create index case_log_entries_owner_id_idx on public.case_log_entries (owner_id);
create index case_log_entries_date_idx on public.case_log_entries (date);

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

-- Per-clinician app preferences (e.g. lab alert thresholds). One row per user,
-- created on first save; the app falls back to hardcoded defaults until then.
create table public.user_settings (
    owner_id                      uuid primary key references auth.users (id) on delete cascade,
    anemia_hb_threshold           numeric not null default 8,
    acidosis_ph_threshold         numeric not null default 7.35,
    acidosis_hco3_threshold       numeric not null default 15,
    ckd_mbd_ca_low                numeric not null default 8.5,
    ckd_mbd_ca_high               numeric not null default 10.5,
    ckd_mbd_pth_high              numeric not null default 65,
    ckd_mbd_pth_low               numeric not null default 10,
    ckd_mbd_vitd_deficient        numeric not null default 20,
    ckd_mbd_vitd_insufficient     numeric not null default 30,
    ckd_mbd_bicarb_low            numeric not null default 22,
    phosphate_under_1y            numeric not null default 8.1,
    phosphate_age_1to3            numeric not null default 6.5,
    phosphate_age_3to10           numeric not null default 5.8,
    phosphate_age_10to17          numeric not null default 5.4,
    phosphate_adult               numeric not null default 4.5,
    biopsy_platelet_min           numeric not null default 50,
    biopsy_inr_max                numeric not null default 1.5,
    updated_at                    timestamptz not null default now()
);

-- ============================================================================
-- Row-level security
-- ============================================================================

alter table public.patients enable row level security;
alter table public.lab_entries enable row level security;
alter table public.progress_notes enable row level security;
alter table public.medications enable row level security;
alter table public.imaging_entries enable row level security;
alter table public.patient_documents enable row level security;
alter table public.urine_output_entries enable row level security;
alter table public.nephrotic_events enable row level security;
alter table public.growth_entries enable row level security;
alter table public.patient_reminders enable row level security;
alter table public.follow_up_items enable row level security;
alter table public.drug_reference enable row level security;
alter table public.dialysis_reference enable row level security;
alter table public.reference_attachments enable row level security;
alter table public.checklist_templates enable row level security;
alter table public.checklist_items enable row level security;
alter table public.checklist_completions enable row level security;
alter table public.academy_topics enable row level security;
alter table public.academy_progress enable row level security;
alter table public.academy_topic_attachments enable row level security;
alter table public.academy_topic_patients enable row level security;
alter table public.study_notes enable row level security;
alter table public.flashcards enable row level security;
alter table public.reading_items enable row level security;
alter table public.reasoning_cases enable row level security;
alter table public.lab_challenges enable row level security;
alter table public.imaging_challenges enable row level security;
alter table public.knowledge_gaps enable row level security;
alter table public.case_log_entries enable row level security;
alter table public.personal_cases enable row level security;
alter table public.research_projects enable row level security;
alter table public.research_fields enable row level security;
alter table public.research_records enable row level security;
alter table public.user_settings enable row level security;

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

create policy patient_documents_owner_access on public.patient_documents
    for all using (exists (
        select 1 from public.patients p
        where p.id = patient_documents.patient_id and p.owner_id = auth.uid()
    ));

create policy urine_output_entries_owner_access on public.urine_output_entries
    for all using (exists (
        select 1 from public.patients p
        where p.id = urine_output_entries.patient_id and p.owner_id = auth.uid()
    ));

create policy nephrotic_events_owner_access on public.nephrotic_events
    for all using (exists (
        select 1 from public.patients p
        where p.id = nephrotic_events.patient_id and p.owner_id = auth.uid()
    ));

create policy growth_entries_owner_access on public.growth_entries
    for all using (exists (
        select 1 from public.patients p
        where p.id = growth_entries.patient_id and p.owner_id = auth.uid()
    ));

create policy patient_reminders_owner_access on public.patient_reminders
    for all using (exists (
        select 1 from public.patients p
        where p.id = patient_reminders.patient_id and p.owner_id = auth.uid()
    ));

create policy follow_up_items_owner_access on public.follow_up_items
    for all using (exists (
        select 1 from public.patients p
        where p.id = follow_up_items.patient_id and p.owner_id = auth.uid()
    ));

create policy drug_reference_owner_access on public.drug_reference
    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy dialysis_reference_owner_access on public.dialysis_reference
    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy reference_attachments_owner_access on public.reference_attachments
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

create policy academy_topic_attachments_owner_access on public.academy_topic_attachments
    for all using (exists (
        select 1 from public.academy_topics t
        where t.id = academy_topic_attachments.topic_id and t.owner_id = auth.uid()
    ));

create policy academy_topic_patients_owner_access on public.academy_topic_patients
    for all using (
        exists (
            select 1 from public.academy_topics t
            where t.id = academy_topic_patients.topic_id and t.owner_id = auth.uid()
        )
        and exists (
            select 1 from public.patients p
            where p.id = academy_topic_patients.patient_id and p.owner_id = auth.uid()
        )
    );

create policy study_notes_self_access on public.study_notes
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy flashcards_self_access on public.flashcards
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy reading_items_self_access on public.reading_items
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy reasoning_cases_owner_access on public.reasoning_cases
    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy lab_challenges_owner_access on public.lab_challenges
    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy imaging_challenges_owner_access on public.imaging_challenges
    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy knowledge_gaps_self_access on public.knowledge_gaps
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy case_log_entries_owner_access on public.case_log_entries
    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

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

create policy user_settings_owner_access on public.user_settings
    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
