-- Nephron — Book reading mode: Book -> Chapter -> Section, linkable to
-- Academy topics.
--
-- Each section tracks its own read status and (once marked read via the
-- quick-check quiz) a read_at timestamp, which the Today/Dashboard "daily
-- goal" widget uses to count sections completed today.
--
-- Safe to run multiple times (idempotent).

create table if not exists public.books (
    id          uuid primary key default gen_random_uuid(),
    owner_id    uuid not null references auth.users (id) on delete cascade,
    title       text not null,
    author      text,
    total_pages integer,
    created_at  timestamptz not null default now()
);

create table if not exists public.book_chapters (
    id            uuid primary key default gen_random_uuid(),
    book_id       uuid not null references public.books (id) on delete cascade,
    title         text not null,
    chapter_index integer not null default 0,
    pages_from    integer,
    pages_to      integer,
    created_at    timestamptz not null default now()
);

create index if not exists book_chapters_book_id_idx on public.book_chapters (book_id);

create table if not exists public.book_sections (
    id            uuid primary key default gen_random_uuid(),
    chapter_id    uuid not null references public.book_chapters (id) on delete cascade,
    title         text not null,
    section_index integer not null default 0,
    pages_from    integer,
    pages_to      integer,
    status        text not null default 'unread', -- 'unread' | 'read' | 'carded' | 'mastered'
    read_at       timestamptz,
    created_at    timestamptz not null default now()
);

create index if not exists book_sections_chapter_id_idx on public.book_sections (chapter_id);

-- Many-to-many: a section can cover several Academy topics (and a topic can
-- be referenced from several sections across books).
create table if not exists public.book_section_topics (
    section_id uuid not null references public.book_sections (id) on delete cascade,
    topic_id   uuid not null references public.academy_topics (id) on delete cascade,
    primary key (section_id, topic_id)
);

alter table public.books enable row level security;
alter table public.book_chapters enable row level security;
alter table public.book_sections enable row level security;
alter table public.book_section_topics enable row level security;

drop policy if exists books_owner_access on public.books;
create policy books_owner_access on public.books
    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists book_chapters_owner_access on public.book_chapters;
create policy book_chapters_owner_access on public.book_chapters
    for all using (exists (
        select 1 from public.books b where b.id = book_chapters.book_id and b.owner_id = auth.uid()
    ));

drop policy if exists book_sections_owner_access on public.book_sections;
create policy book_sections_owner_access on public.book_sections
    for all using (exists (
        select 1 from public.book_chapters c
        join public.books b on b.id = c.book_id
        where c.id = book_sections.chapter_id and b.owner_id = auth.uid()
    ));

drop policy if exists book_section_topics_owner_access on public.book_section_topics;
create policy book_section_topics_owner_access on public.book_section_topics
    for all using (
        exists (
            select 1 from public.book_sections s
            join public.book_chapters c on c.id = s.chapter_id
            join public.books b on b.id = c.book_id
            where s.id = book_section_topics.section_id and b.owner_id = auth.uid()
        )
        and exists (
            select 1 from public.academy_topics t
            where t.id = book_section_topics.topic_id and t.owner_id = auth.uid()
        )
    );

-- Daily reading goal (sections/day), shown as a progress widget on Today
-- and the Dashboard.
alter table public.user_settings add column if not exists reading_daily_goal integer not null default 1;
