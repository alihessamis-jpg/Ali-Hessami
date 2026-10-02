-- Nephron Academy — add UpToDate Expert AI "approach to the child with
-- suspected HUS" content to the Academy topic for Hemolytic Uremic Syndrome.
--
-- Idempotent: finds the existing topic named like '%HUS%' or
-- '%Hemolytic Uremic%' for this owner and APPENDS the diagnostic-approach
-- section to its Approach (reasoning) field and the management section to
-- its Treatment field — nothing already there is overwritten or lost. If no
-- matching topic exists yet, creates a new top-level one. Safe to re-run —
-- a guard skips each append if that exact section is already present.

do $$
declare
  v_owner_id uuid;
  v_topic_id uuid;
  v_reasoning text := $hus_r$## Approach to the Child with Suspected HUS (UpToDate Expert AI)

*Case framing: child with suspected hemolytic uremic syndrome (HUS) based on anemia, thrombocytopenia, and acute kidney injury.*

The approach is to (1) confirm the HUS triad (microangiopathic hemolytic anemia, thrombocytopenia, acute kidney injury), (2) rapidly evaluate for the underlying etiology (especially STEC-HUS vs. complement-mediated TMA vs. mimics like DIC/TTP), and (3) start supportive management while that evaluation is underway.

### Confirm HUS and assess severity
- Confirm microangiopathic hemolytic anemia and thrombocytopenia with CBC and peripheral smear review.
- Confirm kidney involvement with kidney function studies and urinalysis.
- Assess for oliguria/anuria and hypertension, which are common in HUS.

### Identify the underlying etiology and key mimics
- Send testing for Shiga toxin–producing organisms (stool or rectal swab Shiga toxin PCR, stool culture, other available STEC testing) to help distinguish STEC-HUS from other causes. Obtain stool/rectal testing rapidly — a negative stool test does not rule out STEC-HUS.
- History clues: STEC exposures (undercooked ground beef, contaminated water, farm-animal contact); family history (concurrent cases suggest an infectious cause, remote/prior cases suggest complement-mediated disease); prior HUS episodes (suggest complement-mediated); medication exposures; associated conditions.
- If severe infection is present, obtain cultures as clinically indicated and consider pneumococcal-associated HUS; obtain coagulation studies in selected settings to help distinguish HUS from DIC.
- If there is concern for complement-mediated TMA, obtain complement studies (C3/C4 as initial tests, with additional complement testing as available) and consider complement genotyping and factor H antibody testing when indicated.
- Assess ADAMTS13 activity to help distinguish HUS from TTP.

> **Key distinguishing threads:** STEC-HUS (preceding diarrhea, often bloody) vs. complement-mediated TMA (recurrent or familial, remote or no diarrhea) vs. DIC (abnormal coagulation studies, usually with sepsis) vs. TTP (severe ADAMTS13 deficiency).

*Source: UpToDate Expert AI (AI-generated clinical response), kept here as a personal study reference — cross-check against the primary UpToDate topic before using it to guide actual patient care.*$hus_r$;
  v_treatment text := $hus_t$## Initial Management of Suspected HUS While Evaluation Is in Progress (UpToDate Expert AI)

Management is primarily supportive, with careful fluid and electrolyte management, stopping nephrotoxic drugs, and using kidney replacement therapy when indicated for AKI (e.g. symptomatic uremia, severe azotemia, refractory fluid overload, or refractory electrolyte abnormalities).

- Use platelet transfusion only for significant clinical bleeding and/or when an invasive procedure is required.
- Use red blood cell transfusion for clinically significant anemia.
- Avoid antimotility agents, and do not use antibiotic therapy for confirmed or suspected STEC infection.

*Source: UpToDate Expert AI (AI-generated clinical response), kept here as a personal study reference — cross-check against the primary UpToDate topic before using it to guide actual patient care.*$hus_t$;
begin
  select id into v_owner_id from auth.users where email = 'alihessamis@gmail.com' limit 1;
  if v_owner_id is null then
    raise exception 'owner not found for email alihessamis@gmail.com';
  end if;

  select id into v_topic_id from public.academy_topics
    where owner_id = v_owner_id and (name ilike '%HUS%' or name ilike '%Hemolytic Uremic%')
    limit 1;

  if v_topic_id is null then
    insert into public.academy_topics (
      owner_id, category, name, summary, key_points, study_links, reasoning, treatment, case_questions
    ) values (
      v_owner_id, 'Glomerular & Urologic', 'Hemolytic Uremic Syndrome (HUS)',
      'Approach to the child with suspected HUS: confirm the triad (microangiopathic hemolytic anemia, thrombocytopenia, AKI), rapidly distinguish STEC-HUS from complement-mediated TMA and mimics (DIC, TTP), and begin supportive management in parallel.',
      '[]'::jsonb, '[]'::jsonb,
      v_reasoning, v_treatment,
      '[]'::jsonb
    );
  else
    update public.academy_topics set
      reasoning = coalesce(reasoning, '') || case when coalesce(reasoning, '') = '' then '' else E'\n\n---\n\n' end || v_reasoning
    where id = v_topic_id
      and (reasoning is null or reasoning not like '%Approach to the Child with Suspected HUS (UpToDate Expert AI)%');

    update public.academy_topics set
      treatment = coalesce(treatment, '') || case when coalesce(treatment, '') = '' then '' else E'\n\n---\n\n' end || v_treatment
    where id = v_topic_id
      and (treatment is null or treatment not like '%Initial Management of Suspected HUS While Evaluation Is in Progress%');
  end if;
end $$;
