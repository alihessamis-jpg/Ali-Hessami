-- Nephron Assistant · Phase 1 — retrieval layer
--
-- library_chunks: every chapter note / chapter-part note split on "\n## "
-- (one row per section; sections longer than ~1500 chars are split further
-- on paragraph boundaries -> sub_idx). Kept in sync by triggers on
-- library_chapters.note / library_chapter_parts.note, plus a manual
-- reindex_library() the app calls from the «بازسازی نمایه» button.
--
-- Full-text search uses PGroonga (Persian + English in one index). All
-- functions are SECURITY INVOKER, so RLS (owner_id = auth.uid()) applies.

create extension if not exists pgroonga with schema extensions;

-- ---------------------------------------------------------------- table
create table if not exists public.library_chunks (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  book_id     uuid references public.library_books(id) on delete cascade,
  chapter_id  uuid not null references public.library_chapters(id) on delete cascade,
  part_id     uuid references public.library_chapter_parts(id) on delete cascade,
  part_number integer,                 -- null = the chapter's own note
  section_idx integer not null,        -- 0 = text before the first "## "
  sub_idx     integer not null default 0,
  heading     text not null default '',
  anchor      text,                    -- {#id} to jump to in the reader
  content     text not null,
  page_from   integer,
  page_to     integer,
  created_at  timestamptz not null default now()
);

create unique index if not exists library_chunks_pos_uidx
  on public.library_chunks (chapter_id, coalesce(part_number, 0), section_idx, sub_idx);
create index if not exists library_chunks_owner_idx on public.library_chunks (owner_id);
create index if not exists library_chunks_part_idx on public.library_chunks (part_id);

alter table public.library_chunks enable row level security;
drop policy if exists library_chunks_owner_access on public.library_chunks;
create policy library_chunks_owner_access on public.library_chunks
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------------------------------------------------------------- pgroonga indexes
create index if not exists library_chunks_pgroonga_idx
  on public.library_chunks using pgroonga (content);
create index if not exists library_cards_pgroonga_idx
  on public.library_cards using pgroonga ((array[front, coalesce(back, '')]));
create index if not exists board_questions_pgroonga_idx
  on public.board_questions using pgroonga ((array[question, coalesce(explanation, '')]));

-- ---------------------------------------------------------------- helpers
-- Unify Arabic/Persian letter variants and turn free text into a pgroonga
-- query: every word escaped, joined with AND (' ') or OR.
create or replace function public.ai_norm(q text)
returns text language sql immutable as $$
  select btrim(regexp_replace(translate(coalesce(q, ''), 'يكۀة‌', 'یکهه '), '\s+', ' ', 'g'))
$$;

create or replace function public.ai_query(q text, use_or boolean default false)
returns text language sql immutable set search_path = public, extensions as $$
  select coalesce(string_agg(pgroonga_query_escape(w), case when use_or then ' OR ' else ' ' end), '')
  from unnest(regexp_split_to_array(public.ai_norm(q), ' ')) w
  where w <> ''
$$;

-- Split one note into chunks.
create or replace function public.chunk_note(p_note text, p_title text)
returns table (section_idx int, sub_idx int, heading text, anchor text, content text, page_from int, page_to int)
language plpgsql immutable as $$
declare
  secs text[];
  sec text;
  first_line text;
  body text;
  sec_heading text;
  sec_anchor text;
  paras text[];
  para text;
  buf text;
  i int;
  sub int;
  sub_head text;
  pages int[];
begin
  if p_note is null or btrim(p_note) = '' then
    return;
  end if;
  secs := regexp_split_to_array(E'\n' || p_note, E'\n## ');
  for i in 1 .. coalesce(array_length(secs, 1), 0) loop
    sec := secs[i];
    if i = 1 then
      sec_heading := coalesce(p_title, '');
      sec_anchor := null;
      body := sec;
      if btrim(body) = '' then continue; end if;
    else
      first_line := split_part(sec, E'\n', 1);
      body := substr(sec, length(first_line) + 2);
      sec_anchor := substring(first_line from '\{#([\w-]+)\}');
      sec_heading := btrim(regexp_replace(first_line, '\s*\{[^}]*\}\s*$', ''));
    end if;

    sub := 0;
    buf := '';
    paras := regexp_split_to_array(body, E'\n[ \t]*\n');
    foreach para in array paras || array[null::text] loop
      if para is null or (length(buf) > 0 and length(buf) + length(para) > 1500) then
        if btrim(buf) <> '' then
          section_idx := i - 1;
          sub_idx := sub;
          -- a chunk that starts at a "### sub-heading {#id}" jumps there
          sub_head := substring(btrim(buf) from '^###\s+([^\n]+)');
          anchor := coalesce(
            case when sub > 0 then substring(buf from '\{#([\w-]+)[^}]*\}') end,
            sec_anchor);
          heading := sec_heading ||
            case when sub_head is not null
              then ' › ' || btrim(regexp_replace(sub_head, '\s*\{[^}]*\}\s*$', ''))
              else '' end;
          content := case when i = 1 then '' else '## ' || sec_heading || E'\n\n' end || btrim(buf);
          select array_agg(m[1]::int) into pages
            from regexp_matches(buf, '\{p\.(\d+)\}', 'g') m;
          page_from := (select min(pg) from unnest(pages) pg);
          page_to := (select max(pg) from unnest(pages) pg);
          return next;
          sub := sub + 1;
        end if;
        buf := '';
      end if;
      if para is not null then
        buf := case when buf = '' then para else buf || E'\n\n' || para end;
      end if;
    end loop;
  end loop;
end;
$$;

-- ---------------------------------------------------------------- re-index
create or replace function public.reindex_chapter_note(p_chapter uuid)
returns integer language plpgsql security invoker set search_path = public, extensions as $$
declare n int;
begin
  delete from library_chunks where chapter_id = p_chapter and part_id is null;
  insert into library_chunks (owner_id, book_id, chapter_id, part_id, part_number, section_idx, sub_idx,
                              heading, anchor, content, page_from, page_to)
  select c.owner_id, c.book_id, c.id, null, null, k.section_idx, k.sub_idx, k.heading, k.anchor, k.content,
         coalesce(k.page_from, c.start_page), coalesce(k.page_to, c.end_page)
  from library_chapters c, chunk_note(c.note, c.title) k
  where c.id = p_chapter;
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.reindex_chapter_part(p_part uuid)
returns integer language plpgsql security invoker set search_path = public, extensions as $$
declare n int;
begin
  delete from library_chunks where part_id = p_part;
  insert into library_chunks (owner_id, book_id, chapter_id, part_id, part_number, section_idx, sub_idx,
                              heading, anchor, content, page_from, page_to)
  select p.owner_id, c.book_id, c.id, p.id, p.part_number, k.section_idx, k.sub_idx, k.heading, k.anchor, k.content,
         coalesce(k.page_from, c.start_page), coalesce(k.page_to, c.end_page)
  from library_chapter_parts p
  join library_chapters c on c.id = p.chapter_id,
  chunk_note(p.note, coalesce(p.title, c.title)) k
  where p.id = p_part;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Re-chunk everything the caller can see (RLS-scoped). Returns chunk count.
create or replace function public.reindex_library()
returns integer language plpgsql security invoker set search_path = public, extensions as $$
declare r record; n int := 0;
begin
  for r in select id from library_chapters where note is not null loop
    n := n + reindex_chapter_note(r.id);
  end loop;
  for r in select id from library_chapter_parts where note is not null loop
    n := n + reindex_chapter_part(r.id);
  end loop;
  return n;
end;
$$;

create or replace function public.trg_chapter_note_chunks()
returns trigger language plpgsql security invoker set search_path = public, extensions as $$
begin
  perform reindex_chapter_note(new.id);
  return null;
end;
$$;

create or replace function public.trg_part_note_chunks()
returns trigger language plpgsql security invoker set search_path = public, extensions as $$
begin
  perform reindex_chapter_part(new.id);
  return null;
end;
$$;

drop trigger if exists library_chapters_chunks on public.library_chapters;
create trigger library_chapters_chunks
  after insert or update of note, title, start_page, end_page on public.library_chapters
  for each row execute function public.trg_chapter_note_chunks();

drop trigger if exists library_chapter_parts_chunks on public.library_chapter_parts;
create trigger library_chapter_parts_chunks
  after insert or update of note, title, part_number on public.library_chapter_parts
  for each row execute function public.trg_part_note_chunks();

-- ---------------------------------------------------------------- search
-- Book passages. AND-match first; if that finds nothing, OR-match.
create or replace function public.search_library(q text, chapter uuid default null, k int default 8)
returns table (
  chunk_id uuid, book_id uuid, book_title text, chapter_id uuid, chapter_number int, chapter_title text,
  part_number int, section_idx int, sub_idx int, heading text, anchor text,
  page_from int, page_to int, content text, snippet text, score double precision)
language plpgsql stable security invoker
set search_path = public, extensions
set enable_seqscan = off
as $$
declare
  qq text;
  pass int;
begin
  for pass in 1 .. 2 loop
    qq := ai_query(q, pass = 2);
    if qq = '' then return; end if;
    return query
      select ch.id, ch.book_id, b.title, ch.chapter_id, c.chapter_number, c.title,
             ch.part_number, ch.section_idx, ch.sub_idx, ch.heading, ch.anchor,
             ch.page_from, ch.page_to, ch.content,
             array_to_string((pgroonga_snippet_html(ch.content, pgroonga_query_extract_keywords(qq), 180))[1:2], ' … '),
             pgroonga_score(ch.tableoid, ch.ctid)
      from library_chunks ch
      join library_chapters c on c.id = ch.chapter_id
      left join library_books b on b.id = ch.book_id
      where ch.content &@~ qq
        and (search_library.chapter is null or ch.chapter_id = search_library.chapter)
      order by 16 desc
      limit greatest(1, least(k, 30));
    if found then return; end if;
  end loop;
end;
$$;

create or replace function public.search_cards(q text, k int default 8)
returns table (card_id uuid, chapter_id uuid, chapter_title text, kind text, front text, back text,
               section_number text, chapter_part int, snippet text, score double precision)
language plpgsql stable security invoker
set search_path = public, extensions
set enable_seqscan = off
as $$
declare qq text; pass int;
begin
  for pass in 1 .. 2 loop
    qq := ai_query(q, pass = 2);
    if qq = '' then return; end if;
    return query
      select cd.id, cd.chapter_id, c.title, cd.kind, cd.front, cd.back, cd.section_number, cd.chapter_part,
             array_to_string((pgroonga_snippet_html(cd.front || E'\n' || coalesce(cd.back, ''),
                               pgroonga_query_extract_keywords(qq), 160))[1:1], ''),
             pgroonga_score(cd.tableoid, cd.ctid)
      from library_cards cd
      left join library_chapters c on c.id = cd.chapter_id
      where array[cd.front, coalesce(cd.back, '')] &@~ qq
        and cd.status = 'approved'
      order by 10 desc
      limit greatest(1, least(k, 30));
    if found then return; end if;
  end loop;
end;
$$;

create or replace function public.search_questions(q text, k int default 8)
returns table (question_id uuid, chapter_id uuid, chapter_title text, topic text, question text,
               options jsonb, correct_index int, explanation text, snippet text, score double precision)
language plpgsql stable security invoker
set search_path = public, extensions
set enable_seqscan = off
as $$
declare qq text; pass int;
begin
  for pass in 1 .. 2 loop
    qq := ai_query(q, pass = 2);
    if qq = '' then return; end if;
    return query
      select bq.id, bq.chapter_id, c.title, bq.topic, bq.question, bq.options, bq.correct_index, bq.explanation,
             array_to_string((pgroonga_snippet_html(bq.question || E'\n' || coalesce(bq.explanation, ''),
                               pgroonga_query_extract_keywords(qq), 160))[1:1], ''),
             pgroonga_score(bq.tableoid, bq.ctid)
      from board_questions bq
      left join library_chapters c on c.id = bq.chapter_id
      where array[bq.question, coalesce(bq.explanation, '')] &@~ qq
        and coalesce(bq.review_status, 'approved') = 'approved'
      order by 10 desc
      limit greatest(1, least(k, 30));
    if found then return; end if;
  end loop;
end;
$$;

-- drug_reference is small; plain ILIKE on name/indication is enough.
create or replace function public.search_drugs(q text, k int default 5)
returns setof public.drug_reference
language sql stable security invoker set search_path = public as $$
  select d.* from drug_reference d
  where d.medication ilike '%' || btrim(q) || '%'
     or d.indication ilike '%' || btrim(q) || '%'
     or btrim(q) ilike '%' || d.medication || '%'
  order by (d.medication ilike btrim(q) || '%') desc, d.medication
  limit greatest(1, least(k, 20))
$$;

-- One whole section (all its sub-chunks joined). part = null -> chapter's own note.
create or replace function public.get_section(chapter uuid, idx int, part int default null)
returns table (chapter_id uuid, chapter_title text, book_title text, part_number int, section_idx int,
               heading text, anchor text, page_from int, page_to int, content text)
language sql stable security invoker set search_path = public as $$
  select ch.chapter_id, c.title, b.title, ch.part_number, ch.section_idx,
         (array_agg(ch.heading order by ch.sub_idx))[1],
         (array_agg(ch.anchor order by ch.sub_idx))[1],
         min(ch.page_from), max(ch.page_to),
         string_agg(case when ch.sub_idx = 0 then ch.content
                         else regexp_replace(ch.content, '^## [^\n]*\n\n', '') end, E'\n\n' order by ch.sub_idx)
  from library_chunks ch
  join library_chapters c on c.id = ch.chapter_id
  left join library_books b on b.id = ch.book_id
  where ch.chapter_id = get_section.chapter
    and ch.section_idx = get_section.idx
    and coalesce(ch.part_number, 0) = coalesce(get_section.part, 0)
  group by ch.chapter_id, c.title, b.title, ch.part_number, ch.section_idx
$$;

create or replace function public.chapter_outline(chapter uuid)
returns table (part_number int, section_idx int, heading text, anchor text, chunks int, chars int)
language sql stable security invoker set search_path = public as $$
  select ch.part_number, ch.section_idx,
         (array_agg(ch.heading order by ch.sub_idx))[1],
         (array_agg(ch.anchor order by ch.sub_idx))[1],
         count(*)::int, sum(length(ch.content))::int
  from library_chunks ch
  where ch.chapter_id = chapter_outline.chapter
  group by ch.part_number, ch.section_idx
  order by coalesce(ch.part_number, 0), ch.section_idx
$$;

-- ---------------------------------------------------------------- patient
-- De-identified case JSON for the assistant. Never returns name, code, bed,
-- DOB or admission date; dates become "days ago"; any occurrence of the
-- name/code/bed inside free text is replaced by «[حذف‌شده]».
create or replace function public.patient_context(patient uuid)
returns jsonb
language plpgsql stable security invoker set search_path = public as $$
declare
  p patients%rowtype;
  j jsonb;
  t text;
  tok text;
begin
  select * into p from patients where id = patient_context.patient;
  if not found then return null; end if;

  j := jsonb_strip_nulls(jsonb_build_object(
    'age_years', p.age,
    'sex', p.sex,
    'weight_kg', p.weight,
    'height_cm', p.height,
    'weight_pct', p.weight_pct, 'height_pct', p.height_pct, 'bmi_pct', p.bmi_pct,
    'diagnosis', p.diagnosis,
    'underlying_disease', p.underlying_disease,
    'baseline_cr', p.baseline_cr, 'baseline_egfr', p.baseline_egfr,
    'dialysis_status', p.dialysis_status, 'dialysis_modality', p.dialysis_modality,
    'transplant_status', p.transplant_status, 'care_status', p.care_status,
    'days_since_admission', case when p.doa is not null then current_date - p.doa end,
    'history', jsonb_strip_nulls(jsonb_build_object(
      'chief_complaint', p.chief_complaint, 'hpi', p.hpi, 'key_points', p.key_points,
      'family_hx', p.family_hx, 'pmh', p.pmh, 'med_hx', p.med_hx, 'allergy_hx', p.allergy_hx,
      'dialysis_hx', p.dialysis_hx, 'transplant_hx', p.transplant_hx)),
    'vitals', jsonb_strip_nulls(jsonb_build_object(
      'temp', p.vs_temp, 'hr', p.vs_hr, 'rr', p.vs_rr, 'bp', p.vs_bp, 'spo2', p.vs_spo2)),
    'exam', jsonb_strip_nulls(jsonb_build_object(
      'general', p.ex_general, 'heent', p.ex_heent, 'cvs', p.ex_cvs, 'resp', p.ex_resp, 'abd', p.ex_abd,
      'gu', p.ex_gu, 'extremities', p.ex_extrem, 'skin', p.ex_skin, 'neuro', p.ex_neuro,
      'edema', p.ex_edema, 'hydration', p.ex_hydration)),
    'labs', (select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                 'days_ago', current_date - l.date, 'test', l.test,
                 'value', coalesce(l.value::text, l.value_text), 'unit', l.unit, 'ref', l.ref, 'comment', l.comment))
               order by l.date desc, l.test)
             from (select * from lab_entries where patient_id = p.id order by date desc limit 80) l),
    'medications', (select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                 'name', m.name, 'dose', m.dose, 'dose_per_kg', m.dose_kg, 'route', m.route, 'freq', m.freq,
                 'indication', m.indication, 'renal_adj', m.renal_adj, 'active', m.active,
                 'started_days_ago', current_date - m.start_date)) order by m.active desc, m.name)
             from medications m where m.patient_id = p.id),
    'growth', (select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                 'days_ago', current_date - g.date, 'height_cm', g.height_cm, 'weight_kg', g.weight_kg,
                 'bp', case when g.bp_systolic is not null then g.bp_systolic || '/' || g.bp_diastolic end))
               order by g.date desc)
             from (select * from growth_entries where patient_id = p.id order by date desc limit 10) g),
    'progress_notes', (select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                 'days_ago', current_date - n.date, 'weight', n.weight, 'bp', n.bp, 'uo', n.uo,
                 'S', n.subjective, 'O', n.objective, 'A', n.assessment, 'P', n.plan))
               order by n.date desc)
             from (select * from progress_notes where patient_id = p.id order by date desc limit 5) n)
  ));

  -- scrub identifiers that leaked into free text
  -- (whole-word matches only; a purely numeric code/bed shorter than 5
  -- digits is skipped so lab values like "120" are never mangled)
  t := j::text;
  foreach tok in array
    array_remove(regexp_split_to_array(btrim(coalesce(p.name, '')), '\s+') || array[btrim(p.code), btrim(p.bed)], null)
  loop
    if length(tok) >= 2 and not (tok ~ '^\d+$' and length(tok) < 5) then
      t := regexp_replace(t,
        '(?<![[:alnum:]])' || regexp_replace(tok, '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '(?![[:alnum:]])',
        '[حذف‌شده]', 'g');
    end if;
  end loop;
  return t::jsonb;
end;
$$;

grant execute on function
  public.search_library(text, uuid, int), public.search_cards(text, int), public.search_questions(text, int),
  public.search_drugs(text, int), public.get_section(uuid, int, int), public.chapter_outline(uuid),
  public.patient_context(uuid), public.reindex_library(), public.reindex_chapter_note(uuid),
  public.reindex_chapter_part(uuid)
to authenticated;
