-- Nephron — Academy review pacing: daily new-card limit.
--
-- Backs the new "new cards per day" setting (Settings page) that caps how
-- many never-reviewed cards ReviewPage introduces in a single day,
-- separate from cards that are actually due for repetition.
--
-- Safe to run multiple times (idempotent).

alter table public.user_settings
    add column if not exists daily_new_card_limit integer not null default 20;
