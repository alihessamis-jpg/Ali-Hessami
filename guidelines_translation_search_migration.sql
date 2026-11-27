-- Academy · Guidelines — Persian translations + source-cited search
--
-- library_chunk_translations: a Persian translation of one library_chunks
-- passage (made on demand by the assistant edge function, action
-- 'translate'). Keyed by (chapter, part, section, sub-chunk) plus a hash of
-- the English text, so re-importing a guideline keeps translations whose
-- source text did not change and quietly drops the rest.
--
-- search_guidelines(q, k): full-text search over guideline books only, in
-- the English text AND the Persian translations, returning everything needed
-- to cite the source (guideline, chapter, section, PDF page) and to jump
-- there in the Reader. SECURITY INVOKER, so RLS keeps it per user.

create table if not exists public.library_chunk_translations (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  chapter_id   uuid not null references public.library_chapters(id) on delete cascade,
  part_number  integer not null default 0,
  section_idx  integer not null,
  sub_idx      integer not null default 0,
  source_hash  text not null,
  content      text not null,
  model        text,
  created_at   timestamptz not null default now()
);

create unique index if not exists library_chunk_translations_pos_uidx
  on public.library_chunk_translations (chapter_id, part_number, section_idx, sub_idx);
create index if not exists library_chunk_translations_owner_idx on public.library_chunk_translations (owner_id);
create index if not exists library_chunk_translations_pgroonga_idx
  on public.library_chunk_translations using pgroonga (content);

alter table public.library_chunk_translations enable row level security;
drop policy if exists library_chunk_translations_owner_access on public.library_chunk_translations;
create policy library_chunk_translations_owner_access on public.library_chunk_translations
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create or replace function public.search_guidelines(q text, k int default 20)
returns table (
  chunk_id uuid, lang text, book_id uuid, book_title text, organization text, chapter_id uuid,
  chapter_title text, heading text, anchor text, page_from int, page_to int, snippet text, score double precision)
language plpgsql stable security invoker
set search_path = public, extensions
as $$
declare qq text; pass int; n int;
begin
  for pass in 1 .. 2 loop
    qq := ai_query(q, pass = 2);
    if qq = '' then return; end if;
    return query
      select * from (
        select ch.id, 'en'::text, b.id, b.title, b.organization, ch.chapter_id, c.title, ch.heading, ch.anchor,
               ch.page_from, ch.page_to,
               array_to_string((pgroonga_snippet_html(ch.content, pgroonga_query_extract_keywords(qq), 220))[1:2], ' … '),
               pgroonga_score(ch.tableoid, ch.ctid)
        from library_chunks ch
        join library_chapters c on c.id = ch.chapter_id
        join library_books b on b.id = ch.book_id
        where b.kind = 'guideline' and ch.content &@~ qq
        union all
        select ch.id, 'fa'::text, b.id, b.title, b.organization, t.chapter_id, c.title, ch.heading, ch.anchor,
               ch.page_from, ch.page_to,
               array_to_string((pgroonga_snippet_html(t.content, pgroonga_query_extract_keywords(qq), 220))[1:2], ' … '),
               pgroonga_score(t.tableoid, t.ctid)
        from library_chunk_translations t
        join library_chunks ch on ch.chapter_id = t.chapter_id and coalesce(ch.part_number, 0) = t.part_number
                              and ch.section_idx = t.section_idx and ch.sub_idx = t.sub_idx
        join library_chapters c on c.id = t.chapter_id
        join library_books b on b.id = c.book_id
        where b.kind = 'guideline' and t.content &@~ qq
      ) r
      order by 13 desc
      limit greatest(1, least(k, 50));
    get diagnostics n = row_count;
    if n > 0 then return; end if;
  end loop;
end;
$$;
