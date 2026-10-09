-- Nephron — chapter-note import (NEPHRON_CHAPTER_FORMAT.md v1).
--
-- Adds the metadata a parsed .md chapter note carries (subtitle, language,
-- direction, which format version it was imported with, when) and the
-- fields that let the Reader's "نکات امتحانی" (exam points) blocks turn
-- into unscheduled SUGGESTED cards instead of immediately-due ones:
-- `status` separates suggested from approved cards, `import_key` is the
-- stable (section id + position) identity re-import upserts on so the
-- same file imported twice updates text in place instead of duplicating
-- cards or resetting their FSRS/review history, and `tags` carries things
-- like the "not book" tag from a `[!outside]` block.
--
-- Safe to run multiple times (idempotent).

alter table public.library_chapters
    add column if not exists subtitle    text,
    add column if not exists language    text,
    add column if not exists direction   text,
    add column if not exists note_format text,
    add column if not exists imported_at timestamptz;

alter table public.library_cards
    add column if not exists status     text not null default 'approved', -- 'suggested' | 'approved'
    add column if not exists import_key text,
    add column if not exists tags       jsonb not null default '[]'::jsonb;

-- No WHERE clause needed: Postgres never treats two NULLs as conflicting in
-- a unique index, so manually-created cards (import_key always null) never
-- collide with each other or with imported ones, and the plain column list
-- below is what Supabase's upsert(..., {onConflict: 'chapter_id,import_key'})
-- can target directly (ON CONFLICT inference on a partial index needs a
-- matching WHERE clause on the upsert itself, which the JS client can't add).
create unique index if not exists library_cards_chapter_import_key_idx
    on public.library_cards (chapter_id, import_key);
