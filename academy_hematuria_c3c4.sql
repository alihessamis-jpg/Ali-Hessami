-- Nephron Academy — add UpToDate Expert AI "when to order C3/C4 in a child
-- with hematuria" content to the Academy Hematuria topic's Tests field.
--
-- Idempotent: finds the existing topic named like '%Hematuria%' for this
-- owner and APPENDS this section to its Tests field (nothing already there
-- is overwritten or lost). If no matching topic exists yet, creates a new
-- top-level one. Safe to re-run — a guard skips the append if this exact
-- section is already present.

do $$
declare
  v_owner_id uuid;
  v_topic_id uuid;
  v_section text := $hem_c$## چه زمانی C3 و C4 در هماچوری درخواست شود؟ (UpToDate Expert AI)

*فرض: کودک زیر ۱۸ سال با هماچوری که با UA و میکروسکوپی تأیید شده است.*

درخواست C3 و C4 زمانی اندیکاسیون دارد که شواهدی به نفع منشاء گلومرولی/نفریتی وجود داشته باشد. در کودکی که هماچوری همراه با پروتئینوری، RBC cast، ادم یا فشارخون بالا دارد، ارزیابی گلومرولی شامل کراتینین، CBC، آلبومین و کمپلمان‌های C3 و C4 است.

### موقعیت‌های تیپیک برای درخواست کمپلمان
- هماچوری علامت‌دار همراه با یافته‌های گلومرولی (پروتئینوری، RBC cast، ادم، فشارخون بالا) → C3 و C4 جزو آزمایش‌های اولیه هستند.
- هماچوری ماکروسکوپیک بدون علامت (gross hematuria) → در ارزیابی پیشنهادی، اندازه‌گیری C3 مطرح است؛ C3 پایین می‌تواند به نفع PSGN، لوپوس نفریت یا گلومرولونفریت C3 باشد.
- هماچوری میکروسکوپیک همراه با پروتئینوری (حتی بدون علامت) → در ارزیابی آزمایشگاهی، کمپلمان‌های C3 و C4 توصیه می‌شوند (به‌ویژه برای افتراق PSGN یا لوپوس نفریت).

### چه زمانی معمولاً لازم نیست
در هماچوری میکروسکوپیک ایزوله و بدون علامت با معاینه طبیعی، رویکرد اولیه مشاهده و تکرار UA است؛ «ارزیابی گسترده» (از جمله کمپلمان) معمولاً فقط اگر پروتئینوری، فشارخون بالا یا هماچوری ماکروسکوپیک ایجاد شود انجام می‌شود.

### ابزارهای کمکی تصمیم‌گیری (الگوریتم‌های UpToDate)
- برای مسیر «هماچوری علامت‌دار/ماکروسکوپیک»: Algorithm for gross or symptomatic microscopic hematuria in children.
- برای «هماچوری میکروسکوپیک ایزوله و بدون علامت»: Algorithm for isolated asymptomatic microscopic hematuria in children.
- برای «هماچوری میکروسکوپیک + پروتئینوری»: Diagnostic algorithm for asymptomatic microscopic hematuria with proteinuria in children.

> **جمع‌بندی سریع:** اگر هماچوری + (پروتئینوری یا ادم یا فشارخون بالا یا RBC cast) → C3/C4 را همراه با کراتینین، CBC و آلبومین درخواست کن. اگر هماچوری ایزوله، میکروسکوپیک و بدون علامت باشد → معمولاً نیازی به کمپلمان نیست؛ ابتدا UA را تکرار کن.

*منبع: UpToDate Expert AI (پاسخ تولیدشده توسط هوش مصنوعی)، به‌عنوان مرجع مطالعه شخصی نگهداری می‌شود — پیش از استفاده بالینی با متن اصلی UpToDate مطابقت داده شود.*$hem_c$;
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
      owner_id, category, name, summary, key_points, study_links, tests, case_questions
    ) values (
      v_owner_id, 'Glomerular & Urologic', 'Hematuria',
      'Approach to the child with microscopic or gross hematuria: localize glomerular vs. nonglomerular bleeding, then let history/exam/urinalysis findings pick the diagnostic pathway (stones, UTI, glomerular disease, or unexplained).',
      '[]'::jsonb, '[]'::jsonb,
      v_section,
      '[]'::jsonb
    );
  else
    update public.academy_topics set
      tests = coalesce(tests, '') || case when coalesce(tests, '') = '' then '' else E'\n\n---\n\n' end || v_section
    where id = v_topic_id
      and (tests is null or tests not like '%چه زمانی C3 و C4 در هماچوری درخواست شود؟%');
  end if;
end $$;
