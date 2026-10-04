-- Nephron Academy — add the local pre-eculizumab vaccine/prophylaxis
-- protocol to the Academy topic for Hemolytic Uremic Syndrome.
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
  v_section text := $hus_e$## Pre-Eculizumab Checklist: Vaccination, Prophylaxis, and PPD (Local Protocol)

*Complement blockade with eculizumab markedly raises the risk of invasive meningococcal and pneumococcal infection — vaccination and prophylaxis must be in place before starting it.*

### Timing
- Vaccination and prophylaxis must be completed **at least 2 weeks before starting eculizumab**.
- A **PPD test** must also be done before starting eculizumab.

### Meningococcal vaccine
- Must be given — check which product the health center supplies:
  - **Quadrivalent (e.g. Menactra, MenACWY)** — 2 doses, 8–12 weeks apart. Available free from the health center.
  - **Pentavalent** — 1 dose is sufficient.
- If the quadrivalent vaccine is used, give the **booster dose 5 years after the primary series**, and repeat every 5 years thereafter.
- Keep the meningococcal and pneumococcal vaccines **at least 4 weeks apart** — do not give them on the same day.

### Pneumococcal vaccine
- Give the **13-valent conjugate (PCV13) first**, then the **23-valent polysaccharide (PPSV23) 2 months later**.
- A **single booster dose 5 years later** is sufficient — no further repeat doses needed.
- Keep at least 4 weeks' separation from the meningococcal vaccine (see above).

### Penicillin prophylaxis (bridges the gap until vaccine immunity develops)
- **Penicillin V, 250 mg orally, twice daily.**

*Source: attending's local protocol, kept here as a personal practice reference — confirm the exact product, dosing, and spacing against current guidance and your health center's available vaccine before applying it to a specific patient.*$hus_e$;
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
      'Approach to the child with suspected HUS, its initial management, inpatient monitoring, when to start kidney replacement therapy for HUS-associated AKI, and the pre-eculizumab vaccination/prophylaxis checklist.',
      '[]'::jsonb, '[]'::jsonb,
      v_section,
      '[]'::jsonb
    );
  else
    update public.academy_topics set
      treatment = coalesce(treatment, '') || case when coalesce(treatment, '') = '' then '' else E'\n\n---\n\n' end || v_section
    where id = v_topic_id
      and (treatment is null or treatment not like '%Pre-Eculizumab Checklist: Vaccination, Prophylaxis, and PPD%');
  end if;
end $$;
