-- Nephron — Reading Review: Leitner-box columns for questions saved from
-- Board Questions, Lab Challenges, Imaging Challenges, and Reasoning Cases.
--
-- Manually-logged articles keep using the existing fixed checkpoint
-- schedule (review_3d_done etc.) untouched. Items saved via the new "Save
-- to reading review" buttons instead populate answer/origin and get
-- scheduled with the same adaptive Leitner-box intervals already used for
-- flashcards (1/3/7/14/30/60 days, via public.reading_items.next_review).
-- `origin` is what tells the app which scheduling mode an item uses, so an
-- existing article (origin left null) is unaffected.
--
-- Safe to run multiple times (every statement is idempotent).

alter table public.reading_items add column if not exists answer text;
alter table public.reading_items add column if not exists origin text;
alter table public.reading_items add column if not exists interval_index integer;
alter table public.reading_items add column if not exists last_reviewed date;
alter table public.reading_items add column if not exists next_review date;
alter table public.reading_items add column if not exists review_history jsonb not null default '[]'::jsonb;
