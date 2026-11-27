-- Academy · Topic Hub — ADDITIVE ONLY (no drops, no data rewrites).
--
-- academy_topics.my_notes   «📝 یادداشت من» — the clinician's own note per topic,
--                           kept apart from the reviewed book text.
-- academy_topics.edited_at  set by the app when a topic is edited by hand, so the
--                           UI can show «ویرایش دستی — تاریخ» next to (not instead
--                           of) the «✅ بازبینی‌شده» line in the summary.
-- ai_conversations.topic_id the Topic Hub page a conversation was opened from; the
--                           assistant searches that topic's chapters
--                           (chapter_topics) first.
-- Safe to run more than once.

alter table public.academy_topics add column if not exists my_notes text;
alter table public.academy_topics add column if not exists edited_at timestamptz;

alter table public.ai_conversations
    add column if not exists topic_id uuid references public.academy_topics (id) on delete set null;
