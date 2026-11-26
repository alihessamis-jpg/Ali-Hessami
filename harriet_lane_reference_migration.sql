-- Nephron — Harriet Lane formulary in the Reference → Drug dosing tab
-- (schema + search functions; the data itself is in seeds/harriet_lane/*.sql).
--
-- Adds source/citation + structured monograph columns to drug_reference so
-- each row can carry a full Harriet Lane Handbook (23rd ed., 2023) Chapter 30
-- monograph — how supplied, neonatal / pediatric / adult dosing, remarks,
-- interactions — plus the Chapter 31 kidney-failure table rows for that drug
-- (renal_adjustment, jsonb). Rows the clinician adds by hand keep working:
-- every new column is nullable and source_key stays null for them.
--
-- Also replaces search_drugs() (name / trade name / class) and adds
-- search_formulary() — full-text-ish search across every monograph, used by
-- the assistant for questions like "meningitis dose" or "drugs that
-- interact with tacrolimus".
--
-- Run order: this file, then seeds/harriet_lane/01..NN, then
-- seeds/harriet_lane/library_chapters.sql. Safe to run multiple times.

alter table public.drug_reference
    add column if not exists source_key             text,   -- e.g. 'hl23:ceftriaxone' (stable id for re-import)
    add column if not exists source                 text,   -- book / edition
    add column if not exists source_chapter         text,
    add column if not exists source_pages           text,   -- e.g. 'p. 859–860'
    add column if not exists trade_names            text,
    add column if not exists drug_class             text,
    add column if not exists how_supplied           text,
    add column if not exists neonatal_dose          text,   -- every dosing line under a neonate/preterm/PMA heading, with its path and page
    add column if not exists meningitis_dose        text,   -- every dosing line mentioning meningitis / CNS infection
    add column if not exists interactions           text,   -- remarks paragraphs about drug interactions / CYP450
    add column if not exists renal_notes            text,   -- remarks paragraphs about renal function / dialysis
    add column if not exists renal_adjustment       jsonb,  -- Chapter 31 table rows: [{name, table, pages, note, adult_only, footnotes, sections:[{label, rows:[{egfr,dose,interval}]}]}]
    add column if not exists pregnancy_category     text,
    add column if not exists breastfeeding_category text,
    add column if not exists renal_caution          boolean,
    add column if not exists hepatic_caution        boolean,
    add column if not exists pharmacogenomic        boolean,
    add column if not exists see_also               text,   -- cross-reference entries ("See Corticotropin")
    add column if not exists monograph              text;   -- the full monograph as markdown, with {p.N} page markers

-- The Library seed looks the Harriet Lane book up by slug; the app's own
-- book-resolution code already uses this column (no-op where it exists).
alter table public.library_books add column if not exists slug text;

create unique index if not exists drug_reference_owner_source_key_uidx
    on public.drug_reference (owner_id, source_key);

-- ---------------------------------------------------------------- search_drugs
-- Name lookup for the assistant's drug_reference tool and the Reference page.
-- Ranks exact name > name prefix > name contains > trade name > class.
create or replace function public.search_drugs(q text, k int default 5)
returns setof public.drug_reference
language sql stable security invoker set search_path = public as $$
  with t as (select btrim(coalesce(q, '')) as q)
  select d.* from drug_reference d, t
  where t.q <> '' and (
        d.medication ilike '%' || t.q || '%'
     or d.trade_names ilike '%' || t.q || '%'
     or d.see_also ilike '%' || t.q || '%'
     or d.indication ilike '%' || t.q || '%'
     or d.drug_class ilike '%' || t.q || '%'
     or t.q ilike '%' || d.medication || '%')
  order by
    (lower(d.medication) = lower(t.q)) desc,
    (d.medication ilike t.q || '%') desc,
    (d.medication ilike '%' || t.q || '%') desc,
    (d.trade_names ilike '%' || t.q || '%') desc,
    (d.see_also is null) desc,
    d.medication
  limit greatest(1, least(k, 20))
$$;

-- ---------------------------------------------------------------- search_formulary
-- Every word of q must appear somewhere in the drug's text (name, trade
-- names, class, monograph, Chapter 31 rows); falls back to ANY word when no
-- drug has all of them. Returns a ~900-character excerpt around the first
-- hit so the assistant can cite it without pulling every monograph.
create or replace function public.search_formulary(q text, k int default 8)
returns table (id uuid, medication text, source text, source_chapter text, source_pages text,
               drug_class text, excerpt text, matched_all boolean)
language plpgsql stable security invoker set search_path = public as $$
declare
  words text[];
  w text;
  use_all boolean;
begin
  words := array(select x from unnest(regexp_split_to_array(lower(btrim(coalesce(q, ''))), '\s+')) x where length(x) >= 2);
  if coalesce(array_length(words, 1), 0) = 0 then
    return;
  end if;
  foreach use_all in array array[true, false] loop
    return query
      with docs as (
        select d.*,
               lower(coalesce(d.medication, '') || ' ' || coalesce(d.trade_names, '') || ' ' || coalesce(d.drug_class, '') || ' ' ||
                     coalesce(d.monograph, '') || ' ' || coalesce(d.renal_adjustment::text, '') || ' ' || coalesce(d.notes, '') || ' ' ||
                     coalesce(d.pediatric_dose, '') || ' ' || coalesce(d.adjusted_dose, '')) as hay
        from drug_reference d
      ), hits as (
        select docs.*,
               (select count(*) from unnest(words) ww where docs.hay like '%' || ww || '%') as n_hit,
               coalesce(nullif(strpos(lower(coalesce(docs.monograph, docs.notes, '')), words[1]), 0),
                        (select min(nullif(strpos(lower(coalesce(docs.monograph, docs.notes, '')), ww), 0)) from unnest(words) ww)) as pos
        from docs
      )
      select h.id, h.medication, h.source, h.source_chapter, h.source_pages, h.drug_class,
             case
               when h.pos is null then left(coalesce(h.monograph, h.notes, h.indication, ''), 900)
               else substr(coalesce(h.monograph, h.notes, ''), greatest(1, h.pos - 350), 900)
             end,
             use_all
      from hits h
      where (use_all and h.n_hit = array_length(words, 1)) or (not use_all and h.n_hit > 0)
      order by
        (select count(*) from unnest(words) ww where lower(h.medication) like '%' || ww || '%') desc,
        h.n_hit desc,
        h.medication
      limit greatest(1, least(k, 20));
    if found then
      return;
    end if;
  end loop;
end;
$$;

grant execute on function public.search_drugs(text, int), public.search_formulary(text, int) to authenticated;
