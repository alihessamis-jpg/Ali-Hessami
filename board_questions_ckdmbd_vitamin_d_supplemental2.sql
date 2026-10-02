-- Nephron Board Questions — CKD-MBD Vitamin D Treatment: supplemental set 2
-- (16 MCQ, 8 fill-in-the-blank, 3 matching). Covers calcitriol/alfacalcidol
-- dose calculations by weight, 25D unit conversion (ng/mL <-> nmol/L) and
-- toxicity thresholds, ESPN target range interpretation, seasonal
-- monitoring, native vs. active vitamin D indications (including when NOT
-- to start active vitamin D), escalating replacement doses by baseline 25D,
-- synthetic analog evidence vs. theory (FGF23, hypercalcemia, mineralization
-- histomorphometry), calcitriol dose minimization and vascular calcification,
-- and guideline variability in 25D targets.
--
-- Part 1 repeats the same schema-upgrade statements from the earlier
-- question sets (harmless no-ops if already applied) so this file also
-- works standalone.
--
-- Part 2 adds these 27 questions to the topic "CKD / CKD-MBD / Vitamin D Treatment" for your
-- account. This is supplemental content for that topic (set 2), so unlike
-- the single-topic files this checks each question individually (by exact
-- question text) rather than skipping the whole topic — if the main
-- "Vitamin D Treatment" set (or set 1) already exists under this exact
-- topic name, these are added alongside it; if the topic does not exist yet
-- under this exact name, it is created fresh with just these questions.
-- Either way, re-running this file is a safe no-op.

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

-- ---------- Part 2: CKD-MBD Vitamin D Treatment — supplemental set 2 ----------
do $$
declare
  v_owner_id uuid;
  v_topic text := 'CKD / CKD-MBD / Vitamin D Treatment';
begin
  select id into v_owner_id from auth.users where email = 'alihessamis@gmail.com' limit 1;
  if v_owner_id is null then
    raise exception 'owner not found for email alihessamis@gmail.com';
  end if;

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q1$دختر ۱۲ ساله با وزن ۳۰ کیلوگرم و CKD مرحله ۴، PTH بالای پایدار با 25D و فسفر طبیعی دارد. محدوده دوز اولیه کلسیتریول بر اساس متن کدام است؟$q1$,
    'mcq',
    '["۰.۰۱۵ تا ۰.۰۳ میکروگرم در روز", "۱.۵ تا ۳ میکروگرم در روز", "۰.۱۵ تا ۰.۳ میکروگرم در روز", "۰.۵ تا ۱ میکروگرم در روز", "۱۵ تا ۳۰ میکروگرم در روز"]'::jsonb,
    2, null, null, null, null, null,
    '["calcitriol dose", "calculation"]'::jsonb, 'medium', 3,
    $e1$دوز اولیه ۵ تا ۱۰ نانوگرم/کیلوگرم/روز است. برای ۳۰ کیلوگرم: ۱۵۰ تا ۳۰۰ نانوگرم = ۰.۱۵ تا ۰.۳ میکروگرم در روز. سپس کمترین دوزی که PTH را در سطح طبیعی نگه دارد به کار می‌رود.$e1$
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q1$دختر ۱۲ ساله با وزن ۳۰ کیلوگرم و CKD مرحله ۴، PTH بالای پایدار با 25D و فسفر طبیعی دارد. محدوده دوز اولیه کلسیتریول بر اساس متن کدام است؟$q1$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q2$شیرخوار ۱۲ کیلوگرمی با CKD مرحله ۵ کاندید شروع آلفاکلسیدول است. دوز اولیه روزانه بر اساس متن تقریباً چقدر است؟$q2$,
    'mcq',
    '["۶۰ تا ۱۲۰ نانوگرم", "۶ تا ۱۲ نانوگرم", "۶۰۰ تا ۱۲۰۰ نانوگرم", "۲۰۰۰ IU", "۱۲ تا ۲۴ میکروگرم"]'::jsonb,
    0, null, null, null, null, null,
    '["alfacalcidol dose", "infant", "calculation"]'::jsonb, 'medium', 3,
    $e2$دوز اولیه ۵ تا ۱۰ نانوگرم/کیلوگرم/روز است (۱۲ × ۵ تا ۱۰ = ۶۰ تا ۱۲۰ نانوگرم در روز).$e2$
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q2$شیرخوار ۱۲ کیلوگرمی با CKD مرحله ۵ کاندید شروع آلفاکلسیدول است. دوز اولیه روزانه بر اساس متن تقریباً چقدر است؟$q2$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q3$پسر ۸ ساله‌ای که والدینش خودسرانه ماه‌ها دوزهای بسیار بالای ویتامین D به او داده‌اند، با 25(OH)D برابر 120 ng/mL، هیپرکلسمی و هیپرکلسیوری مراجعه کرده است. کدام تفسیر صحیح است؟$q3$,
    'mcq',
    '["۱۲۰ ng/mL معادل ۱۲۰ nmol/L و در محدوده هدف ESPN است", "این سطح معادل ۴۸ nmol/L و نشانه کمبود است", "هیپرکلسمی در این بیمار حتماً علت دیگری دارد، چون ویتامین D پنجره درمانی وسیعی دارد", "این سطح در محدوده هدف است و فقط باید دوز نگهدارنده ادامه یابد", "۱۲۰ ng/mL حدود ۳۰۰ nmol/L است، یعنی بالاتر از ۲۵۰ nmol/L که هیپرکلسمی، هیپرکلسیوری و سمیت علامت‌دار در آن گزارش شده است؛ با مسمومیت ویتامین D سازگار است"]'::jsonb,
    4, null, null, null, null, null,
    '["toxicity", "unit conversion"]'::jsonb, 'hard', 3,
    $e3$۱۲۰ × ۲.۵ = ۳۰۰ nmol/L. ویتامین D پنجره درمانی وسیعی دارد، اما هیپرکلسمی، هیپرکلسیوری و سمیت علامت‌دار در سطوح بالاتر از ۲۵۰ nmol/L گزارش شده است. این بیمار در همان محدوده است.$e3$
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q3$پسر ۸ ساله‌ای که والدینش خودسرانه ماه‌ها دوزهای بسیار بالای ویتامین D به او داده‌اند، با 25(OH)D برابر 120 ng/mL، هیپرکلسمی و هیپرکلسیوری مراجعه کرده است. کدام تفسیر صحیح است؟$q3$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q4$سطح 25(OH)D سه کودک CKD به ترتیب 25، 40 و 55 ng/mL است. بر اساس محدوده هدف ESPN، کدام کودک(ان) در محدوده هدف قرار دارند؟$q4$,
    'mcq',
    '["هر سه", "فقط کودک با 40 ng/mL", "کودکان با 40 و 55 ng/mL", "کودکان با 25 و 40 ng/mL", "هیچ‌کدام"]'::jsonb,
    1, null, null, null, null, null,
    '["ESPN target", "unit conversion", "upper limit"]'::jsonb, 'medium', 3,
    $e4$محدوده هدف ESPN بالای ۷۵ nmol/L (۳۰ ng/mL) و زیر ۱۲۰ nmol/L (۴۸ ng/mL) است. ۲۵ ng/mL (۶۲.۵ nmol/L) کمتر و ۵۵ ng/mL (۱۳۷.۵ nmol/L) بیشتر از محدوده است.$e4$
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q4$سطح 25(OH)D سه کودک CKD به ترتیب 25، 40 و 55 ng/mL است. بر اساس محدوده هدف ESPN، کدام کودک(ان) در محدوده هدف قرار دارند؟$q4$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q5$سطح 25(OH)D دختر ۱۰ ساله با CKD مرحله ۳ در اواخر تابستان 32 ng/mL بوده و تصمیم به قطع مکمل گرفته شده است. پزشک دیگری با این تصمیم مخالف است. کدام استدلال با منطق هدف ESPN سازگارتر است؟$q5$,
    'mcq',
    '["حفظ 25D در محدوده هدف از نوسانات فصلی که حتی کودکان سالم را مستعد ریکتز تغذیه‌ای می‌کند جلوگیری می‌کند؛ سطح نزدیک به حد پایین در تابستان ممکن است در زمستان به زیر هدف برسد", "سطح ۳۲ ng/mL در محدوده سمی است", "25D در CKD نوسان فصلی ندارد", "باید به جای آن کلسیتریول شروع شود", "هدف ESPN بالای ۶۰ ng/mL است"]'::jsonb,
    0, null, null, null, null, null,
    '["seasonal variation", "monitoring"]'::jsonb, 'hard', 3,
    $e5$سطوح هدف ESPN جذب روده‌ای بهینه کلسیم را حفظ می‌کنند و از نوسانات فصلی که حتی کودکان سالم را مستعد ریکتز تغذیه‌ای می‌کند جلوگیری می‌کنند. سطح ۳۲ ng/mL فقط کمی بالاتر از حد پایین هدف (۳۰ ng/mL) است.$e5$
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q5$سطح 25(OH)D دختر ۱۰ ساله با CKD مرحله ۳ در اواخر تابستان 32 ng/mL بوده و تصمیم به قطع مکمل گرفته شده است. پزشک دیگری با این تصمیم مخالف است. کدام استدلال با منطق هدف ESPN سازگارتر است؟$q5$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q6$پسر ۱۴ ساله همودیالیزی 25(OH)D برابر 12 ng/mL، PTH بالا، کلسیم طبیعی و فسفر 7.6 mg/dL دارد. کدام عبارت درباره درمان ویتامین D صحیح‌تر است؟$q6$,
    'mcq',
    '["هیچ درمان ویتامین D تا اصلاح فسفر مجاز نیست", "کلسیتریول با دوز بالا فوراً شروع شود", "ویتامین D طبیعی برای کمبود 25D در بیماران دیالیزی اندیکاسیون دارد؛ اما شروع ویتامین D فعال در حضور هیپرفسفاتمی مناسب نیست و ابتدا فسفر باید کنترل شود", "در بیماران دیالیزی ویتامین D طبیعی اندیکاسیون ندارد", "paricalcitol بدون توجه به فسفر شروع شود"]'::jsonb,
    2, null, null, null, null, null,
    '["native vs active", "hyperphosphatemia", "dialysis"]'::jsonb, 'hard', 3,
    $e6$ویتامین D طبیعی در کودکان CKD پیش از دیالیز و دیالیزی که شواهد کمبود دارند اندیکاسیون دارد. ویتامین D فعال برای هیپرپاراتیروئیدی با وجود 25D طبیعی است، به شرط نبود هیپرکلسمی و/یا هیپرفسفاتمی. این بیمار هم کمبود 25D دارد و هم هیپرفسفاتمی.$e6$
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q6$پسر ۱۴ ساله همودیالیزی 25(OH)D برابر 12 ng/mL، PTH بالا، کلسیم طبیعی و فسفر 7.6 mg/dL دارد. کدام عبارت درباره درمان ویتامین D صحیح‌تر است؟$q6$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q7$دختر ۱۱ ساله دیالیزی از ۶ ماه پیش کلسیتریول مصرف می‌کند. رزیدنت معتقد است چون بیمار «ویتامین D فعال» دریافت می‌کند، اندازه‌گیری و اصلاح 25D لازم نیست. کدام پاسخ صحیح‌تر است؟$q7$,
    'mcq',
    '["کاملاً درست است؛ کلسیتریول جایگزین ویتامین D طبیعی است", "نادرست است؛ راهنماها اندازه‌گیری روتین 25D را در بیماران CKD پیشنهاد می‌کنند و ویتامین D طبیعی برای کمبود 25D در بیماران دیالیزی جداگانه اندیکاسیون دارد", "25D فقط در CKD مرحله ۲ اندازه‌گیری می‌شود", "کلسیتریول سطح 25D را طبیعی می‌کند", "اندازه‌گیری 25D فقط پس از پیوند لازم است"]'::jsonb,
    1, null, null, null, null, null,
    '["native vitamin D", "active vitamin D", "not interchangeable"]'::jsonb, 'hard', 3,
    $e7$همه راهنماها اندازه‌گیری روتین 25D را در بیماران CKD پیشنهاد می‌کنند. ویتامین D طبیعی در بیماران پیش از دیالیز و دیالیزی با کمبود یا ناکافی بودن ویتامین D اندیکاسیون دارد. ویتامین D فعال جایگزین آن نیست، چون اندیکاسیون آن هیپرپاراتیروئیدی با وجود 25D طبیعی است.$e7$
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q7$دختر ۱۱ ساله دیالیزی از ۶ ماه پیش کلسیتریول مصرف می‌کند. رزیدنت معتقد است چون بیمار «ویتامین D فعال» دریافت می‌کند، اندازه‌گیری و اصلاح 25D لازم نیست. کدام پاسخ صحیح‌تر است؟$q7$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q8$دو کودک CKD مرحله ۳ کمبود ویتامین D دارند: کودک الف 25D برابر 6 ng/mL و کودک ب 24 ng/mL. بر اساس K/DOQI و ESPN، کدام رویکرد صحیح است؟$q8$,
    'mcq',
    '["هر دو دوز یکسان دریافت کنند", "کودک ب دوز بالاتری دریافت کند", "فقط کودک الف درمان شود", "کودک الف دوز بالاتری در فاز جایگزینی شدید دریافت کند، چون این راهنماها دوزهای افزایشی بر اساس سطح پایه 25D را توصیه می‌کنند؛ هر دو پس از آن وارد فاز نگهدارنده شوند", "هر دو فقط دوز نگهدارنده بدون فاز شدید دریافت کنند"]'::jsonb,
    3, null, null, null, null, null,
    '["escalating doses", "baseline 25D"]'::jsonb, 'medium', 3,
    $e8$K/DOQI و ESPN دوزهای افزایشی برای جایگزینی شدید بر اساس سطح پایه 25D را توصیه می‌کنند. همه راهنماها فاز بارگیری ۴ تا ۱۲ هفته و سپس نگهدارنده را توصیه می‌کنند.$e8$
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q8$دو کودک CKD مرحله ۳ کمبود ویتامین D دارند: کودک الف 25D برابر 6 ng/mL و کودک ب 24 ng/mL. بر اساس K/DOQI و ESPN، کدام رویکرد صحیح است؟$q8$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q9$نوجوان ۱۵ ساله دیالیزی با کلسیتریول، PTH در محدوده هدف ولی FGF23 بسیار بالا دارد. فلو پیشنهاد می‌کند برای کاهش FGF23 به doxercalciferol تغییر داده شود. کدام پاسخ با شواهد سازگارتر است؟$q9$,
    'mcq',
    '["همه آنالوگ‌های فعال ویتامین D ترشح FGF23 را افزایش می‌دهند و در کارآزمایی کودکان، افزایش FGF23 با doxercalciferol و کلسیتریول تفاوتی نداشت؛ پس این تغییر برای کاهش FGF23 توجیه ندارد", "doxercalciferol در کودکان FGF23 را به‌طور معنی‌دار کاهش داده است", "doxercalciferol FGF23 را طبیعی می‌کند", "FGF23 بالا هیچ ارتباطی با پیامدها ندارد", "paricalcitol در کودکان FGF23 را کاهش داده است"]'::jsonb,
    0, null, null, null, null, null,
    '["synthetic analogs", "FGF23", "evidence"]'::jsonb, 'hard', 3,
    $e9$همه آنالوگ‌های فعال ویتامین D ترشح FGF23 را افزایش می‌دهند. کارآزمایی کلسیتریول در برابر doxercalciferol در کودکان دیالیزی تفاوتی در افزایش FGF23 نشان نداد.$e9$
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q9$نوجوان ۱۵ ساله دیالیزی با کلسیتریول، PTH در محدوده هدف ولی FGF23 بسیار بالا دارد. فلو پیشنهاد می‌کند برای کاهش FGF23 به doxercalciferol تغییر داده شود. کدام پاسخ با شواهد سازگارتر است؟$q9$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q10$آنالوگ‌های سنتتیک ویتامین D برای کاهش جذب روده‌ای Ca و P با سرکوب PTH هم‌ارز طراحی شده‌اند. داده‌های کارآزمایی کودکان درباره بروز هیپرکلسمی با doxercalciferol در مقایسه با کلسیتریول چه نشان داد؟$q10$,
    'mcq',
    '["doxercalciferol هیپرکلسمی را به‌طور کامل حذف کرد", "کلسیتریول هیپرکلسمی کمتری داشت", "هیپرکلسمی فقط با doxercalciferol رخ داد", "این کارآزمایی هیپرکلسمی را ارزیابی نکرد", "با وجود منطق نظری، تفاوتی در بروز هیپرکلسمی بین دو دارو دیده نشد"]'::jsonb,
    4, null, null, null, null, null,
    '["synthetic analogs", "theory vs pediatric data"]'::jsonb, 'hard', 2,
    $e10$با اینکه آنالوگ‌های سنتتیک برای کاهش جذب روده‌ای Ca و P طراحی شده‌اند، کارآزمایی مقایسه‌ای در کودکان دیالیزی تفاوتی در کنترل هیپرپاراتیروئیدی، بروز هیپرکلسمی یا افزایش FGF23 بین کلسیتریول و doxercalciferol نشان نداد.$e10$
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q10$آنالوگ‌های سنتتیک ویتامین D برای کاهش جذب روده‌ای Ca و P با سرکوب PTH هم‌ارز طراحی شده‌اند. داده‌های کارآزمایی کودکان درباره بروز هیپرکلسمی با doxercalciferol در مقایسه با کلسیتریول چه نشان داد؟$q10$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q11$در CT نوجوان ۱۷ ساله همودیالیزی که سال‌ها کلسیتریول با دوز بالا مصرف کرده، کلسیفیکاسیون عروق کرونر دیده می‌شود. PTH اکنون در حد پایین هدف است. کدام اقدام درباره ویتامین D فعال منطقی‌تر است؟$q11$,
    'mcq',
    '["افزایش دوز کلسیتریول برای سرکوب کامل PTH", "کاهش دوز کلسیتریول به کمترین دوز مؤثر، چون مصرف کلسیتریول ممکن است در کلسیفیکاسیون خارج استخوانی در کودکان ESKD نقش داشته باشد و درمان طولانی با خطر بیماری آدینامیک همراه است", "افزودن paricalcitol به کلسیتریول", "ادامه همان دوز، چون کلسیتریول ارتباطی با کلسیفیکاسیون ندارد", "شروع کوله‌کلسیفرول با دوز ۸۰۰۰ IU/day برای کاهش کلسیفیکاسیون"]'::jsonb,
    1, null, null, null, null, null,
    '["calcitriol", "vascular calcification", "dose minimization"]'::jsonb, 'hard', 3,
    $e11$مصرف کلسیتریول ممکن است در کلسیفیکاسیون خارج استخوانی در کودکان ESKD نقش داشته باشد. باید از کمترین دوزی استفاده شود که PTH را حفظ کند، و درمان طولانی ممکن است به بیماری آدینامیک منجر شود.$e11$
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q11$در CT نوجوان ۱۷ ساله همودیالیزی که سال‌ها کلسیتریول با دوز بالا مصرف کرده، کلسیفیکاسیون عروق کرونر دیده می‌شود. PTH اکنون در حد پایین هدف است. کدام اقدام درباره ویتامین D فعال منطقی‌تر است؟$q11$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q12$کدام اثر برای آنالوگ‌های فعال ویتامین D در شواهد موجود نشان داده نشده است؟$q12$,
    'mcq',
    '["سرکوب turnover استخوان", "افزایش ترشح FGF23", "کنترل هیپرپاراتیروئیدی ثانویه", "طبیعی کردن شاخص‌های هیستومورفومتریک مینرالیزاسیون اسکلتی", "ایجاد بیماری آدینامیک با درمان طولانی"]'::jsonb,
    3, null, null, null, null, null,
    '["active vitamin D", "effects not shown"]'::jsonb, 'medium', 2,
    $e12$کلسیتریول و doxercalciferol turnover استخوان را سرکوب کردند، اما هیچ‌یک شاخص‌های هیستومورفومتریک مینرالیزاسیون را طبیعی نکردند و نقص مینرالیزاسیون در اکثر بیماران باقی ماند.$e12$
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q12$کدام اثر برای آنالوگ‌های فعال ویتامین D در شواهد موجود نشان داده نشده است؟$q12$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q13$پسر ۹ ساله با CKD مرحله ۴ با کلسیتریول ۱۰ نانوگرم/کیلوگرم/روز درمان می‌شود. PTH اکنون در حد پایین طبیعی است و کلسیم در حد بالای طبیعی. هدف بعدی چیست؟$q13$,
    'mcq',
    '["افزایش دوز برای کاهش بیشتر PTH", "ادامه همین دوز بدون پایش", "تیتراسیون رو به پایین تا کمترین دوزی که PTH را در سطح طبیعی نگه دارد، برای پیشگیری از بیماری آدینامیک، افت رشد و هیپرکلسمی", "تغییر به maxacalcitol", "قطع ویتامین D طبیعی"]'::jsonb,
    2, null, null, null, null, null,
    '["integrated", "dose titration", "adynamic risk"]'::jsonb, 'hard', 3,
    $e13$باید از کمترین دوزی استفاده شود که PTH سرم را در سطح طبیعی نگه دارد. درمان طولانی با آنالوگ‌ها ممکن است به بیماری آدینامیک با کاهش سرعت رشد و هیپرکلسمی مکرر منجر شود.$e13$
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q13$پسر ۹ ساله با CKD مرحله ۴ با کلسیتریول ۱۰ نانوگرم/کیلوگرم/روز درمان می‌شود. PTH اکنون در حد پایین طبیعی است و کلسیم در حد بالای طبیعی. هدف بعدی چیست؟$q13$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q14$فلویی با دیدن محدوده هدف متفاوت 25D در دو راهنما گیج شده است. کدام عبارت وضعیت را درست توصیف می‌کند؟$q14$,
    'mcq',
    '["یکی از راهنماها اشتباه چاپی دارد", "همه راهنماها اندازه‌گیری روتین 25D را پیشنهاد می‌کنند، اما محدوده هدف بین آن‌ها متفاوت است؛ ESPN محدوده ۷۵ تا ۱۲۰ nmol/L را پیشنهاد می‌کند", "راهنماها اندازه‌گیری 25D را توصیه نمی‌کنند", "همه راهنماها هدف بالای ۲۵۰ nmol/L دارند", "ESPN هدف ۳۰ تا ۷۵ nmol/L را پیشنهاد می‌کند"]'::jsonb,
    1, null, null, null, null, null,
    '["guideline variability", "25D targets"]'::jsonb, 'medium', 2,
    $e14$همه راهنماها اندازه‌گیری روتین 25D را در بیماران CKD پیشنهاد می‌کنند، هرچند محدوده هدف بین راهنماها متفاوت است. ESPN حفظ 25D را بالای ۷۵ و زیر ۱۲۰ nmol/L پیشنهاد می‌کند.$e14$
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q14$فلویی با دیدن محدوده هدف متفاوت 25D در دو راهنما گیج شده است. کدام عبارت وضعیت را درست توصیف می‌کند؟$q14$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q15$در بحث ژورنال کلاب درباره افزایش FGF23 ناشی از ویتامین D فعال در کودکان دیالیزی، کدام جمع‌بندی دقیق‌تر است؟$q15$,
    'mcq',
    '["افزایش FGF23 در دیالیز بی‌خطر بودنش ثابت شده است", "کارآزمایی‌های تصادفی ثابت کرده‌اند که کاهش FGF23 مرگ‌ومیر را کم می‌کند", "ویتامین D فعال FGF23 را کاهش می‌دهد", "پیامدهای افزایش FGF23 در بیماران دیالیزی هنوز کاملاً مشخص نیست؛ شواهد فعلی ارتباط FGF23 بیش از حد با افزایش مرگ‌ومیر و CVD را نشان می‌دهد، اما کارآزمایی‌های آینده‌نگر تصادفی لازم است", "FGF23 فقط در بزرگسالان افزایش می‌یابد"]'::jsonb,
    3, null, null, null, null, null,
    '["FGF23", "uncertainty", "dialysis"]'::jsonb, 'hard', 3,
    $e15$پیامدهای افزایش FGF23 در بیماران دیالیزی کاملاً مشخص نیست. شواهد فعلی نشان می‌دهد FGF23 بیش از حد با افزایش مرگ‌ومیر و CVD همراه است، اما کارآزمایی‌های آینده‌نگر تصادفی لازم است.$e15$
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q15$در بحث ژورنال کلاب درباره افزایش FGF23 ناشی از ویتامین D فعال در کودکان دیالیزی، کدام جمع‌بندی دقیق‌تر است؟$q15$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q16$پسر ۱۰ ساله با CKD مرحله ۳ پس از ۸ هفته جایگزینی شدید با کوله‌کلسیفرول به 25D برابر 36 ng/mL رسیده است. کدام برنامه ادامه درمان با راهنماها سازگار است؟$q16$,
    'mcq',
    '["ورود به فاز نگهدارنده با کوله‌کلسیفرول ۱۰۰۰ تا ۲۰۰۰ IU/day", "ادامه دوز فاز شدید (۸۰۰۰ IU/day) به‌طور نامحدود", "قطع کامل مکمل", "تغییر به کلسیتریول", "افزایش دوز تا 25D بالای ۲۵۰ nmol/L"]'::jsonb,
    0, null, null, null, null, null,
    '["maintenance dose", "cholecalciferol"]'::jsonb, 'hard', 3,
    $e16$پس از فاز جایگزینی شدید ۴ تا ۱۲ هفته‌ای، رژیم نگهدارنده با کوله‌کلسیفرول ۱۰۰۰ تا ۲۰۰۰ IU/day ادامه می‌یابد. ۳۶ ng/mL (۹۰ nmol/L) در محدوده هدف ESPN است.$e16$
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q16$پسر ۱۰ ساله با CKD مرحله ۳ پس از ۸ هفته جایگزینی شدید با کوله‌کلسیفرول به 25D برابر 36 ng/mL رسیده است. کدام برنامه ادامه درمان با راهنماها سازگار است؟$q16$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q17$هر ۱ ng/mL از 25D برابر ____ nmol/L است؛ بنابراین ۳۰ ng/mL برابر ____ nmol/L است.$q17$,
    'fill_blank', '[]'::jsonb, null,
    '["۲.۵", "۷۵"]'::jsonb, null, null, null, null,
    '["unit conversion"]'::jsonb, 'easy', 2, null
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q17$هر ۱ ng/mL از 25D برابر ____ nmol/L است؛ بنابراین ۳۰ ng/mL برابر ____ nmol/L است.$q17$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q18$آستانه گزارش سمیت ویتامین D (۲۵۰ nmol/L) معادل حدود ____ ng/mL است.$q18$,
    'fill_blank', '[]'::jsonb, null,
    '["۱۰۰"]'::jsonb, null, null, null, null,
    '["unit conversion", "toxicity"]'::jsonb, 'medium', 2, null
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q18$آستانه گزارش سمیت ویتامین D (۲۵۰ nmol/L) معادل حدود ____ ng/mL است.$q18$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q19$سه راهنمای اصلی مدیریت ویتامین D در کودکان CKD مراحل ۲ تا ۵ عبارت‌اند از ____، به‌روزرسانی ____ و ____.$q19$,
    'fill_blank', '[]'::jsonb, null,
    '["K/DOQI", "KDIGO", "ESPN"]'::jsonb, null, null, null, null,
    '["guidelines"]'::jsonb, 'medium', 2, null
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q19$سه راهنمای اصلی مدیریت ویتامین D در کودکان CKD مراحل ۲ تا ۵ عبارت‌اند از ____، به‌روزرسانی ____ و ____.$q19$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q20$در RCT کودکان CKD، کودکانی که با ____ به سطح 25D بالای ____ nmol/L رسیدند، زمان طولانی‌تری تا بروز هیپرپاراتیروئیدی ثانویه داشتند.$q20$,
    'fill_blank', '[]'::jsonb, null,
    '["ارگوکلسیفرول", "۷۵"]'::jsonb, null, null, null, null,
    '["RCT", "ergocalciferol"]'::jsonb, 'medium', 2, null
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q20$در RCT کودکان CKD، کودکانی که با ____ به سطح 25D بالای ____ nmol/L رسیدند، زمان طولانی‌تری تا بروز هیپرپاراتیروئیدی ثانویه داشتند.$q20$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q21$استرول‌های فعال ویتامین D در کودکان CKD اندیکاسیون دارند که PTH آن‌ها با وجود سطوح طبیعی ____ و ____ بالا باقی بماند.$q21$,
    'fill_blank', '[]'::jsonb, null,
    '["25D", "فسفر"]'::jsonb, null, null, null, null,
    '["active vitamin D", "indication"]'::jsonb, 'medium', 2, null
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q21$استرول‌های فعال ویتامین D در کودکان CKD اندیکاسیون دارند که PTH آن‌ها با وجود سطوح طبیعی ____ و ____ بالا باقی بماند.$q21$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q22$آنالوگ‌های سنتتیک برای کاهش جذب روده‌ای ____ و ____ با اثر سرکوب‌کننده PTH ____ ساخته شده‌اند.$q22$,
    'fill_blank', '[]'::jsonb, null,
    '["کلسیم", "فسفر", "هم‌ارز"]'::jsonb, null, null, null, null,
    '["synthetic analogs"]'::jsonb, 'medium', 2, null
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q22$آنالوگ‌های سنتتیک برای کاهش جذب روده‌ای ____ و ____ با اثر سرکوب‌کننده PTH ____ ساخته شده‌اند.$q22$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q23$paricalcitol و doxercalciferol در ____ و maxacalcitol در ____ تأیید شده‌اند.$q23$,
    'fill_blank', '[]'::jsonb, null,
    '["آمریکا", "ژاپن"]'::jsonb, null, null, null, null,
    '["approval"]'::jsonb, 'medium', 2, null
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q23$paricalcitol و doxercalciferol در ____ و maxacalcitol در ____ تأیید شده‌اند.$q23$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q24$در کارآزمایی کلسیتریول در برابر doxercalciferol، هر دو دارو turnover را ____ کردند، اما نقص ____ در اکثر بیماران باقی ماند.$q24$,
    'fill_blank', '[]'::jsonb, null,
    '["سرکوب", "مینرالیزاسیون"]'::jsonb, null, null, null, null,
    '["mineralization"]'::jsonb, 'medium', 2, null
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q24$در کارآزمایی کلسیتریول در برابر doxercalciferol، هر دو دارو turnover را ____ کردند، اما نقص ____ در اکثر بیماران باقی ماند.$q24$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q25$برای هر سناریو مشخص کنید کدام درمان ویتامین D اندیکاسیون دارد.$q25$,
    'matching', '[]'::jsonb, null, null,
    '[{"key": "1", "text": "CKD مرحله ۲؛ 25D برابر 18 ng/mL؛ PTH طبیعی"}, {"key": "2", "text": "دیالیز؛ 25D برابر 42 ng/mL؛ PTH بالای پایدار؛ Ca و P طبیعی"}, {"key": "3", "text": "دیالیز؛ 25D برابر 40 ng/mL؛ PTH بالا؛ Ca برابر 11.4 mg/dL"}, {"key": "4", "text": "CKD مرحله ۴؛ 25D برابر 10 ng/mL؛ PTH بالا؛ Ca و P طبیعی"}, {"key": "5", "text": "CKD مرحله ۵؛ 25D برابر 38 ng/mL؛ PTH بالا؛ P برابر 8 mg/dL"}]'::jsonb,
    '[{"key": "X", "text": "ویتامین D طبیعی"}, {"key": "Y", "text": "ویتامین D فعال"}, {"key": "Z", "text": "فعلاً ویتامین D فعال شروع نشود (هیپرکلسمی یا هیپرفسفاتمی)"}]'::jsonb,
    '[{"left": "1", "right": "X"}, {"left": "2", "right": "Y"}, {"left": "3", "right": "Z"}, {"left": "4", "right": "X"}, {"left": "5", "right": "Z"}]'::jsonb,
    true,
    '["clinical scenarios", "native vs active"]'::jsonb, 'hard', 3, null
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q25$برای هر سناریو مشخص کنید کدام درمان ویتامین D اندیکاسیون دارد.$q25$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q26$هر سطح 25D را به تفسیر آن بر اساس هدف ESPN و آستانه سمیت وصل کنید.$q26$,
    'matching', '[]'::jsonb, null, null,
    '[{"key": "1", "text": "20 ng/mL"}, {"key": "2", "text": "40 ng/mL"}, {"key": "3", "text": "60 ng/mL"}, {"key": "4", "text": "110 ng/mL"}]'::jsonb,
    '[{"key": "A", "text": "حدود ۱۵۰ nmol/L؛ بالاتر از هدف، اما پایین‌تر از آستانه سمیت"}, {"key": "B", "text": "حدود ۵۰ nmol/L؛ پایین‌تر از هدف"}, {"key": "C", "text": "حدود ۲۷۵ nmol/L؛ بالاتر از آستانه گزارش سمیت"}, {"key": "D", "text": "حدود ۱۰۰ nmol/L؛ در محدوده هدف"}]'::jsonb,
    '[{"left": "1", "right": "B"}, {"left": "2", "right": "D"}, {"left": "3", "right": "A"}, {"left": "4", "right": "C"}]'::jsonb,
    false,
    '["unit conversion", "interpretation"]'::jsonb, 'medium', 3, null
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q26$هر سطح 25D را به تفسیر آن بر اساس هدف ESPN و آستانه سمیت وصل کنید.$q26$
  );

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  select v_owner_id, v_topic,
    $q27$هر وزن را به محدوده دوز اولیه روزانه استرول فعال ویتامین D (۵ تا ۱۰ نانوگرم/کیلوگرم/روز) وصل کنید.$q27$,
    'matching', '[]'::jsonb, null, null,
    '[{"key": "1", "text": "۸ کیلوگرم"}, {"key": "2", "text": "۱۵ کیلوگرم"}, {"key": "3", "text": "۲۵ کیلوگرم"}, {"key": "4", "text": "۴۰ کیلوگرم"}]'::jsonb,
    '[{"key": "A", "text": "۲۰۰ تا ۴۰۰ نانوگرم"}, {"key": "B", "text": "۴۰ تا ۸۰ نانوگرم"}, {"key": "C", "text": "۱۲۵ تا ۲۵۰ نانوگرم"}, {"key": "D", "text": "۷۵ تا ۱۵۰ نانوگرم"}]'::jsonb,
    '[{"left": "1", "right": "B"}, {"left": "2", "right": "D"}, {"left": "3", "right": "C"}, {"left": "4", "right": "A"}]'::jsonb,
    false,
    '["dose calculation"]'::jsonb, 'medium', 3, null
  where not exists (
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic and question = $q27$هر وزن را به محدوده دوز اولیه روزانه استرول فعال ویتامین D (۵ تا ۱۰ نانوگرم/کیلوگرم/روز) وصل کنید.$q27$
  );

end $$;
