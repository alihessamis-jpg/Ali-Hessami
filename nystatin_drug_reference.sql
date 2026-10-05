-- Nephron — add a Nystatin (oral) entry to the searchable Drug dosing
-- reference (Reference page -> Drug dosing tab).
--
-- Covers oropharyngeal candidiasis (oral thrush) treatment dosing and
-- peritoneal dialysis peritonitis-prophylaxis dosing, plus which oral
-- formulations are available in Iran.
--
-- Idempotent: skips the insert if this owner already has a drug_reference
-- row whose medication matches "%nystatin%". Safe to re-run.

do $$
declare
  v_owner_id uuid;
  v_exists boolean;
begin
  select id into v_owner_id from auth.users where email = 'alihessamis@gmail.com' limit 1;
  if v_owner_id is null then
    raise exception 'owner not found for email alihessamis@gmail.com';
  end if;

  select exists(
    select 1 from public.drug_reference where owner_id = v_owner_id and medication ilike '%nystatin%'
  ) into v_exists;

  if v_exists then
    raise notice 'A Nystatin entry already exists for this owner — skipping insert.';
    return;
  end if;

  insert into public.drug_reference (
    owner_id, medication, indication, pediatric_dose, max_dose, egfr_range, adjusted_dose, frequency, notes
  )
  values (
    v_owner_id,
    'Nystatin (oral)',
    'Oropharyngeal candidiasis (oral thrush); peritonitis prophylaxis in peritoneal dialysis during high-risk situations',
    $nys$Oropharyngeal candidiasis (thrush), mild, treatment:
- Infants: 200,000 units PO 4 times daily (give half the dose, 100,000 units, to each side of the mouth)
- Children and adolescents: 400,000-600,000 units PO 4 times daily (half to each side of mouth; swish and retain in the mouth as long as possible before swallowing)
- Duration: 7-14 days

Peritonitis prophylaxis (peritoneal dialysis patients, high-risk situations e.g. during antibiotic therapy or PEG placement):
- 5,000 units/kg/dose PO twice daily$nys$,
    '500,000 units/dose (peritonitis-prophylaxis regimen only; no fixed max stated for the oral thrush regimen)',
    'Any',
    'No dose adjustment needed — nystatin is not systemically absorbed from the GI tract',
    '4 times daily (oral thrush) or twice daily (PD prophylaxis)',
    $nys2$Formulations available in Iran:
- Oral drop, 100,000 U/mL — matches the infant oral-suspension dosing above
- Oral syrup, 100,000 U/mL
- Tablet, 500,000 U — for patients who can swallow tablets
- Ointment, 100,000 U/g — topical only, not for oral thrush
- Vaginal tablet, 100,000 U — not relevant to oral thrush

Source: UpToDate Pediatric Drug Information (Nystatin, oral); Iran formulation list from darooyab.ir.$nys2$
  );
end $$;
