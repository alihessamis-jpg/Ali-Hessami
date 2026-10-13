-- Nephron Academy — add an "anuria, first steps" clinical pearl to the
-- Acute Kidney Injury (AKI) Academy topic's Treatment/management field.
--
-- Idempotent: finds the existing topic named like '%Acute Kidney Injury%'
-- or '%AKI%' for this owner and APPENDS this pearl to its Treatment field
-- (nothing already there is overwritten). If no matching topic exists yet,
-- creates a new top-level one. Safe to re-run -- a guard skips the append
-- if this exact pearl is already present.

do $$
declare
  v_owner_id uuid;
  v_topic_id uuid;
  v_pearl text := $pearl$## Anuria — First Steps (clinical pearl)

In a patient with anuria, before assuming intrinsic renal failure:

1. **Check for a mechanical cause first** — palpate/percuss the bladder for distension, and check the Foley catheter (if one is in place) for kinking/blockage; flush or replace it.
2. If the bladder/Foley is not the problem and there is **no obstruction and no dehydration/volume depletion**, give a diagnostic/therapeutic trial of **furosemide (Lasix) 2–4 mg/kg IV, stat**.
3. No response → continue the standard anuria/AKI workup (volume status, renal ultrasound, labs) rather than repeating Lasix.$pearl$;
begin
  select id into v_owner_id from auth.users where email = 'alihessamis@gmail.com' limit 1;
  if v_owner_id is null then
    raise exception 'owner not found for email alihessamis@gmail.com';
  end if;

  -- Dose correction: an earlier run of this script may already have inserted
  -- the pearl with the wrong dose (1-2 mg/kg); fix it in place wherever it's
  -- already present before deciding whether a fresh append is still needed.
  update public.academy_topics set
    treatment = replace(treatment, 'furosemide (Lasix) 1–2 mg/kg IV, stat', 'furosemide (Lasix) 2–4 mg/kg IV, stat')
  where owner_id = v_owner_id and treatment like '%furosemide (Lasix) 1–2 mg/kg IV, stat%';

  select id into v_topic_id from public.academy_topics
    where owner_id = v_owner_id and (name ilike '%Acute Kidney Injury%' or name ilike '%AKI%')
    limit 1;

  if v_topic_id is null then
    insert into public.academy_topics (
      owner_id, category, name, summary, key_points, study_links, reasoning, treatment, case_questions
    ) values (
      v_owner_id, 'AKI & Dialysis', 'Acute Kidney Injury (AKI)',
      'Anuria first-steps pearl: rule out a mechanical/bladder cause before intrinsic renal failure, trial Lasix if not obstructive/dehydrated, then proceed to standard AKI workup.',
      '[]'::jsonb, '[]'::jsonb,
      null, v_pearl,
      '[]'::jsonb
    );
  else
    update public.academy_topics set
      treatment = coalesce(treatment, '') || case when coalesce(treatment, '') = '' then '' else E'\n\n---\n\n' end || v_pearl
    where id = v_topic_id
      and (treatment is null or treatment not like '%Anuria — First Steps (clinical pearl)%');
  end if;
end $$;
