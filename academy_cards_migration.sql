-- Nephron — card-level spaced repetition for Academy topics.
--
-- Backs the new "Make card" flow on a topic's summary (select text -> cloze
-- card) and "Make cards from table" (one card per data cell). Cards reuse
-- the same Leitner-box SRS columns/engine as flashcards and reading_items
-- (lib/srs.ts scheduleReview) so Today's due queue and Board Readiness can
-- treat them the same way.
--
-- Safe to run multiple times (idempotent).

create table if not exists public.academy_cards (
    id             uuid primary key default gen_random_uuid(),
    owner_id       uuid not null references auth.users (id) on delete cascade,
    topic_id       uuid not null references public.academy_topics (id) on delete cascade,
    kind           text not null default 'cloze', -- 'cloze' | 'cell'
    section_key    text,                           -- which AcademyTopic field this came from (e.g. 'summary')
    book_page      integer,
    prompt         text not null,
    answer         text not null,
    interval_index integer not null default -1,
    last_reviewed  date,
    next_review    date,
    review_history jsonb not null default '[]'::jsonb,
    created_at     timestamptz not null default now()
);

create index if not exists academy_cards_topic_id_idx on public.academy_cards (topic_id);
create index if not exists academy_cards_owner_id_idx on public.academy_cards (owner_id);

alter table public.academy_cards enable row level security;

drop policy if exists academy_cards_owner_access on public.academy_cards;
create policy academy_cards_owner_access on public.academy_cards
    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
