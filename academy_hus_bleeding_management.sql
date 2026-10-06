-- Nephron Academy — add a bleeding-management warning (no antifibrinolytics)
-- to the Academy topic for Hemolytic Uremic Syndrome, from a real case.
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
  v_section text := $hus_b$## Bleeding Management in HUS — Do Not Give Tranexamic Acid

*HUS is a thrombotic microangiopathy (TMA): small-vessel microthrombi are the core problem. Antifibrinolytics (e.g. tranexamic acid) block breakdown of these microthrombi and can worsen the microangiopathic process — they are contraindicated for bleeding in HUS/TMA.*

### Approach to bleeding (e.g. epistaxis) in a HUS patient
1. **Do not give tranexamic acid** (or other antifibrinolytics).
2. **Platelet concentrate (PC)** — correct thrombocytopenia first.
3. **Fresh frozen plasma (FFP)** — if bleeding continues.
4. If still uncontrolled, **local packing with epinephrine**.

### Case note
A HUS patient with epistaxis was managed with PC and FFP; bleeding was ultimately controlled with an epinephrine-soaked pack — not with tranexamic acid.

*Source: personal case/practice note — confirm against current guidance for the specific clinical scenario.*$hus_b$;
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
      'Approach to the child with suspected HUS, its initial management, inpatient monitoring, when to start kidney replacement therapy for HUS-associated AKI, and bleeding management precautions.',
      '[]'::jsonb, '[]'::jsonb,
      v_section,
      '[]'::jsonb
    );
  else
    update public.academy_topics set
      treatment = coalesce(treatment, '') || case when coalesce(treatment, '') = '' then '' else E'\n\n---\n\n' end || v_section
    where id = v_topic_id
      and (treatment is null or treatment not like '%Bleeding Management in HUS — Do Not Give Tranexamic Acid%');
  end if;
end $$;
