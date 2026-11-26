-- Academy · Guidelines
--
-- Clinical practice guidelines live in the same library tables as textbooks
-- (library_books / library_chapters), flagged with kind = 'guideline'. That
-- way every guideline chapter note is chunked into library_chunks by the
-- existing triggers, so the Nephron assistant's search_library / read_section
-- tools see the full guideline text with no extra plumbing, and the Reader,
-- cards, highlights and "Ask AI" chips all work on guideline chapters too.
--
-- The Library's book switcher hides kind = 'guideline' rows; the Academy's
-- Guidelines tab lists them with the metadata below.

alter table public.library_books
  add column if not exists kind text not null default 'book',
  add column if not exists organization text,      -- e.g. KDIGO, AAP
  add column if not exists doc_status text,        -- e.g. 'Public review draft', 'Final'
  add column if not exists citation text,          -- how to cite / where it was published
  add column if not exists scope text,             -- population the guideline covers
  add column if not exists summary text,           -- one-paragraph Persian overview
  add column if not exists highlights jsonb not null default '[]'::jsonb, -- [{label, text, tone}]
  add column if not exists pdf_path text;          -- original PDF in the chapter-figures bucket

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'library_books_kind_check') then
    alter table public.library_books
      add constraint library_books_kind_check check (kind in ('book', 'guideline'));
  end if;
end $$;

create index if not exists library_books_kind_idx on public.library_books (kind);
