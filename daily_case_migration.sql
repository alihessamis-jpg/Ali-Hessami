-- Daily Case Challenge (Today → «کیس روز») — board-level pediatric nephrology
-- cases generated nightly by the `generate-daily-case` edge function from the
-- user's own library (Pediatric Nephrology 8e, Fogo atlas, Rose, Nelson,
-- Handbook of Kidney Transplantation, KDIGO/AAP guidelines, Harriet Lane).
--
--   case_topics    board syllabus rotation (seeded per user by seed_case_topics())
--   daily_cases    one row per generated case: stages + answers + citations as jsonb
--   case_attempts  one row per solve (re-solving makes a new attempt)
--   case_images    user-uploaded real images (paths in the private `imaging` bucket)
--
-- Only text/JSON is stored (≈30–60 KB per case); images are storage paths.
-- Safe to run more than once.

-- ---------------------------------------------------------------- topics
create table if not exists public.case_topics (
    id            uuid primary key default gen_random_uuid(),
    owner_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
    slug          text not null,
    name          text not null,
    category      text not null,
    search_terms  text[] not null default '{}',   -- English retrieval queries for library_chunks
    drugs         text[] not null default '{}',   -- Harriet Lane monographs to pull for the management stage
    active        boolean not null default true,
    last_used_at  timestamptz,
    created_at    timestamptz not null default now(),
    unique (owner_id, slug)
);

alter table public.case_topics enable row level security;
drop policy if exists case_topics_owner_access on public.case_topics;
create policy case_topics_owner_access on public.case_topics
    for all using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------- cases
create table if not exists public.daily_cases (
    id          uuid primary key default gen_random_uuid(),
    owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
    case_date   date not null,                       -- Asia/Tehran calendar day
    kind        text not null default 'daily' check (kind in ('daily', 'manual')),
    topic_id    uuid references public.case_topics (id) on delete set null,
    difficulty  text not null check (difficulty in ('moderate', 'hard', 'board-killer')),
    status      text not null default 'ready' check (status in ('generating', 'ready', 'failed')),
    error       text,
    title       text not null,                       -- never names the diagnosis
    case_json   jsonb not null default '{}'::jsonb,  -- patient, stages[], summary, learning points, mnemonic
    sources     jsonb not null default '{}'::jsonb,  -- { "S1": {label, book, chapterId, anchor, pages, kind, ...} }
    self_check  jsonb,                               -- { consistent, issues[], corrected }
    model       text,
    created_at  timestamptz not null default now()
);

-- generation pipeline state (one model call per edge invocation; see the function)
alter table public.daily_cases add column if not exists work jsonb;        -- retrieved sources + draft, cleared when ready
alter table public.daily_cases add column if not exists phase text;        -- generate | check | repair
alter table public.daily_cases add column if not exists phase_at timestamptz;

create unique index if not exists daily_cases_one_daily_per_day
    on public.daily_cases (owner_id, case_date) where kind = 'daily';
create index if not exists daily_cases_owner_date_idx on public.daily_cases (owner_id, case_date desc);

alter table public.daily_cases enable row level security;
drop policy if exists daily_cases_owner_access on public.daily_cases;
create policy daily_cases_owner_access on public.daily_cases
    for all using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------- attempts
create table if not exists public.case_attempts (
    id               uuid primary key default gen_random_uuid(),
    case_id          uuid not null references public.daily_cases (id) on delete cascade,
    user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
    stage_index      integer not null default 0,           -- first stage not yet answered
    stage_responses  jsonb not null default '[]'::jsonb,   -- [{stage, answer, choice, skipped, hints, feedback{score,correct[],missed[]}, answered_at}]
    hints_used       integer not null default 0,
    score            integer check (score between 0 and 100),
    started_at       timestamptz not null default now(),
    completed_at     timestamptz,
    time_spent       integer not null default 0,           -- seconds
    review_item_id   uuid references public.reading_items (id) on delete set null
);

create index if not exists case_attempts_user_case_idx on public.case_attempts (user_id, case_id);

alter table public.case_attempts enable row level security;
drop policy if exists case_attempts_self_access on public.case_attempts;
create policy case_attempts_self_access on public.case_attempts
    for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- images
create table if not exists public.case_images (
    id            uuid primary key default gen_random_uuid(),
    owner_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
    case_id       uuid not null references public.daily_cases (id) on delete cascade,
    stage_key     text,
    storage_path  text not null,
    caption       text,
    created_at    timestamptz not null default now()
);

create index if not exists case_images_case_idx on public.case_images (case_id);

alter table public.case_images enable row level security;
drop policy if exists case_images_owner_access on public.case_images;
create policy case_images_owner_access on public.case_images
    for all using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------- owner-scoped search
-- Same ranking as search_library(), but takes the owner explicitly so the
-- nightly cron (service role, no auth.uid()) retrieves only that user's
-- library. Called with a user JWT, RLS still applies on top, so p_owner can
-- never widen access. p_books limits to book slugs (null = all books).
create or replace function public.case_search_library(q text, p_owner uuid, p_books text[] default null, k int default 6)
returns table (
  chunk_id uuid, book_id uuid, book_title text, book_slug text, book_kind text, chapter_id uuid, chapter_number int,
  chapter_title text, part_number int, section_idx int, heading text, anchor text, page_from int, page_to int,
  content text, score double precision)
language plpgsql stable security invoker
set search_path = public, extensions
as $$
declare
  qq text;
  pass int;
  n int;
  phrase text := lower(ai_norm(q));
begin
  for pass in 1 .. 2 loop
    qq := ai_query(q, pass = 2);
    if qq = '' then return; end if;
    return query
      select ch.id, ch.book_id, b.title, b.slug, b.kind, ch.chapter_id, c.chapter_number, c.title,
             ch.part_number, ch.section_idx, ch.heading, ch.anchor, ch.page_from, ch.page_to, ch.content,
             pgroonga_score(ch.tableoid, ch.ctid)
               + case when strpos(lower(ch.heading), phrase) > 0 or strpos(lower(c.title), phrase) > 0 then 15 else 0 end
               + case when strpos(lower(ch.content), phrase) > 0 then 5 else 0 end
      from library_chunks ch
      join library_chapters c on c.id = ch.chapter_id
      join library_books b on b.id = ch.book_id
      where ch.content &@~ qq
        and ch.owner_id = p_owner
        and (p_books is null or b.slug = any (p_books))
      order by 16 desc
      limit greatest(1, least(k, 20));
    get diagnostics n = row_count;
    if n > 0 then return; end if;
  end loop;
end;
$$;

grant execute on function public.case_search_library(text, uuid, text[], int) to authenticated, service_role;

-- ---------------------------------------------------------------- topic seed
-- Board syllabus. search_terms are English queries against the library;
-- drugs are Harriet Lane monograph names used for the management stage.
create or replace function public.seed_case_topics(p_owner uuid default auth.uid())
returns integer language plpgsql security invoker set search_path = public as $$
declare n int;
begin
  if p_owner is null then raise exception 'no owner'; end if;
  insert into case_topics (owner_id, slug, name, category, search_terms, drugs)
  select p_owner, t.slug, t.name, t.category, t.terms, t.drugs
  from (values
    ('ssns',            'Steroid-sensitive nephrotic syndrome (relapsing / dependent)', 'glomerular', array['steroid-sensitive nephrotic syndrome','frequently relapsing','steroid-dependent','minimal change disease'], array['prednisolone','cyclophosphamide','rituximab','tacrolimus','levamisole']),
    ('srns',            'Steroid-resistant nephrotic syndrome / FSGS / genetic podocytopathy', 'glomerular', array['steroid-resistant nephrotic','focal segmental glomerulosclerosis','NPHS2 podocin','calcineurin inhibitor'], array['tacrolimus','cyclosporine','enalapril']),
    ('congenital-ns',   'Congenital nephrotic syndrome (Finnish type)', 'neonatal', array['congenital nephrotic syndrome','NPHS1 nephrin','albumin infusion','unilateral nephrectomy'], array['albumin','furosemide','captopril','indomethacin']),
    ('apsgn',           'Post-infectious (post-streptococcal) glomerulonephritis', 'glomerular', array['post-streptococcal glomerulonephritis','ASO','C3 hypocomplementemia','subepithelial humps'], array['furosemide','penicillin','amlodipine']),
    ('c3g',             'C3 glomerulopathy / MPGN', 'glomerular', array['C3 glomerulopathy','membranoproliferative','C3 nephritic factor','dense deposit disease'], array['mycophenolate','prednisolone','eculizumab']),
    ('igan',            'IgA nephropathy', 'glomerular', array['IgA nephropathy','Oxford MEST-C','macroscopic hematuria','mesangial IgA'], array['enalapril','losartan','prednisolone']),
    ('igav',            'IgA vasculitis (HSP) nephritis', 'glomerular', array['Henoch Schonlein purpura nephritis','IgA vasculitis','crescents','ISKDC'], array['prednisolone','methylprednisolone','mycophenolate']),
    ('lupus',           'Pediatric lupus nephritis', 'glomerular', array['lupus nephritis','ISN/RPS class','anti-dsDNA','hydroxychloroquine'], array['hydroxychloroquine','mycophenolate','cyclophosphamide','methylprednisolone']),
    ('anca',            'ANCA vasculitis / rapidly progressive GN', 'glomerular', array['ANCA-associated vasculitis','pauci-immune crescentic','rapidly progressive glomerulonephritis','anti-GBM'], array['rituximab','cyclophosphamide','methylprednisolone']),
    ('alport',          'Alport syndrome / thin basement membrane', 'genetic', array['Alport syndrome','COL4A5','basket-weave','sensorineural hearing loss'], array['enalapril','ramipril']),
    ('stec-hus',        'STEC hemolytic uremic syndrome', 'aki', array['Shiga toxin','hemolytic uremic syndrome','schistocytes','E. coli O157'], array['eculizumab','furosemide']),
    ('ahus',            'Atypical HUS / complement-mediated TMA', 'glomerular', array['atypical hemolytic uremic syndrome','complement factor H','eculizumab','thrombotic microangiopathy'], array['eculizumab','meningococcal vaccine']),
    ('drta',            'Distal RTA (type 1)', 'tubular', array['distal renal tubular acidosis','urine anion gap','nephrocalcinosis','SLC4A1 ATP6V0A4'], array['potassium citrate','sodium bicarbonate']),
    ('prta-fanconi',    'Proximal RTA / Fanconi syndrome', 'tubular', array['Fanconi syndrome','proximal renal tubular acidosis','phosphaturia glycosuria','fractional excretion bicarbonate'], array['sodium bicarbonate','sodium citrate','phosphate','calcitriol']),
    ('cystinosis',      'Nephropathic cystinosis', 'tubular', array['cystinosis','cysteamine','corneal cystine crystals','CTNS'], array['cysteamine','indomethacin']),
    ('bartter',         'Bartter syndrome', 'tubular', array['Bartter syndrome','hypokalemic metabolic alkalosis','hypercalciuria','polyhydramnios'], array['indomethacin','potassium chloride','spironolactone']),
    ('gitelman',        'Gitelman syndrome', 'tubular', array['Gitelman syndrome','hypomagnesemia','hypocalciuria','SLC12A3'], array['magnesium','potassium chloride','amiloride']),
    ('hypo-phos',       'X-linked hypophosphatemic rickets / renal phosphate wasting', 'tubular', array['X-linked hypophosphatemia','FGF23','TmP/GFR','burosumab'], array['phosphate','calcitriol','burosumab']),
    ('ndi',             'Nephrogenic diabetes insipidus', 'tubular', array['nephrogenic diabetes insipidus','AVPR2','water deprivation test','hypernatremia'], array['hydrochlorothiazide','indomethacin','amiloride']),
    ('pseudohypoaldo',  'Pseudohypoaldosteronism / hyperkalemic disorders', 'electrolyte', array['pseudohypoaldosteronism','hyperkalemia','TTKG','Gordon syndrome'], array['sodium chloride','hydrochlorothiazide','sodium polystyrene sulfonate']),
    ('hyponatremia',    'Hyponatremia: SIADH vs cerebral salt wasting', 'electrolyte', array['hyponatremia','SIADH','cerebral salt wasting','hypertonic saline'], array['sodium chloride','tolvaptan','furosemide']),
    ('hyperkalemia',    'Severe hyperkalemia in kidney failure', 'electrolyte', array['hyperkalemia','ECG peaked T waves','insulin glucose','calcium gluconate'], array['calcium gluconate','insulin','albuterol','sodium polystyrene sulfonate']),
    ('mixed-acid-base', 'Mixed acid–base disorder', 'electrolyte', array['mixed acid-base disorder','anion gap','delta gap','Winter formula'], array['sodium bicarbonate']),
    ('hypercalciuria',  'Idiopathic hypercalciuria / nephrocalcinosis', 'stones', array['hypercalciuria','nephrocalcinosis','urine calcium creatinine ratio','thiazide'], array['hydrochlorothiazide','potassium citrate']),
    ('cystinuria',      'Cystinuria', 'stones', array['cystinuria','cystine stones','tiopronin','urine alkalinization'], array['potassium citrate','tiopronin','penicillamine']),
    ('hyperoxaluria',   'Primary hyperoxaluria', 'stones', array['primary hyperoxaluria','oxalosis','lumasiran','pyridoxine'], array['pyridoxine','potassium citrate']),
    ('uti',             'Febrile UTI in infants (AAP 2026)', 'cakut', array['febrile urinary tract infection','pyuria','catheter urine culture','renal bladder ultrasound'], array['ceftriaxone','cefixime','cephalexin','gentamicin']),
    ('vur',             'Vesicoureteral reflux / renal scarring', 'cakut', array['vesicoureteral reflux','VCUG grade','DMSA scarring','antibiotic prophylaxis'], array['trimethoprim/sulfamethoxazole','nitrofurantoin']),
    ('puv',             'Posterior urethral valves / obstructive uropathy', 'cakut', array['posterior urethral valves','hydroureteronephrosis','valve bladder','obstructive uropathy'], array['oxybutynin','sodium bicarbonate']),
    ('upj',             'UPJ obstruction / antenatal hydronephrosis', 'cakut', array['ureteropelvic junction obstruction','antenatal hydronephrosis','MAG3 diuretic renogram','SFU grade'], array['amoxicillin']),
    ('arpkd',           'ARPKD / neonatal cystic kidneys', 'cystic', array['autosomal recessive polycystic kidney disease','PKHD1','congenital hepatic fibrosis','enlarged echogenic kidneys'], array['enalapril','amlodipine']),
    ('adpkd',           'ADPKD in childhood', 'cystic', array['autosomal dominant polycystic kidney disease','PKD1','tolvaptan','total kidney volume'], array['lisinopril','tolvaptan']),
    ('nphp',            'Nephronophthisis / ciliopathy', 'cystic', array['nephronophthisis','ciliopathy','polyuria polydipsia','corticomedullary cysts'], array['sodium chloride']),
    ('tsc',             'Tuberous sclerosis complex kidney', 'genetic', array['tuberous sclerosis','angiomyolipoma','everolimus','TSC2 PKD1 contiguous'], array['everolimus']),
    ('adtkd',           'ADTKD (UMOD / MUC1 / REN / HNF1B)', 'genetic', array['autosomal dominant tubulointerstitial kidney disease','uromodulin','hyperuricemia gout','HNF1B'], array['allopurinol']),
    ('fabry',           'Fabry disease', 'genetic', array['Fabry disease','alpha-galactosidase','globotriaosylceramide','zebra bodies'], array['agalsidase']),
    ('mma',             'Methylmalonic acidemia / metabolic kidney disease', 'genetic', array['methylmalonic acidemia','tubulointerstitial nephritis','hydroxocobalamin','carnitine'], array['hydroxocobalamin','carnitine']),
    ('tin',             'Acute tubulointerstitial nephritis / TINU', 'aki', array['tubulointerstitial nephritis','TINU uveitis','drug-induced interstitial nephritis','urine beta-2 microglobulin'], array['prednisolone','methylprednisolone']),
    ('aki-picu',        'AKI in critically ill child / fluid overload / CKRT', 'aki', array['acute kidney injury children','fluid overload','continuous kidney replacement therapy','renal angina index'], array['furosemide','vancomycin','gentamicin']),
    ('nephrotoxic',     'Nephrotoxic AKI (aminoglycoside / vancomycin / NSAID / tumor lysis)', 'aki', array['nephrotoxic medication','aminoglycoside nephrotoxicity','tumor lysis syndrome','NINJA'], array['vancomycin','gentamicin','rasburicase','allopurinol']),
    ('neonatal-aki',    'Neonatal AKI', 'neonatal', array['neonatal acute kidney injury','preterm creatinine','asphyxia','theophylline'], array['theophylline','caffeine','furosemide']),
    ('neonatal-htn',    'Neonatal hypertension (umbilical catheter thrombosis)', 'neonatal', array['neonatal hypertension','umbilical arterial catheter','renal artery thrombosis','renal vein thrombosis'], array['amlodipine','hydralazine','captopril']),
    ('ckd-mbd',         'CKD–mineral bone disorder', 'ckd', array['CKD-MBD','secondary hyperparathyroidism','phosphate binder','renal osteodystrophy'], array['calcium carbonate','sevelamer','calcitriol','cinacalcet']),
    ('ckd-anemia',      'Anemia of CKD', 'ckd', array['anemia chronic kidney disease','erythropoiesis-stimulating agent','iron deficiency TSAT ferritin','darbepoetin'], array['epoetin alfa','darbepoetin','iron sucrose']),
    ('ckd-growth',      'CKD growth failure / nutrition / acidosis', 'ckd', array['growth failure CKD','growth hormone','metabolic acidosis CKD','nutrition chronic kidney disease'], array['somatropin','sodium bicarbonate']),
    ('pd-peritonitis',  'PD peritonitis / dialysis complications', 'ckd', array['peritoneal dialysis peritonitis','exit site infection','intraperitoneal antibiotics','ISPD'], array['cefazolin','ceftazidime','vancomycin']),
    ('renovascular',    'Renovascular hypertension (FMD / mid-aortic syndrome)', 'hypertension', array['renovascular hypertension','fibromuscular dysplasia','mid-aortic syndrome','angiography'], array['amlodipine','labetalol','nicardipine']),
    ('htn-emergency',   'Hypertensive emergency (PRES)', 'hypertension', array['hypertensive emergency','posterior reversible encephalopathy','nicardipine labetalol','blood pressure percentile'], array['nicardipine','labetalol','hydralazine','esmolol']),
    ('primary-htn',     'Primary vs secondary hypertension / ABPM / monogenic HTN', 'hypertension', array['ambulatory blood pressure monitoring','primary hypertension','Liddle syndrome','glucocorticoid-remediable aldosteronism'], array['amlodipine','lisinopril','amiloride']),
    ('tx-rejection',    'Acute rejection after pediatric kidney transplant', 'transplant', array['acute rejection','Banff classification','donor-specific antibody','antibody-mediated rejection'], array['methylprednisolone','tacrolimus','mycophenolate','thymoglobulin']),
    ('tx-bk-cmv',       'BK / CMV / EBV-PTLD after transplant', 'transplant', array['BK polyomavirus nephropathy','cytomegalovirus transplant','PTLD EBV','valganciclovir'], array['valganciclovir','ganciclovir','tacrolimus']),
    ('tx-recurrence',   'Recurrent FSGS / aHUS after transplant', 'transplant', array['recurrent FSGS after transplantation','plasmapheresis','recurrent disease transplant','rituximab'], array['rituximab','cyclosporine']),
    ('sickle',          'Sickle cell nephropathy', 'genetic', array['sickle cell nephropathy','hyposthenuria','papillary necrosis','albuminuria sickle'], array['hydroxyurea','enalapril']),
    ('wilms',           'Wilms tumor / WT1 syndromes (Denys-Drash, WAGR)', 'genetic', array['Wilms tumor','Denys-Drash','WT1','nephrectomy'], array['vincristine']),
    ('diuretics',       'Diuretic resistance / edema management', 'electrolyte', array['diuretic resistance','loop diuretic','sequential nephron blockade','metolazone'], array['furosemide','metolazone','chlorothiazide','acetazolamide'])
  ) as t(slug, name, category, terms, drugs)
  on conflict (owner_id, slug) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.seed_case_topics(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------- cron secret
-- A random secret lives only in Vault; the cron job sends it as x-case-secret
-- and the edge function checks it with this service-role-only function.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'daily_case_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'daily_case_secret', 'x-case-secret for the generate-daily-case cron');
  end if;
end $$;

create or replace function public.check_daily_case_secret(s text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(s, '') <> '' and exists (select 1 from vault.decrypted_secrets where name = 'daily_case_secret' and decrypted_secret = s)
$$;
revoke all on function public.check_daily_case_secret(text) from public, anon, authenticated;
grant execute on function public.check_daily_case_secret(text) to service_role;

-- The function reads the secret to chain its own pipeline phases.
create or replace function public.get_daily_case_secret()
returns text language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'daily_case_secret'
$$;
revoke all on function public.get_daily_case_secret() from public, anon, authenticated;
grant execute on function public.get_daily_case_secret() to service_role;

-- ---------------------------------------------------------------- cron
-- 03:00 Asia/Tehran = 23:30 UTC (Iran has had no DST since 2022). The
-- function generates the case for the Tehran calendar day that has just
-- begun, for every user with a library. Deploy the function first
-- (verify_jwt = false; it checks JWT / secret itself).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'daily-case-generator';
    perform cron.schedule(
      'daily-case-generator',
      '30 23 * * *',
      $job$
      select net.http_post(
        url := 'https://yguoxkixgsjoellewvch.supabase.co/functions/v1/generate-daily-case',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-case-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'daily_case_secret')),
        body := '{"action":"cron"}'::jsonb,
        timeout_milliseconds := 60000
      );
      $job$
    );
  end if;
end;
$$;
