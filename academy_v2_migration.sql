-- Nephron — Academy v2: Library / Reader / Review.
--
-- Adds the textbook reading model (Book -> Chapter, with sections parsed at
-- render time from a chapter's own "note" markdown rather than stored as
-- rows) and a richer FSRS-scheduled card model (cloze / table_cell / mcq /
-- patient_case / basic) that backs the new Reader and Review pages.
--
-- This supersedes the never-applied academy_cards table's book-adjacent
-- cousin from an earlier round (books/book_chapters/book_sections) — those
-- were placeholders for exactly this feature and are replaced outright, so
-- there is no data migration needed for them. The existing `academy_topics`
-- table (and its attachments/linked-patients/sub-topics) is untouched and
-- keeps working as-is — existing topics are additionally linkable to one or
-- more Library chapters via chapter_topics below ("My topics" tab).
--
-- Safe to run multiple times (idempotent).

create table if not exists public.library_books (
    id          uuid primary key default gen_random_uuid(),
    owner_id    uuid not null references auth.users (id) on delete cascade,
    title       text not null,
    edition     text,
    publisher   text,
    year        integer,
    editors     jsonb not null default '[]'::jsonb,
    total_pages integer,
    created_at  timestamptz not null default now()
);

create table if not exists public.library_chapters (
    id             uuid primary key default gen_random_uuid(),
    owner_id       uuid not null references auth.users (id) on delete cascade,
    book_id        uuid not null references public.library_books (id) on delete cascade,
    part_roman     text not null,
    part_title     text not null,
    chapter_number integer not null,
    title          text not null,
    start_page     integer,
    end_page       integer,
    pages          integer,
    status         text not null default 'unread', -- 'unread' | 'reading' | 'read' | 'carded' | 'mastered'
    reading_pct    integer not null default 0,
    last_section   text,                             -- furthest-read section number, for TOC done/todo state
    note           text,                              -- the chapter's markdown content; sections are ## headings within it
    created_at     timestamptz not null default now(),
    unique (book_id, chapter_number)
);

create index if not exists library_chapters_book_id_idx on public.library_chapters (book_id);
create index if not exists library_chapters_owner_id_idx on public.library_chapters (owner_id);

create table if not exists public.library_cards (
    id             uuid primary key default gen_random_uuid(),
    owner_id       uuid not null references auth.users (id) on delete cascade,
    chapter_id     uuid not null references public.library_chapters (id) on delete cascade,
    kind           text not null default 'cloze', -- 'cloze' | 'table_cell' | 'mcq' | 'patient_case' | 'basic'
    front          text not null,
    back            text not null,
    options        jsonb,                            -- mcq: {choices:[{label,text,correct}], explanation}
    section_number text,
    page           integer,
    source_text    text,                              -- verbatim source snippet (cloze blank / table cell / highlight)
    patient_id     uuid references public.patients (id) on delete set null,
    -- FSRS scheduling state (lib/fsrs.ts)
    fsrs_due            timestamptz not null default now(),
    fsrs_stability       numeric,
    fsrs_difficulty      numeric,
    fsrs_elapsed_days    numeric not null default 0,
    fsrs_scheduled_days  numeric not null default 0,
    fsrs_reps            integer not null default 0,
    fsrs_lapses          integer not null default 0,
    fsrs_state           smallint not null default 0, -- 0 New, 1 Learning, 2 Review, 3 Relearning
    fsrs_last_review     timestamptz,
    review_history       jsonb not null default '[]'::jsonb,
    created_at            timestamptz not null default now()
);

create index if not exists library_cards_chapter_id_idx on public.library_cards (chapter_id);
create index if not exists library_cards_owner_due_idx on public.library_cards (owner_id, fsrs_due);

create table if not exists public.library_highlights (
    id             uuid primary key default gen_random_uuid(),
    owner_id       uuid not null references auth.users (id) on delete cascade,
    chapter_id     uuid not null references public.library_chapters (id) on delete cascade,
    section_number text,
    kind           text not null default 'highlight', -- 'highlight' | 'note'
    text           text not null,
    note_text      text,
    created_at     timestamptz not null default now()
);

create index if not exists library_highlights_chapter_id_idx on public.library_highlights (chapter_id);

-- Existing Academy topics <-> Library chapters, many-to-many ("Linked" panel
-- in the Reader, and lets a topic surface from a chapter and vice versa).
create table if not exists public.chapter_topics (
    chapter_id uuid not null references public.library_chapters (id) on delete cascade,
    topic_id   uuid not null references public.academy_topics (id) on delete cascade,
    primary key (chapter_id, topic_id)
);

-- One row per day a clinician reads at least one page — backs the Library
-- hero's "today's goal" bar and reading streak.
create table if not exists public.library_reading_log (
    id         uuid primary key default gen_random_uuid(),
    owner_id   uuid not null references auth.users (id) on delete cascade,
    log_date   date not null default current_date,
    pages_read integer not null default 0,
    created_at timestamptz not null default now(),
    unique (owner_id, log_date)
);

alter table public.library_books enable row level security;
alter table public.library_chapters enable row level security;
alter table public.library_cards enable row level security;
alter table public.library_highlights enable row level security;
alter table public.chapter_topics enable row level security;
alter table public.library_reading_log enable row level security;

drop policy if exists library_books_owner_access on public.library_books;
create policy library_books_owner_access on public.library_books
    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists library_chapters_owner_access on public.library_chapters;
create policy library_chapters_owner_access on public.library_chapters
    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists library_cards_owner_access on public.library_cards;
create policy library_cards_owner_access on public.library_cards
    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists library_highlights_owner_access on public.library_highlights;
create policy library_highlights_owner_access on public.library_highlights
    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists chapter_topics_owner_access on public.chapter_topics;
create policy chapter_topics_owner_access on public.chapter_topics
    for all using (
        exists (select 1 from public.library_chapters c where c.id = chapter_topics.chapter_id and c.owner_id = auth.uid())
        and exists (select 1 from public.academy_topics t where t.id = chapter_topics.topic_id and t.owner_id = auth.uid())
    );

drop policy if exists library_reading_log_owner_access on public.library_reading_log;
create policy library_reading_log_owner_access on public.library_reading_log
    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
