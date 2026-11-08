-- Daily Persian verse (بیت روز): one classical verse per day shown on the
-- Today page, archived with its date so it can be revisited and memorized.
-- Each row also carries SRS state (same shape as flashcards) so saved
-- verses come back in the Today review queue: first hemistich as the
-- prompt, second hemistich as the answer.
create table if not exists public.daily_verses (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
    shown_on        date not null,
    verse_key       text not null,
    poet            text not null,
    line1           text not null,
    line2           text not null,
    source          text,
    memorized       boolean not null default false,
    interval_index  integer not null default -1,
    last_reviewed   date,
    next_review     date,
    review_history  jsonb not null default '[]'::jsonb,
    created_at      timestamptz not null default now(),
    unique (user_id, shown_on)
);

create index if not exists daily_verses_user_next_review_idx
    on public.daily_verses (user_id, next_review);

alter table public.daily_verses enable row level security;

drop policy if exists daily_verses_self_access on public.daily_verses;
create policy daily_verses_self_access on public.daily_verses
    for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
