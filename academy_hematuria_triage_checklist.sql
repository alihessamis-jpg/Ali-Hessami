-- Nephron Academy — add UpToDate Expert AI "hematuria triage checklist (ED
-- evaluation / possible admission)" to the Academy Hematuria topic's Red
-- Flags field.
--
-- Idempotent: finds the existing topic named like '%Hematuria%' for this
-- owner and APPENDS this section to its Red Flags field (nothing already
-- there is overwritten or lost). If no matching topic exists yet, creates a
-- new top-level one. Safe to re-run — a guard skips the append if this
-- exact section is already present.

do $$
declare
  v_owner_id uuid;
  v_topic_id uuid;
  v_section text := $hem_tri$## Hematuria Triage Checklist — ED Evaluation / Possible Admission (UpToDate Expert AI)

### A) Glomerular disease / nephritic picture
- Check blood pressure and assess for edema/weight gain.
- If proteinuria, RBC casts, edema, or hypertension are present, treat as suspected glomerular disease and proceed with glomerular work-up and pediatric nephrology involvement.
- If glomerulonephritis is present without a known preceding streptococcal infection, additional evaluation is needed to determine the cause.

### B) Suspected stone / obstruction pathway
ED evaluation and potential hospitalization if any of the following are present:
- Urinary obstruction with impairment of kidney function.
- Fever with suspected stone, especially if obstruction is present.
- Solitary kidney with ureteral obstruction.
- Need for parenteral fluids and pain medications due to severe pain.
- Unable to take oral analgesics or fluids (e.g. vomiting).

### C) Trauma / significant bleeding concern
- Assess for low blood pressure in the setting of significant bleeding due to trauma.

*Source: UpToDate Expert AI (AI-generated clinical response), kept here as a personal study reference — cross-check against the primary UpToDate topic before using it to guide actual patient care.*$hem_tri$;
begin
  select id into v_owner_id from auth.users where email = 'alihessamis@gmail.com' limit 1;
  if v_owner_id is null then
    raise exception 'owner not found for email alihessamis@gmail.com';
  end if;

  select id into v_topic_id from public.academy_topics
    where owner_id = v_owner_id and name ilike '%Hematuria%'
    limit 1;

  if v_topic_id is null then
    insert into public.academy_topics (
      owner_id, category, name, summary, key_points, study_links, red_flags, case_questions
    ) values (
      v_owner_id, 'Glomerular & Urologic', 'Hematuria',
      'Approach to the child with microscopic or gross hematuria: localize glomerular vs. nonglomerular bleeding, then let history/exam/urinalysis findings pick the diagnostic pathway (stones, UTI, glomerular disease, or unexplained).',
      '[]'::jsonb, '[]'::jsonb,
      v_section,
      '[]'::jsonb
    );
  else
    update public.academy_topics set
      red_flags = coalesce(red_flags, '') || case when coalesce(red_flags, '') = '' then '' else E'\n\n---\n\n' end || v_section
    where id = v_topic_id
      and (red_flags is null or red_flags not like '%Hematuria Triage Checklist%');
  end if;
end $$;
