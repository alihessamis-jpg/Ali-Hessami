-- Nephron — add an Eculizumab entry to the searchable Drug dosing reference
-- (Reference page → Drug dosing tab) so searching "Eculizumab" there surfaces
-- the pre-treatment checklist.
--
-- Idempotent: skips the insert if this owner already has a drug_reference
-- row whose medication matches "%eculizumab%". Safe to re-run.

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
    select 1 from public.drug_reference where owner_id = v_owner_id and medication ilike '%eculizumab%'
  ) into v_exists;

  if v_exists then
    raise notice 'An Eculizumab entry already exists for this owner — skipping insert.';
    return;
  end if;

  insert into public.drug_reference (owner_id, medication, indication, notes)
  values (
    v_owner_id,
    'Eculizumab',
    'Atypical HUS / complement-mediated thrombotic microangiopathy',
    $ecu$Pre-treatment checklist (local protocol — complete at least 2 weeks before starting):
- Meningococcal vaccine: quadrivalent (e.g. Menactra/MenACWY) 2 doses 8-12 weeks apart, free from the health center; OR pentavalent, 1 dose. Quadrivalent booster at 5 years, then every 5 years.
- Pneumococcal vaccine: PCV13 first, then PPSV23 two months later. Single booster at 5 years is sufficient.
- Keep meningococcal and pneumococcal vaccines >= 4 weeks apart (not same day).
- Penicillin V 250 mg PO BID while awaiting vaccine immunity.
- PPD test before starting.

Eculizumab's own induction/maintenance infusion dosing (weight-tiered) is not included here — this entry only covers the pre-treatment checklist the attending gave; confirm the dosing regimen itself from a verified source before use.

See the Hemolytic Uremic Syndrome (HUS) Academy topic for full detail on this checklist.$ecu$
  );
end $$;
