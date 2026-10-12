-- Nephron — chapter-note import, NEPHRON_CHAPTER_FORMAT.md v1.3.
--
-- v1.3 adds book figures: `![caption](figures/ch49-fig1.jpg){#ch49-fig1 .figure}`.
-- Each chapter can carry one or more figure images, uploaded to a new
-- private Supabase Storage bucket (`chapter-figures`) and referenced by a
-- stable `figure_key` (e.g. "ch49-fig1") -- re-import replaces the same
-- row/file in place instead of duplicating, same pattern as import_key on
-- library_cards. Exam-bullet cards whose "#### label" group names a figure
-- (contains «شکل») carry that figure's key too, so Review can show the
-- figure on the card back.
--
-- Safe to run multiple times (idempotent).

create table if not exists public.library_chapter_figures (
    id           uuid primary key default gen_random_uuid(),
    owner_id     uuid not null references auth.users (id) on delete cascade,
    chapter_id   uuid not null references public.library_chapters (id) on delete cascade,
    figure_key   text not null,                 -- e.g. "ch49-fig1", stable across re-import
    storage_path text not null,                 -- object path inside the chapter-figures bucket
    caption      text,
    created_at   timestamptz not null default now()
);

create index if not exists library_chapter_figures_chapter_id_idx on public.library_chapter_figures (chapter_id);

-- Mirrors library_cards_chapter_import_key_idx: lets Supabase's
-- upsert(..., {onConflict: 'chapter_id,figure_key'}) replace a figure's row
-- in place on re-import instead of duplicating it.
create unique index if not exists library_chapter_figures_chapter_key_idx
    on public.library_chapter_figures (chapter_id, figure_key);

alter table public.library_cards
    add column if not exists figure_key text; -- v1.3: matches a library_chapter_figures.figure_key

alter table public.library_chapter_figures enable row level security;

drop policy if exists library_chapter_figures_owner_access on public.library_chapter_figures;
create policy library_chapter_figures_owner_access on public.library_chapter_figures
    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Storage bucket for the figure image files themselves. Private (not
-- public): the app reads them via short-lived signed URLs, same pattern as
-- the existing `imaging` bucket. Object paths are
-- "<user id>/ch<chapter number>/<figure_key>.<ext>", so the RLS policy
-- below scopes access by matching the leading path segment to the caller's
-- own auth.uid() -- identical in shape to the imaging bucket's existing
-- per-user folder convention.
insert into storage.buckets (id, name, public)
values ('chapter-figures', 'chapter-figures', false)
on conflict (id) do nothing;

drop policy if exists chapter_figures_owner_access on storage.objects;
create policy chapter_figures_owner_access on storage.objects
    for all
    using (bucket_id = 'chapter-figures' and (storage.foldername(name))[1] = auth.uid()::text)
    with check (bucket_id = 'chapter-figures' and (storage.foldername(name))[1] = auth.uid()::text);
