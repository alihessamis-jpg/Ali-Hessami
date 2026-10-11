-- Nephron — chapter-note import, NEPHRON_CHAPTER_FORMAT.md v1.1.
--
-- v1.1 adds two things a suggested card can carry: `topic` (the "#### label"
-- group a bullet sits under inside its "نکات امتحانی" panel -- not a card
-- itself) and `high_yield` (from a trailing ⭐ on the bullet or its group
-- label). Everything else v1.1 adds (nested bullets, [[links]], the
-- nephron-chart block, English-paragraph LTR) is rendering/parsing only
-- and needs no schema change.
--
-- Safe to run multiple times (idempotent).

alter table public.library_cards
    add column if not exists topic      text,
    add column if not exists high_yield boolean not null default false;
