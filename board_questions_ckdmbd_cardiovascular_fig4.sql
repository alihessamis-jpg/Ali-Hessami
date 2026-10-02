-- Nephron Board Questions — CKD-MBD Cardiovascular Disease: Fig. 4
-- supplemental set (9 MCQ, 5 fill-in-the-blank, 2 matching) on phenotypic
-- changes in vascular smooth muscle cells (osteo/chondrocytic
-- differentiation, apoptosis, matrix vesicle release) and the
-- disease-related vs. treatment-related factor classification in Fig. 4.
--
-- Part 1 repeats the same schema-upgrade statements from the earlier
-- question sets (harmless no-ops if already applied) so this file also
-- works standalone.
--
-- Part 2 adds these 16 questions to the existing topic "CKD / CKD-MBD /
-- Cardiovascular Disease" for your account. Unlike the earlier per-topic
-- files, this one checks each question individually (by exact question
-- text) rather than skipping the whole topic, since that topic already has
-- the original 38-question set — so re-running this file is still a no-op,
-- but it won't block adding these alongside the existing questions.

-- ---------- Part 1: schema upgrade (idempotent) ----------
alter table public.board_questions add column if not exists question_type text not null default 'mcq';
alter table public.board_questions add column if not exists fill_answers jsonb;
alter table public.board_questions add column if not exists match_left jsonb;
alter table public.board_questions add column if not exists match_right jsonb;
alter table public.board_questions add column if not exists match_answer jsonb;
alter table public.board_questions add column if not exists allow_reuse boolean;
alter table public.board_questions add column if not exists tags jsonb;
alter table public.board_questions add column if not exists difficulty text;
alter table public.board_questions add column if not exists taxonomy integer;
alter table public.board_questions alter column correct_index drop not null;

-- ---------- Part 2: CKD-MBD Cardiovascular Disease — Fig. 4 supplemental questions ----------
do $$
declare
  v_owner_id uuid;
  v_topic text := 'CKD / CKD-MBD / Cardiovascular Disease';
begin
  select id into v_owner_id from auth.users where email = 'alihessamis@gmail.com' limit 1;
  if v_owner_id is null then
    raise exception 'owner not found for email alihessamis@gmail.com';
  end if;

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q1$بر اساس مدل Fig. 4، آزادسازی وزیکول‌ها توسط سلول‌های عضله صاف عروق (VSMC) آسیب‌دیده چه نقشی دارد؟$q1$,
    'mcq',
    '["کلسیم را از ماتریکس خارج سلولی به داخل سلول منتقل می‌کند و مرگ سلول را تسریع می‌کند", "مهارکننده‌های کلسیفیکاسیون مثل فتوئین A را به ماتریکس منتقل می‌کند", "کلسیم داخل سلولی را از سلول خارج و در ماتریکس خارج سلولی رسوب می‌دهد و به این ترتیب از مرگ سلول جلوگیری می‌کند؛ پیامد آن کلسیفیکاسیون ماتریکس است", "تمایز استئوبلاستی VSMC را مهار می‌کند", "فقط پس از آپوپتوز کامل سلول رخ می‌دهد و نقش محافظتی ندارد"]'::jsonb,
    2, null, null, null, null, null,
    '["Fig. 4", "matrix vesicles", "VSMC survival"]'::jsonb, 'hard', 2,
    $e1$طبق توضیح Fig. 4، VSMCها وزیکول‌هایی آزاد می‌کنند که کلسیم داخل سلولی را به بیرون منتقل و در ماتریکس خارج سلولی رسوب می‌دهند و به این ترتیب از مرگ سلول جلوگیری می‌کنند. این پاسخ سازشی سلول به قیمت کلسیفیکاسیون ماتریکس تمام می‌شود.$e1$
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q1$بر اساس مدل Fig. 4، آزادسازی وزیکول‌ها توسط سلول‌های عضله صاف عروق (VSMC) آسیب‌دیده چه نقشی دارد؟$q1$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q2$در Fig. 4، نقش کدام عامل مرتبط با درمان در ایجاد آسیب VSMC با علامت سؤال (نامطمئن) مشخص شده است؟$q2$,
    'mcq',
    '["آنالوگ‌های ویتامین D", "P-binderهای کلسیمی", "کلسیم محلول دیالیز", "وارفارین", "مکمل‌های کلسیم"]'::jsonb,
    0, null, null, null, null, null,
    '["Fig. 4", "treatment-related factors", "vitamin D analogs"]'::jsonb, 'hard', 2,
    $e2$در Fig. 4، ویتامین D، P-binderهای کلسیمی، مکمل‌های کلسیم، کلسیم محلول دیالیز و وارفارین عوامل مرتبط با درمان‌اند. نقش آنالوگ‌های ویتامین D با علامت سؤال آمده، یعنی سهم آن‌ها قطعی نیست.$e2$
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q2$در Fig. 4، نقش کدام عامل مرتبط با درمان در ایجاد آسیب VSMC با علامت سؤال (نامطمئن) مشخص شده است؟$q2$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q3$در Fig. 4، کدام عامل مرتبط با بیماری به صورت دوطرفه (هم افزایش و هم کاهش) به عنوان آسیب‌زننده به VSMC نشان داده شده است؟$q3$,
    'mcq',
    '["کلسیم", "فسفر", "PTH", "ویتامین D", "لیپیدهای اکسیده"]'::jsonb,
    3, null, null, null, null, null,
    '["Fig. 4", "disease-related factors", "vitamin D"]'::jsonb, 'medium', 2,
    $e3$در Fig. 4، ویتامین D با علامت «↑ یا ↓» آمده است؛ هر دو حد آن آسیب‌زا هستند. Ca، P و PTH فقط با افزایش نشان داده شده‌اند. این با متن هم‌خوان است که سطوح بسیار پایین یا بالای ویتامین D را عامل خطر می‌داند.$e3$
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q3$در Fig. 4، کدام عامل مرتبط با بیماری به صورت دوطرفه (هم افزایش و هم کاهش) به عنوان آسیب‌زننده به VSMC نشان داده شده است؟$q3$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q4$نوجوان ۱۶ ساله تحت همودیالیز با کلسیفیکاسیون پیشرفته ماتریکس عروقی بررسی می‌شود. بر اساس Fig. 4، کدام یافته در آزمون‌های بالینی انتظار نمی‌رود؟$q4$,
    'mcq',
    '["افزایش ضخامت انتیما–مدیای کاروتید", "افزایش سرعت موج نبض", "افزایش اتساع‌پذیری (distensibility) عروق", "کلسیفیکاسیون عروق کرونر", "افزایش سفتی عروق"]'::jsonb,
    2, null, null, null, null, null,
    '["Fig. 4", "clinical tests", "distensibility"]'::jsonb, 'medium', 3,
    $e4$کلسیفیکاسیون ماتریکس خارج سلولی در بالین به صورت افزایش cIMT دیده می‌شود. همچنین به سفتی عروق، یعنی افزایش PWV و کاهش اتساع‌پذیری، و کلسیفیکاسیون کرونر منجر می‌شود.$e4$
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q4$نوجوان ۱۶ ساله تحت همودیالیز با کلسیفیکاسیون پیشرفته ماتریکس عروقی بررسی می‌شود. بر اساس Fig. 4، کدام یافته در آزمون‌های بالینی انتظار نمی‌رود؟$q4$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q5$در Fig. 4، مسیر آپوپتوز VSMC از طریق کدام واسطه به کلسیفیکاسیون منجر می‌شود؟$q5$,
    'mcq',
    '["افزایش Runx2", "افزایش سطح موضعی کلسیم", "کاهش فتوئین A", "افزایش آلکالن فسفاتاز", "کاهش PTH"]'::jsonb,
    1, null, null, null, null, null,
    '["Fig. 4", "apoptosis", "local calcium"]'::jsonb, 'medium', 2,
    $e5$در Fig. 4، آپوپتوز با افزایش سطح موضعی کلسیم به کلسیفیکاسیون می‌انجامد. Runx2 و ALP مربوط به مسیر تمایز استئو/کندروسیتی، و کاهش فتوئین A و MGP مربوط به مسیر آزادسازی وزیکول‌ها و اجسام آپوپتوتیک‌اند.$e5$
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q5$در Fig. 4، مسیر آپوپتوز VSMC از طریق کدام واسطه به کلسیفیکاسیون منجر می‌شود؟$q5$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q6$در Fig. 4، شاخه «آزادسازی وزیکول‌های ماتریکس و اجسام آپوپتوتیک» با کدام تغییر همراه نشان داده شده است؟$q6$,
    'mcq',
    '["افزایش Runx2 و ALP", "تبدیل استئوبلاستی VSMC", "افزایش سطح موضعی کلسیم", "افزایش PTH", "از دست رفتن مهارکننده‌ها، با کاهش فتوئین A و MGP"]'::jsonb,
    4, null, null, null, null, null,
    '["Fig. 4", "matrix vesicles", "inhibitors"]'::jsonb, 'hard', 2,
    $e6$در Fig. 4، شاخه آزادسازی وزیکول‌های ماتریکس و اجسام آپوپتوتیک با از دست رفتن مهارکننده‌ها و کاهش فتوئین A و پروتئین Gla ماتریکس همراه است.$e6$
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q6$در Fig. 4، شاخه «آزادسازی وزیکول‌های ماتریکس و اجسام آپوپتوتیک» با کدام تغییر همراه نشان داده شده است؟$q6$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q7$در مطالعه بافت‌شناسی شریان یک نوجوان دیالیزی، بیان بالای Runx2 و آلکالن فسفاتاز در سلول‌های لایه مدیا دیده می‌شود. بر اساس Fig. 4، این یافته نشان‌دهنده کدام مسیر آسیب VSMC است؟$q7$,
    'mcq',
    '["تمایز استئو/کندروسیتی و تبدیل استئوبلاستی VSMC", "آپوپتوز با افزایش کلسیم موضعی", "از دست رفتن مهارکننده‌ها", "آترواسکلروز انتیما", "پاسخ طبیعی و غیرپاتولوژیک VSMC"]'::jsonb,
    0, null, null, null, null, null,
    '["Fig. 4", "osteo/chondrocytic differentiation", "biopsy"]'::jsonb, 'hard', 3,
    $e7$در Fig. 4، شاخه تمایز استئو/کندروسیتی با افزایش Runx2، افزایش آلکالن فسفاتاز و تبدیل استئوبلاستی سلول عضله صاف مشخص می‌شود و VSMC به سلول شبه‌استخوانی تبدیل می‌شود.$e7$
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q7$در مطالعه بافت‌شناسی شریان یک نوجوان دیالیزی، بیان بالای Runx2 و آلکالن فسفاتاز در سلول‌های لایه مدیا دیده می‌شود. بر اساس Fig. 4، این یافته نشان‌دهنده کدام مسیر آسیب VSMC است؟$q7$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q8$پسر ۱۴ ساله تحت همودیالیز فشار خون بالا، دیس‌لیپیدمی و هیپرفسفاتمی دارد و کربنات کلسیم، مکمل کلسیم، محلول دیالیز با کلسیم بالا و وارفارین دریافت می‌کند. بر اساس Fig. 4، کدام زوج هر دو جزو «عوامل مرتبط با درمان» هستند؟$q8$,
    'mcq',
    '["فشار خون بالا و وارفارین", "هیپرفسفاتمی و کربنات کلسیم", "دیس‌لیپیدمی و مکمل کلسیم", "مکمل کلسیم و کلسیم محلول دیالیز", "فشار خون بالا و دیس‌لیپیدمی"]'::jsonb,
    3, null, null, null, null, null,
    '["Fig. 4", "risk factor classification"]'::jsonb, 'medium', 3,
    $e8$در Fig. 4، عوامل مرتبط با درمان شامل ویتامین D، P-binderهای کلسیمی، مکمل‌های کلسیم، کلسیم محلول دیالیز، آنالوگ‌های ویتامین D (نامطمئن) و وارفارین است. فشار خون بالا، دیس‌لیپیدمی و هیپرفسفاتمی عوامل مرتبط با بیماری‌اند.$e8$
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q8$پسر ۱۴ ساله تحت همودیالیز فشار خون بالا، دیس‌لیپیدمی و هیپرفسفاتمی دارد و کربنات کلسیم، مکمل کلسیم، محلول دیالیز با کلسیم بالا و وارفارین دریافت می‌کند. بر اساس Fig. 4، کدام زوج هر دو جزو «عوامل مرتبط با درمان» هستند؟$q8$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q9$کدام مورد در Fig. 4 جزو «عوامل مرتبط با بیماری» آسیب‌زننده به VSMC نشان داده نشده است؟$q9$,
    'mcq',
    '["التهاب", "لیپیدهای اکسیده", "فشار خون بالا", "افزایش PTH", "وارفارین"]'::jsonb,
    4, null, null, null, null, null,
    '["Fig. 4", "disease-related factors"]'::jsonb, 'medium', 2,
    $e9$عوامل مرتبط با بیماری در Fig. 4 شامل افزایش Ca، P و PTH، افزایش یا کاهش ویتامین D، التهاب، فشار خون بالا، لیپیدهای اکسیده و دیس‌لیپیدمی است. وارفارین جزو عوامل مرتبط با درمان است.$e9$
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q9$کدام مورد در Fig. 4 جزو «عوامل مرتبط با بیماری» آسیب‌زننده به VSMC نشان داده نشده است؟$q9$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q10$بر اساس Fig. 4، آسیب VSMC از سه مسیر به کلسیفیکاسیون منجر می‌شود: تمایز ____، ____ و آزادسازی وزیکول‌های ماتریکس و اجسام آپوپتوتیک.$q10$,
    'fill_blank', '[]'::jsonb, null,
    '["استئو/کندروسیتی", "آپوپتوز"]'::jsonb, null, null, null, null,
    '["Fig. 4", "VSMC damage pathways"]'::jsonb, 'easy', 2, null
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q10$بر اساس Fig. 4، آسیب VSMC از سه مسیر به کلسیفیکاسیون منجر می‌شود: تمایز ____، ____ و آزادسازی وزیکول‌های ماتریکس و اجسام آپوپتوتیک.$q10$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q11$در شاخه تمایز استئو/کندروسیتی، افزایش ____ و ____ همراه با تبدیل استئوبلاستی سلول عضله صاف دیده می‌شود.$q11$,
    'fill_blank', '[]'::jsonb, null,
    '["Runx2", "آلکالن فسفاتاز"]'::jsonb, null, null, null, null,
    '["Fig. 4", "markers"]'::jsonb, 'medium', 2, null
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q11$در شاخه تمایز استئو/کندروسیتی، افزایش ____ و ____ همراه با تبدیل استئوبلاستی سلول عضله صاف دیده می‌شود.$q11$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q12$در شاخه آزادسازی وزیکول‌ها، از دست رفتن مهارکننده‌ها با کاهش ____ و ____ نشان داده شده است.$q12$,
    'fill_blank', '[]'::jsonb, null,
    '["فتوئین A", "MGP (پروتئین Gla ماتریکس)"]'::jsonb, null, null, null, null,
    '["Fig. 4", "inhibitors"]'::jsonb, 'medium', 2, null
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q12$در شاخه آزادسازی وزیکول‌ها، از دست رفتن مهارکننده‌ها با کاهش ____ و ____ نشان داده شده است.$q12$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q13$کلسیفیکاسیون ماتریکس خارج سلولی در بالین به صورت افزایش ____ دیده می‌شود و با افزایش ____ و کاهش ____ به سفتی عروق منجر می‌شود.$q13$,
    'fill_blank', '[]'::jsonb, null,
    '["cIMT", "PWV", "اتساع‌پذیری (distensibility)"]'::jsonb, null, null, null, null,
    '["Fig. 4", "clinical tests"]'::jsonb, 'easy', 2, null
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q13$کلسیفیکاسیون ماتریکس خارج سلولی در بالین به صورت افزایش ____ دیده می‌شود و با افزایش ____ و کاهش ____ به سفتی عروق منجر می‌شود.$q13$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q14$VSMCها با آزادسازی وزیکول‌ها کلسیم ____ را به ماتریکس خارج سلولی منتقل می‌کنند و از ____ سلول جلوگیری می‌کنند.$q14$,
    'fill_blank', '[]'::jsonb, null,
    '["داخل سلولی", "مرگ"]'::jsonb, null, null, null, null,
    '["Fig. 4", "vesicles"]'::jsonb, 'medium', 2, null
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q14$VSMCها با آزادسازی وزیکول‌ها کلسیم ____ را به ماتریکس خارج سلولی منتقل می‌کنند و از ____ سلول جلوگیری می‌کنند.$q14$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q15$بر اساس Fig. 4، هر عامل را به گروه مربوط وصل کنید.$q15$,
    'matching', '[]'::jsonb, null, null,
    '[{"key": "1", "text": "لیپیدهای اکسیده"}, {"key": "2", "text": "کلسیم محلول دیالیز"}, {"key": "3", "text": "التهاب"}, {"key": "4", "text": "مکمل‌های کلسیم"}, {"key": "5", "text": "افزایش یا کاهش ویتامین D"}, {"key": "6", "text": "وارفارین"}, {"key": "7", "text": "فشار خون بالا"}, {"key": "8", "text": "P-binderهای کلسیمی"}]'::jsonb,
    '[{"key": "X", "text": "عامل مرتبط با بیماری"}, {"key": "Y", "text": "عامل مرتبط با درمان"}]'::jsonb,
    '[{"left": "1", "right": "X"}, {"left": "2", "right": "Y"}, {"left": "3", "right": "X"}, {"left": "4", "right": "Y"}, {"left": "5", "right": "X"}, {"left": "6", "right": "Y"}, {"left": "7", "right": "X"}, {"left": "8", "right": "Y"}]'::jsonb,
    true,
    '["Fig. 4", "factor classification"]'::jsonb, 'medium', 2, null
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q15$بر اساس Fig. 4، هر عامل را به گروه مربوط وصل کنید.$q15$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q16$هر مسیر آسیب VSMC در Fig. 4 را به واسطه یا تغییر مربوط وصل کنید.$q16$,
    'matching', '[]'::jsonb, null, null,
    '[{"key": "1", "text": "تمایز استئو/کندروسیتی"}, {"key": "2", "text": "آپوپتوز"}, {"key": "3", "text": "آزادسازی وزیکول‌های ماتریکس و اجسام آپوپتوتیک"}]'::jsonb,
    '[{"key": "A", "text": "افزایش سطح موضعی کلسیم"}, {"key": "B", "text": "از دست رفتن مهارکننده‌ها (کاهش فتوئین A و MGP)"}, {"key": "C", "text": "افزایش Runx2 و ALP و تبدیل استئوبلاستی SMC"}]'::jsonb,
    '[{"left": "1", "right": "C"}, {"left": "2", "right": "A"}, {"left": "3", "right": "B"}]'::jsonb,
    false,
    '["Fig. 4", "pathways", "mediators"]'::jsonb, 'medium', 2, null
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q16$هر مسیر آسیب VSMC در Fig. 4 را به واسطه یا تغییر مربوط وصل کنید.$q16$
  );

end $$;
