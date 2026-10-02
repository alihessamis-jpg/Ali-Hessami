-- Nephron Academy — add UpToDate Expert AI decision-pathway (gross vs.
-- microscopic -> branches A/B1/B2/B3) for when to order C3/C4 in a child
-- with hematuria, to the Academy Hematuria topic's Tests field.
--
-- Idempotent: finds the existing topic named like '%Hematuria%' for this
-- owner and APPENDS this section to its Tests field (nothing already there,
-- including the earlier C3/C4 indications note, is overwritten or lost).
-- If no matching topic exists yet, creates a new top-level one. Safe to
-- re-run — a guard skips the append if this exact section is already
-- present.

do $$
declare
  v_owner_id uuid;
  v_topic_id uuid;
  v_section text := $hem_a$## مسیر تصمیم‌گیری: کودک با RBC در ادرار (هماچوری) — چه زمانی C3/C4 (UpToDate Expert AI)

*فرض: کودک از نظر همودینامیک پایدار است؛ هدف، تصمیم‌گیری در ارزیابی اولیه است.*

### گام ۱: نوع هماچوری را مشخص کنید
نوع هماچوری را مشخص کنید (ماکروسکوپیک یا میکروسکوپیک) و UA را برای منشاء گلومرولی بررسی کنید. وجود RBC cast، پروتئینوری و یا RBC دیسمورفیک به نفع خونریزی گلومرولی است. لخته خون تقریباً هرگز با بیماری گلومرولی دیده نمی‌شود و به نفع منشاء خارج گلومرولی است.

### شاخه A: هماچوری ماکروسکوپیک
در هماچوری ماکروسکوپیک بدون علامت، ارزیابی پیشنهادی شامل UA، کشت ادرار، کراتینین و اندازه‌گیری C3 است. C3 پایین می‌تواند به نفع PSGN، لوپوس نفریت یا گلومرولونفریت C3 باشد.

اگر همزمان شواهد گلومرولی/نفریت وجود دارد (پروتئینوری، RBC cast، ادم، HTN)، ارزیابی گلومرولی شامل C3 و C4 (به همراه کراتینین، CBC و آلبومین) است و ارجاع به نفرولوژی کودکان توصیه می‌شود.

الگوریتم: Algorithm for gross or symptomatic microscopic hematuria in children.

### شاخه B: هماچوری میکروسکوپیک

**B1: میکروسکوپیک ایزوله و بدون علامت**
رویکرد اولیه مشاهده و تکرار UA و فشارخون است؛ ارزیابی گسترده معمولاً فقط اگر طی پیگیری، علائم، پروتئینوری یا هماچوری ماکروسکوپیک ایجاد شود انجام می‌شود. در این شاخه، C3/C4 به‌صورت روتین جزو ارزیابی اولیه ذکر نشده‌اند.
الگوریتم: Algorithm for isolated asymptomatic microscopic hematuria in children.

**B2: میکروسکوپیک + پروتئینوری**
ارزیابی با کراتینین و کمی‌سازی پروتئینوری شروع می‌شود و در ارزیابی آزمایشگاهی، کمپلمان‌های C3 و C4 مطرح هستند (به‌ویژه برای افتراق PSGN یا لوپوس نفریت).
الگوریتم: Diagnostic algorithm for asymptomatic microscopic hematuria with proteinuria in children.

**B3: میکروسکوپیک علامت‌دار**
ارزیابی بر اساس علائم، معاینه و UA هدایت می‌شود. اگر یافته‌ها به نفع بیماری گلومرولی باشد (مثل پروتئینوری، RBC cast، ادم، HTN)، C3 و C4 در ارزیابی اولیه گلومرولی قرار می‌گیرند.
الگوریتم: Algorithm for gross or symptomatic microscopic hematuria in children.

> **جمع‌بندی مسیر:** ماکروسکوپیک → C3 (± C4 اگر یافته گلومرولی همراه باشد) • میکروسکوپیک ایزوله و بدون علامت → معمولاً C3/C4 لازم نیست، فقط پیگیری و تکرار UA • میکروسکوپیک + پروتئینوری، یا میکروسکوپیک علامت‌دار با یافته گلومرولی → C3 و C4 جزو ارزیابی اولیه.

*منبع: UpToDate Expert AI (پاسخ تولیدشده توسط هوش مصنوعی)، به‌عنوان مرجع مطالعه شخصی نگهداری می‌شود — پیش از استفاده بالینی با متن اصلی UpToDate مطابقت داده شود.*$hem_a$;
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
      and (tests is null or tests not like '%مسیر تصمیم‌گیری: کودک با RBC در ادرار (هماچوری)%');
  end if;
end $$;
