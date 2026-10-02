-- Nephron Academy — add UpToDate Expert AI "indications for dialysis in HUS
-- with AKI" content to the Academy topic for Hemolytic Uremic Syndrome.
--
-- Idempotent: finds the existing topic named like '%HUS%' or
-- '%Hemolytic Uremic%' for this owner and APPENDS this section to its
-- Treatment field (nothing already there is overwritten or lost). If no
-- matching topic exists yet, creates a new top-level one. Safe to re-run —
-- a guard skips the append if this exact section is already present.

do $$
declare
  v_owner_id uuid;
  v_topic_id uuid;
  v_section text := $hus_d$## Indications for Dialysis (Kidney Replacement Therapy) in HUS with AKI (UpToDate Expert AI)

*Case framing: child with HUS and acute kidney injury.*

Dialysis is initiated for symptomatic uremia, severe azotemia, severe fluid overload that is refractory to medical therapy, or electrolyte abnormalities that are refractory to medical therapy.

More specifically, indications include:
- Signs and symptoms of uremia.
- Azotemia with BUN ≥80–100 mg/dL.
- Severe fluid overload with cardiopulmonary compromise and/or hypertension that is refractory to medical therapy.
- Severe electrolyte abnormalities (e.g. hyperkalemia and acidosis) that are refractory to medical therapy.
- Need for nutritional support in a child with oliguria or anuria.

*Source: UpToDate Expert AI (AI-generated clinical response), kept here as a personal study reference — cross-check against the primary UpToDate topic before using it to guide actual patient care.*$hus_d$;
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
      owner_id, category, name, summary, key_points, study_links, treatment, case_questions
    ) values (
      v_owner_id, 'Glomerular & Urologic', 'Hemolytic Uremic Syndrome (HUS)',
      'Approach to the child with suspected HUS and its initial management, including when to start kidney replacement therapy for HUS-associated AKI.',
      '[]'::jsonb, '[]'::jsonb,
      v_section,
      '[]'::jsonb
    );
  else
    update public.academy_topics set
      treatment = coalesce(treatment, '') || case when coalesce(treatment, '') = '' then '' else E'\n\n---\n\n' end || v_section
    where id = v_topic_id
      and (treatment is null or treatment not like '%Indications for Dialysis (Kidney Replacement Therapy) in HUS with AKI%');
  end if;
end $$;
