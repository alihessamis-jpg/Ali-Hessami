-- Nephron Academy — add UpToDate Expert AI "approach to gross hematuria"
-- content to the existing Hematuria topic's Approach (reasoning) field.
--
-- Idempotent: finds the existing topic named like '%Hematuria%' for this
-- owner and APPENDS the new section to whatever is already in its Approach
-- field (nothing already there is overwritten or lost). If no Hematuria
-- topic exists yet, creates a new top-level one. Safe to re-run — a guard
-- skips the append if this exact section is already present.

do $$
declare
  v_owner_id uuid;
  v_topic_id uuid;
  v_section text := $appr$## Approach to Gross Hematuria (UpToDate Expert AI)

*Case framing: 8-year-old girl, gross hematuria with many RBCs on urinalysis, positive family history of renal stones. Assumptions: hemodynamically stable; this is true hematuria, not pigmenturia.*

In children with gross hematuria, start with a complete history, physical exam, and urinalysis — further testing is guided by the symptoms and urinalysis findings.

### Step 1 — Confirm it is blood, and localize glomerular vs. nonglomerular
- Confirm with a positive dipstick for blood plus RBCs on urine sediment.
- **Glomerular clues:** red cell casts, dysmorphic RBCs, cola/tea-colored urine.
- **Nonglomerular clues:** monomorphic RBCs, clots.

### Step 2 — Focused history & exam to choose the pathway
Ask about: trauma/exercise, urinary symptoms, flank pain radiating to the groin, timing of bleeding during micturition, recent pharyngitis/impetigo, predisposing conditions (sickle cell trait/disease, coagulopathy), medication exposures, and family history (including stones).

### Step 3 — Targeted initial testing by most-likely pathway

**Suggests nephrolithiasis** (family history raises suspicion):
- Renal/bladder ultrasound is the preferred initial study in children.
- Plain abdominal film can show radiopaque stones but misses radiolucent stones and doesn't show obstruction.
- Spiral CT is most sensitive but usually not first-line in young children (radiation).

**Suggests UTI:**
- Urine culture when UA shows leukocyte esterase/nitrite positivity, pyuria, or bacteria.
- If culture positive → treat, repeat UA after the infection clears.
- If symptoms/UA suggest infection but culture is negative → consider adenovirus (hemorrhagic cystitis).

**Suggests glomerular disease** (proteinuria, RBC casts, edema, hypertension):
- Check serum creatinine, CBC, C3, C4, serum albumin; add ASO/streptozyme, ANA per history.
- Refer to pediatric nephrology.

**Asymptomatic or unexplained after the above:**
- Urinalysis with microscopy, serum creatinine, serum C3, urine culture, spot urine calcium/creatinine ratio (screen for hypercalciuria), test parents/siblings for hematuria, kidney/bladder ultrasound (± Doppler for CAKUT, tumor, nutcracker syndrome).
- Refer to pediatric nephrology if hematuria persists undiagnosed, or if hypertension, elevated creatinine, proteinuria, or glomerular-bleeding features are present.

> **For this case** — the positive family history of renal stones nudges the initial work-up toward the nephrolithiasis pathway (renal ultrasound ± urine stone-risk panel / urine Ca:Cr ratio), run in parallel with the general urinalysis-based glomerular-vs-nonglomerular localization above.

*Source: UpToDate Expert AI (AI-generated clinical response), kept here as a personal study reference — cross-check against the primary UpToDate topic before using it to guide actual patient care.*$appr$;
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
      owner_id, category, name, summary, key_points, study_links, reasoning, case_questions
    ) values (
      v_owner_id, 'Glomerular & Urologic', 'Hematuria',
      'Approach to the child with microscopic or gross hematuria: localize glomerular vs. nonglomerular bleeding, then let history/exam/urinalysis findings pick the diagnostic pathway (stones, UTI, glomerular disease, or unexplained).',
      '[]'::jsonb, '[]'::jsonb,
      v_section,
      '[]'::jsonb
    );
  else
    update public.academy_topics set
      reasoning = coalesce(reasoning, '') || case when coalesce(reasoning, '') = '' then '' else E'\n\n---\n\n' end || v_section
    where id = v_topic_id
      and (reasoning is null or reasoning not like '%Approach to Gross Hematuria (UpToDate Expert AI)%');
  end if;
end $$;
