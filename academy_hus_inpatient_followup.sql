-- Nephron Academy — add UpToDate Expert AI "inpatient follow-up/monitoring
-- for a hospitalized child with HUS" content to the Academy topic for
-- Hemolytic Uremic Syndrome.
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
  v_section text := $hus_f$## Inpatient Follow-Up and Monitoring During Hospitalization for HUS (UpToDate Expert AI)

*Case framing: child with HUS admitted for thrombocytopenia, receiving FFP, with no active major bleeding and no severe CNS involvement.*

### Immediate check: is plasma appropriate for this case?
For STEC-HUS, plasma therapy is not routinely recommended — including for severe CNS involvement, where eculizumab is preferred — while plasma therapy is used in complement-mediated HUS in some settings. If the working diagnosis could be TTP instead, urgent therapeutic plasma exchange decisions should be driven by the likelihood of TTP while awaiting ADAMTS13 activity, since TTP is the TMA where plasma exchange is clearly essential.

### Inpatient follow-up priorities
- **Kidney function and urine findings** — frequent assessment including urinalysis and serum markers (BUN and creatinine), along with CBC including platelet count.
- **Fluid balance and cardiopulmonary status** — assess at baseline and monitor frequently with fluid balance, weight, and vital signs, with attention to volume overload risk during transfusions.
- **Electrolytes and acid-base** — monitor for hyperkalemia, hyperphosphatemia, and metabolic acidosis; manage as in other causes of AKI.
- **Anemia monitoring and transfusion approach** — hemoglobin can fall rapidly; transfuse to avoid cardiopulmonary compromise, with cautious administration and monitoring for volume overload and hyperkalemia in AKI.
- **Thrombocytopenia and bleeding surveillance** — platelet transfusion is generally reserved for significant clinical bleeding or when an invasive procedure is required.
- **Blood pressure** — hypertension management is part of supportive care, including fluid restriction, antihypertensives, and dialysis if needed.
- **Neurologic monitoring** — serious complications (e.g. seizures, stroke, decreased consciousness) warrant imaging to assess CNS involvement and targeted management, including seizure treatment and blood pressure control.
- **Medication safety** — stop nephrotoxins, avoid NSAIDs, and dose-adjust renally cleared drugs for kidney dysfunction.

See the dialysis-indications section above for when to escalate to kidney replacement therapy.

### Discharge planning and longer-term follow-up
After recovery, ongoing follow-up is recommended to monitor for hypertension, proteinuria, and kidney function impairment (blood pressure, urinalysis, serum creatinine), typically at least annually.

*Source: UpToDate Expert AI (AI-generated clinical response), kept here as a personal study reference — cross-check against the primary UpToDate topic before using it to guide actual patient care.*$hus_f$;
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
      'Approach to the child with suspected HUS, its initial management, inpatient monitoring during hospitalization, and when to start kidney replacement therapy for HUS-associated AKI.',
      '[]'::jsonb, '[]'::jsonb,
      v_section,
      '[]'::jsonb
    );
  else
    update public.academy_topics set
      treatment = coalesce(treatment, '') || case when coalesce(treatment, '') = '' then '' else E'\n\n---\n\n' end || v_section
    where id = v_topic_id
      and (treatment is null or treatment not like '%Inpatient Follow-Up and Monitoring During Hospitalization for HUS%');
  end if;
end $$;
