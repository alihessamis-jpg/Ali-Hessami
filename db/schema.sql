-- ============================================================================
-- Database schema
--
-- Migrates the app's in-memory / localStorage data model to Postgres
-- (written for Supabase: uuid keys, auth.users, and RLS policy stubs).
-- See docs/database-schema-overview.md for the mapping and design notes.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Users (clinicians / app accounts)
-- One row per auth identity. Everything "per-clinician" or "per-user" in the
-- old model hangs off this table's id.
-- ----------------------------------------------------------------------------
create table public.users (
    id          uuid primary key references auth.users (id) on delete cascade,
    email       text not null unique,
    full_name   text,
    role        text not null default 'clinician',
    created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Patients
-- ----------------------------------------------------------------------------
create table public.patients (
    id          uuid primary key default gen_random_uuid(),
    mrn         text unique,
    name        text not null,
    date_of_birth date,
    sex         text,
    created_by  uuid references public.users (id) on delete set null,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index patients_created_by_idx on public.patients (created_by);

-- ----------------------------------------------------------------------------
-- Labs — longitudinal, append-only per patient (never overwritten)
-- ----------------------------------------------------------------------------
create table public.lab_entries (
    id              uuid primary key default gen_random_uuid(),
    patient_id      uuid not null references public.patients (id) on delete cascade,
    test_name       text not null,
    value           numeric,
    value_text      text,
    unit            text,
    reference_range text,
    collected_at    timestamptz not null,
    entered_by      uuid references public.users (id) on delete set null,
    created_at      timestamptz not null default now()
);

create index lab_entries_patient_id_idx on public.lab_entries (patient_id, collected_at desc);

-- ----------------------------------------------------------------------------
-- Progress notes (SOAP)
-- ----------------------------------------------------------------------------
create table public.progress_notes (
    id          uuid primary key default gen_random_uuid(),
    patient_id  uuid not null references public.patients (id) on delete cascade,
    author_id   uuid references public.users (id) on delete set null,
    subjective  text,
    objective   text,
    assessment  text,
    plan        text,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index progress_notes_patient_id_idx on public.progress_notes (patient_id, created_at desc);

-- ----------------------------------------------------------------------------
-- Medications
-- ----------------------------------------------------------------------------
create table public.medications (
    id                     uuid primary key default gen_random_uuid(),
    patient_id             uuid not null references public.patients (id) on delete cascade,
    name                   text not null,
    dose                   text,
    route                  text,
    frequency              text,
    start_date             date,
    end_date               date,
    prescribing_clinician_id uuid references public.users (id) on delete set null,
    notes                  text,
    created_at             timestamptz not null default now(),
    updated_at             timestamptz not null default now()
);

create index medications_patient_id_idx on public.medications (patient_id);

-- ----------------------------------------------------------------------------
-- Imaging — dataUrl replaced by a Storage object path (e.g. Supabase Storage
-- bucket key). The app resolves the path to a signed URL at read time.
-- ----------------------------------------------------------------------------
create table public.imaging_entries (
    id           uuid primary key default gen_random_uuid(),
    patient_id   uuid not null references public.patients (id) on delete cascade,
    modality     text,
    body_region  text,
    findings     text,
    storage_path text not null,
    performed_at timestamptz,
    uploaded_by  uuid references public.users (id) on delete set null,
    created_at   timestamptz not null default now()
);

create index imaging_entries_patient_id_idx on public.imaging_entries (patient_id);

-- ----------------------------------------------------------------------------
-- Checklists — templates are shared reference data; completion state is
-- per-clinician and NOT patient-specific (matches current app behavior).
-- ----------------------------------------------------------------------------
create table public.checklist_templates (
    id          uuid primary key default gen_random_uuid(),
    name        text not null,
    description text
);

create table public.checklist_items (
    id           uuid primary key default gen_random_uuid(),
    template_id  uuid not null references public.checklist_templates (id) on delete cascade,
    item_index   integer not null,
    label        text not null,
    unique (template_id, item_index)
);

create table public.checklist_completions (
    user_id     uuid not null references public.users (id) on delete cascade,
    item_id     uuid not null references public.checklist_items (id) on delete cascade,
    checked     boolean not null default false,
    updated_at  timestamptz not null default now(),
    primary key (user_id, item_id)
);

-- ----------------------------------------------------------------------------
-- Shared reference data (read-mostly, same for every user)
-- ----------------------------------------------------------------------------
create table public.drug_reference (
    id       uuid primary key default gen_random_uuid(),
    name     text not null,
    class    text,
    dosing   text,
    notes    text
);

create table public.dialysis_reference (
    id       uuid primary key default gen_random_uuid(),
    modality text not null,
    details  text
);

-- ----------------------------------------------------------------------------
-- Academy — split shared content from per-user spaced-repetition (SRS) state.
-- ----------------------------------------------------------------------------
create table public.academy_topics (
    id       uuid primary key default gen_random_uuid(),
    title    text not null,
    category text,
    content  text
);

create table public.academy_progress (
    user_id        uuid not null references public.users (id) on delete cascade,
    topic_id       uuid not null references public.academy_topics (id) on delete cascade,
    interval_index integer not null default 0,
    last_reviewed  timestamptz,
    next_review    timestamptz,
    review_history jsonb not null default '[]'::jsonb,
    primary key (user_id, topic_id)
);

-- ----------------------------------------------------------------------------
-- Study notes — personal
-- ----------------------------------------------------------------------------
create table public.study_notes (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references public.users (id) on delete cascade,
    title      text not null,
    content    text,
    tags       text[] not null default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index study_notes_user_id_idx on public.study_notes (user_id);

-- ----------------------------------------------------------------------------
-- Flashcards — personal, carries its own SRS fields (distinct from academy's)
-- ----------------------------------------------------------------------------
create table public.flashcards (
    id             uuid primary key default gen_random_uuid(),
    user_id        uuid not null references public.users (id) on delete cascade,
    topic_id       uuid references public.academy_topics (id) on delete set null,
    front          text not null,
    back           text not null,
    interval_index integer not null default 0,
    last_reviewed  timestamptz,
    next_review    timestamptz,
    review_history jsonb not null default '[]'::jsonb,
    created_at     timestamptz not null default now()
);

create index flashcards_user_id_idx on public.flashcards (user_id);

-- ----------------------------------------------------------------------------
-- Shared learning content
-- ----------------------------------------------------------------------------
create table public.reasoning_cases (
    id       uuid primary key default gen_random_uuid(),
    title    text not null,
    vignette text,
    content  jsonb
);

create table public.lab_challenges (
    id      uuid primary key default gen_random_uuid(),
    title   text not null,
    content jsonb
);

-- Imaging challenges: mix of shared seed content (created_by is null) and
-- user-added content (created_by set). dataUrl replaced by storage_path.
create table public.imaging_challenges (
    id           uuid primary key default gen_random_uuid(),
    title        text not null,
    storage_path text,
    content      jsonb,
    created_by   uuid references public.users (id) on delete set null,
    is_seed      boolean not null default false,
    created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Research module
-- ----------------------------------------------------------------------------
create table public.research_projects (
    id          uuid primary key default gen_random_uuid(),
    owner_id    uuid references public.users (id) on delete set null,
    title       text not null,
    description text,
    created_at  timestamptz not null default now()
);

-- Form builder field definitions for a project.
create table public.research_fields (
    id           uuid primary key default gen_random_uuid(),
    project_id   uuid not null references public.research_projects (id) on delete cascade,
    field_key    text not null,
    label        text not null,
    field_type   text not null,
    options      jsonb,
    order_index  integer not null default 0,
    unique (project_id, field_key)
);

-- Dynamic values keyed by field id, one row per submitted record.
create table public.research_records (
    id          uuid primary key default gen_random_uuid(),
    project_id  uuid not null references public.research_projects (id) on delete cascade,
    values      jsonb not null default '{}'::jsonb,
    created_by  uuid references public.users (id) on delete set null,
    created_at  timestamptz not null default now()
);

create index research_records_project_id_idx on public.research_records (project_id);

-- ----------------------------------------------------------------------------
-- Knowledge gaps — personal
-- ----------------------------------------------------------------------------
create table public.knowledge_gaps (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references public.users (id) on delete cascade,
    topic       text not null,
    description text,
    resolved    boolean not null default false,
    created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Personal cases — de-identified, built from patient encounters.
-- source_patient_id is kept only to let the owning clinician regenerate/audit
-- their own case; it is nullable and cleared if the patient record is
-- deleted, since the case itself must stand on its own once de-identified.
-- ----------------------------------------------------------------------------
create table public.personal_cases (
    id                  uuid primary key default gen_random_uuid(),
    user_id             uuid not null references public.users (id) on delete cascade,
    source_patient_id   uuid references public.patients (id) on delete set null,
    title               text not null,
    deidentified_summary text not null,
    tags                text[] not null default '{}',
    created_at          timestamptz not null default now()
);

create index personal_cases_user_id_idx on public.personal_cases (user_id);

-- ============================================================================
-- Row-level security
--
-- Patient-linked clinical tables: scoped to the clinician who created the
-- patient. Personal tables: scoped to their owning user. Shared reference /
-- content tables: readable by any authenticated user, writable by nobody
-- through the client (managed via migrations/service role instead).
-- ============================================================================

alter table public.patients enable row level security;
alter table public.lab_entries enable row level security;
alter table public.progress_notes enable row level security;
alter table public.medications enable row level security;
alter table public.imaging_entries enable row level security;
alter table public.checklist_completions enable row level security;
alter table public.academy_progress enable row level security;
alter table public.study_notes enable row level security;
alter table public.flashcards enable row level security;
alter table public.research_projects enable row level security;
alter table public.research_fields enable row level security;
alter table public.research_records enable row level security;
alter table public.knowledge_gaps enable row level security;
alter table public.personal_cases enable row level security;

create policy patients_owner_access on public.patients
    for all using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy lab_entries_owner_access on public.lab_entries
    for all using (exists (
        select 1 from public.patients p
        where p.id = lab_entries.patient_id and p.created_by = auth.uid()
    ));

create policy progress_notes_owner_access on public.progress_notes
    for all using (exists (
        select 1 from public.patients p
        where p.id = progress_notes.patient_id and p.created_by = auth.uid()
    ));

create policy medications_owner_access on public.medications
    for all using (exists (
        select 1 from public.patients p
        where p.id = medications.patient_id and p.created_by = auth.uid()
    ));

create policy imaging_entries_owner_access on public.imaging_entries
    for all using (exists (
        select 1 from public.patients p
        where p.id = imaging_entries.patient_id and p.created_by = auth.uid()
    ));

create policy checklist_completions_self_access on public.checklist_completions
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy academy_progress_self_access on public.academy_progress
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy study_notes_self_access on public.study_notes
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy flashcards_self_access on public.flashcards
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

create policy knowledge_gaps_self_access on public.knowledge_gaps
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy personal_cases_self_access on public.personal_cases
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
