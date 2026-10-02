-- Nephron Board Questions — CKD-MBD Phosphate Binders
-- question set (29 MCQ, 16 fill-in-the-blank, 5 matching). Covers binder
-- mechanism/classes, evidence gaps, calcium-based binders as first-line
-- (calcium carbonate vs. acetate, elemental calcium and phosphate-bound
-- calculations), hypercalcemia and calcium-balance limits, sevelamer
-- (hydrochloride vs. carbonate, lipid effects, fat-soluble vitamin binding),
-- aluminum hydroxide as short-term rescue therapy, lanthanum carbonate
-- (not recommended in children), iron-based binders, magnesium salts, and
-- newer agents (NPT2b inhibition, niacin).
--
-- Part 1 repeats the same schema-upgrade statements from the earlier
-- question sets (harmless no-ops if already applied) so this file also
-- works standalone.
--
-- Part 2 inserts the 50 questions under topic "CKD / CKD-MBD / Phosphate Binders" for your
-- account. Skipped automatically if that topic already has questions, so
-- re-running this file is a no-op (delete the topic's existing rows first
-- if you want to reload it with edits).

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

-- ---------- Part 2: CKD-MBD Phosphate Binders question set ----------
do $$
declare
  v_owner_id uuid;
  v_topic text := 'CKD / CKD-MBD / Phosphate Binders';
  v_exists boolean;
begin
  select id into v_owner_id from auth.users where email = 'alihessamis@gmail.com' limit 1;
  if v_owner_id is null then
    raise exception 'owner not found for email alihessamis@gmail.com';
  end if;

  select exists(
    select 1 from public.board_questions where owner_id = v_owner_id and topic = v_topic
  ) into v_exists;

  if v_exists then
    raise notice 'Topic "%" already has questions for this owner — skipping insert (delete its rows first to reload).', v_topic;
    return;
  end if;

  insert into public.board_questions
    (owner_id, topic, question, question_type, options, correct_index, fill_answers, match_left, match_right, match_answer, allow_reuse, tags, difficulty, taxonomy, explanation)
  values
    (v_owner_id, v_topic,
     $q1$کدام عبارت مکانیسم اثر و طبقه‌بندی P-binderها را درست بیان می‌کند؟$q1$,
     'mcq',
     '["با مهار ترشح PTH فسفر را کاهش می‌دهند", "با افزایش دفع کلیوی فسفر عمل می‌کنند", "با تشکیل کمپلکس‌های کم‌محلول با فسفر در لوله گوارش، جذب روده‌ای فسفر را کاهش می‌دهند و به دو گروه اصلی کلسیمی و بدون کلسیم تقسیم می‌شوند", "با مهار FGF23 در استئوسیت عمل می‌کنند", "فسفر را از استخوان به روده منتقل می‌کنند"]'::jsonb,
     2, null, null, null, null, null,
     '["mechanism", "binder classes"]'::jsonb, 'medium', 2,
     $e1$P-binderها با تشکیل کمپلکس‌های کم‌محلول با فسفر در لوله گوارش جذب روده‌ای فسفر را کاهش می‌دهند. دو نوع اصلی دارند: کلسیمی و بدون کلسیم.$e1$),

    (v_owner_id, v_topic,
     $q2$کدام عبارت وضعیت شواهد درباره درمان با P-binder را دقیق‌تر بیان می‌کند؟$q2$,
     'mcq',
     '["زمان شروع P-binder در طیف CKD، سطح هدف فسفر برای بهبود پیامدها و هم‌ارزی binderها از نظر پیامدهای طولانی‌مدت نامشخص است و شواهدی وجود ندارد که سطح هدف خاصی از فسفر پیامدهای بالینی را بهبود دهد", "شروع P-binder از CKD مرحله ۲ در همه کودکان با شواهد قوی ثابت شده است", "همه P-binderها از نظر پیامدهای طولانی‌مدت هم‌ارزند", "طبیعی کردن فسفر مرگ‌ومیر قلبی‌عروقی کودکان را در کارآزمایی‌ها کاهش داده است", "binderهای بدون کلسیم در کودکان کاهش مرگ‌ومیر را نشان داده‌اند"]'::jsonb,
     0, null, null, null, null, null,
     '["evidence gaps", "phosphate target"]'::jsonb, 'hard', 2,
     $e2$زمان شروع P-binder، سطح هدف فسفر و هم‌ارزی binderها از نظر پیامدهای طولانی‌مدت نامشخص است. هیچ شاهدی وجود ندارد که سطوح هدف خاص فسفر پیامدهای بالینی را بهبود دهد.$e2$),

    (v_owner_id, v_topic,
     $q3$پسر ۱۲ ساله با CKD مرحله ۳ (eGFR حدود 35) فسفر سرم طبیعی دارد. همکاری پیشنهاد می‌کند برای «پیشگیری» از هیپرفسفاتمی، sevelamer یا کربنات کلسیم شروع شود. کدام داده باید در این تصمیم مدنظر باشد؟$q3$,
     'mcq',
     '["کارآزمایی‌های کودکان نشان داده‌اند شروع زودهنگام binder کلسیفیکاسیون را کم می‌کند", "در یک کارآزمایی تصادفی در بزرگسالان با eGFR بین ۲۰ تا ۴۵ و فسفر طبیعی، درمان با کلسیم، لانتانوم و/یا sevelamer با افزایش کلسیفیکاسیون کرونر همراه بود، در حالی که در گروه دارونما چنین نبود؛ داده مشابهی در کودکان وجود ندارد", "sevelamer در بیماران با فسفر طبیعی بی‌خطر است، چون کلسیم ندارد", "شروع binder در فسفر طبیعی همیشه FGF23 را طبیعی می‌کند", "در این کارآزمایی binder فقط در گروه کلسیمی کلسیفیکاسیون را افزایش داد"]'::jsonb,
     1, null, null, null, null, null,
     '["normophosphatemia", "coronary calcification", "adult RCT"]'::jsonb, 'hard', 3,
     $e3$در یک کارآزمایی تصادفی در بزرگسالان با eGFR بین ۲۰ تا ۴۵ و فسفر طبیعی، افزایش کلسیفیکاسیون کرونر در بیماران درمان‌شده با کلسیم، لانتانوم و/یا sevelamer دیده شد، اما در گروه دارونما نه. داده مشابهی برای کودکان وجود ندارد.$e3$),

    (v_owner_id, v_topic,
     $q4$دختر ۸ ساله با CKD مرحله ۴ با وجود محدودیت مناسب رژیمی هیپرفسفاتمی پایدار دارد. کلسیم سرم طبیعی است و ویتامین D فعال دریافت نمی‌کند. انتخاب خط اول P-binder کدام است؟$q4$,
     'mcq',
     '["هیدروکسید آلومینیوم", "کربنات لانتانوم", "نمک منیزیم", "P-binder کلسیمی (مثلاً کربنات کلسیم)", "نیاسین"]'::jsonb,
     3, null, null, null, null, null,
     '["first-line", "calcium-based binders"]'::jsonb, 'medium', 3,
     $e4$بر اساس توصیه KDOQI برای کودکان CKD مراحل ۲ تا ۵، انتخاب P-binder باید بر اساس سطح کلسیم سرم باشد. P-binderهای کلسیمی، به جز در هیپرکلسمی آشکار، درمان خط اول‌اند.$e4$),

    (v_owner_id, v_topic,
     $q5$پسر ۱۰ ساله تحت دیالیز صفاقی با کربنات کلسیم درمان می‌شود. اکنون فسفر 7.5 mg/dL و کلسیم 11.2 mg/dL دارد. کدام اقدام درباره P-binder مناسب‌تر است؟$q5$,
     'mcq',
     '["افزایش دوز کربنات کلسیم", "تغییر به استات کلسیم با دوز بالا", "شروع کربنات لانتانوم", "قطع کامل همه binderها", "استفاده از P-binder بدون کلسیم (مثل sevelamer)، به‌تنهایی یا همراه با کاهش binder کلسیمی"]'::jsonb,
     4, null, null, null, null, null,
     '["hypercalcemia", "calcium-free binders"]'::jsonb, 'medium', 3,
     $e5$P-binderهای بدون کلسیم در بیماران با هیپرکلسمی، به‌تنهایی یا همراه با binderهای کلسیمی، اندیکاسیون دارند. لانتانوم در کودکان توصیه نمی‌شود.$e5$),

    (v_owner_id, v_topic,
     $q6$بر اساس توصیه KDOQI برای کودکان CKD مراحل ۲ تا ۵، کدام شاخص اصلی‌ترین راهنمای انتخاب نوع P-binder است؟$q6$,
     'mcq',
     '["سطح کلسیم سرم", "سطح FGF23", "سطح آلکالن فسفاتاز", "سن بیمار", "سطح PTH"]'::jsonb,
     0, null, null, null, null, null,
     '["KDOQI", "choice of binder"]'::jsonb, 'medium', 2,
     $e6$توصیه KDOQI برای کودکان CKD مراحل ۲ تا ۵ این است که انتخاب P-binder بر اساس سطح کلسیم سرم باشد.$e6$),

    (v_owner_id, v_topic,
     $q7$کدام مقایسه استات کلسیم و کربنات کلسیم صحیح است؟$q7$,
     'mcq',
     '["استات کلسیم ۴۰٪ و کربنات کلسیم ۲۵٪ کلسیم المنتال دارد", "استات کلسیم ۲۵٪ کلسیم المنتال دارد (در برابر ۴۰٪ کربنات کلسیم) و به ازای هر واحد کلسیم، binder مؤثرتری است", "هر دو کلسیم المنتال یکسان و کارایی یکسان دارند", "کربنات کلسیم به ازای هر واحد کلسیم binder مؤثرتری است", "استات کلسیم کلسیم ندارد"]'::jsonb,
     1, null, null, null, null, null,
     '["calcium acetate", "calcium carbonate", "elemental calcium"]'::jsonb, 'hard', 2,
     $e7$استات کلسیم حاوی ۲۵٪ کلسیم المنتال است (در مقابل ۴۰٪ در کربنات کلسیم) و به ازای هر واحد کلسیم binder مؤثرتری است. طبق Table 2، به ازای هر ۳ میلی‌گرم کلسیم جذب‌شده حدود ۱ میلی‌گرم فسفر متصل می‌کند، در حالی که کربنات کلسیم به ازای هر ۸ میلی‌گرم.$e7$),

    (v_owner_id, v_topic,
     $q8$نوجوانی روزانه دو قرص 1.25 گرمی کربنات کلسیم مصرف می‌کند. بر اساس Table 2، کلسیم المنتال دریافتی روزانه او از این دارو چقدر است؟$q8$,
     'mcq',
     '["۲۵۰ میلی‌گرم", "۶۲۵ میلی‌گرم", "۱۰۰۰ میلی‌گرم", "۲۵۰۰ میلی‌گرم", "۵۰۰ میلی‌گرم"]'::jsonb,
     2, null, null, null, null, null,
     '["calculation", "elemental calcium", "calcium carbonate"]'::jsonb, 'medium', 3,
     $e8$کربنات کلسیم ۴۰٪ کلسیم المنتال دارد. دو قرص ۱۲۵۰ میلی‌گرمی برابر ۲۵۰۰ میلی‌گرم است و ۲۵۰۰ × ۰.۴ = ۱۰۰۰ میلی‌گرم کلسیم المنتال.$e8$),

    (v_owner_id, v_topic,
     $q9$کودکی سه بار در روز یک قرص 950 میلی‌گرمی استات کلسیم مصرف می‌کند. بر اساس Table 2، کلسیم المنتال روزانه تقریباً چقدر است؟$q9$,
     'mcq',
     '["حدود ۷۱۳ میلی‌گرم", "حدود ۲۳۸ میلی‌گرم", "حدود ۱۱۴۰ میلی‌گرم", "حدود ۲۸۵۰ میلی‌گرم", "حدود ۶۲۷ میلی‌گرم"]'::jsonb,
     0, null, null, null, null, null,
     '["calculation", "calcium acetate"]'::jsonb, 'medium', 3,
     $e9$استات کلسیم ۲۵٪ کلسیم المنتال دارد: ۹۵۰ × ۳ = ۲۸۵۰ میلی‌گرم و ۲۸۵۰ × ۰.۲۵ ≈ ۷۱۳ میلی‌گرم. گزینه C حاصل محاسبه اشتباه با ۴۰٪ است.$e9$),

    (v_owner_id, v_topic,
     $q10$دو کودک هر یک روزانه حدود ۲۴۰ میلی‌گرم کلسیم از binder خود جذب می‌کنند؛ اولی با کربنات کلسیم و دومی با استات کلسیم. بر اساس Table 2، فسفر متصل‌شده تقریباً چقدر است؟$q10$,
     'mcq',
     '["هر دو حدود ۸۰ میلی‌گرم", "کربنات حدود ۸۰ و استات حدود ۳۰ میلی‌گرم", "هر دو حدود ۳۰ میلی‌گرم", "کربنات حدود ۳۰ و استات حدود ۸۰ میلی‌گرم", "کربنات حدود ۱۰۴ و استات حدود ۸۰ میلی‌گرم"]'::jsonb,
     3, null, null, null, null, null,
     '["phosphate bound per calcium absorbed", "calculation"]'::jsonb, 'hard', 3,
     $e10$طبق Table 2، کربنات کلسیم حدود ۱ میلی‌گرم فسفر به ازای هر ۸ میلی‌گرم کلسیم جذب‌شده متصل می‌کند (۲۴۰ ÷ ۸ = ۳۰). استات کلسیم حدود ۱ میلی‌گرم به ازای هر ۳ میلی‌گرم متصل می‌کند (۲۴۰ ÷ ۳ = ۸۰). یعنی با بار کلسیمی یکسان، استات کارایی بیشتری دارد.$e10$),

    (v_owner_id, v_topic,
     $q11$شیرخوار ۹ ماهه با CKD مرحله ۵ و هیپرفسفاتمی، با استات کلسیم دچار عوارض گوارشی قابل‌توجه شده است. کلسیم سرم طبیعی است. بر اساس Table 2، کدام گزینه مناسب‌تر است؟$q11$,
     'mcq',
     '["کربنات کلسیم مایع (250 mg/5 ml) که عوارض گوارشی کمی دارد", "کربنات لانتانوم جویدنی", "کپسول هیدروکسید آلومینیوم", "افزایش دوز استات کلسیم", "قرص ۸۰۰ میلی‌گرمی sevelamer"]'::jsonb,
     0, null, null, null, null, null,
     '["infants", "formulation", "GI side effects"]'::jsonb, 'hard', 3,
     $e11$طبق Table 2، عوارض گوارشی استات کلسیم به‌ویژه در شیرخواران شایع‌تر است. کربنات کلسیم به صورت مایع (۲۵۰ میلی‌گرم در ۵ میلی‌لیتر) موجود است، ارزان است و عوارض گوارشی کمی دارد. لانتانوم و آلومینیوم برای مصرف معمول در کودکان مناسب نیستند و تجویز sevelamer در کودکان کم‌سن دشوار است.$e11$),

    (v_owner_id, v_topic,
     $q12$در یک مطالعه، کاهش FGF23 با binderهای کلسیمی کمتر از lanthanum و sevelamer بود. علت محتمل کدام است؟$q12$,
     'mcq',
     '["binderهای کلسیمی فسفر را متصل نمی‌کنند", "lanthanum و sevelamer مستقیماً گیرنده FGF23 را مهار می‌کنند", "کلسیم اثر تحریکی بر بیان FGF23 دارد", "binderهای کلسیمی Klotho را افزایش می‌دهند", "binderهای کلسیمی PTH را افزایش می‌دهند"]'::jsonb,
     2, null, null, null, null, null,
     '["FGF23", "calcium-based binders"]'::jsonb, 'hard', 2,
     $e12$به علت اثر تحریکی کلسیم بر بیان FGF23، P-binderهای کلسیمی در کاهش FGF23 کم‌اثرتر از binderهای بدون کلسیم مانند lanthanum و sevelamer به نظر می‌رسند.$e12$),

    (v_owner_id, v_topic,
     $q13$کدام بیمار تحت درمان با کربنات کلسیم با دوز بالا بیشترین خطر هیپرکلسمی را دارد؟$q13$,
     'mcq',
     '["کودک CKD مرحله ۳ با PTH بالا و بدون ویتامین D فعال", "نوجوان دیالیزی با بیماری استخوان آدینامیک که کلسیتریول هم دریافت می‌کند", "کودک با استئیت فیبروزا و turnover بالا", "کودک با کمبود 25D و هیپوکلسمی", "کودک با دریافت کلسیم رژیمی پایین"]'::jsonb,
     1, null, null, null, null, null,
     '["hypercalcemia risk", "adynamic bone", "vitamin D"]'::jsonb, 'hard', 3,
     $e13$دوزهای بالای کربنات کلسیم ممکن است به هیپرکلسمی منجر شوند، به‌ویژه در بیماران تحت درمان با ویتامین D یا بیماران با بیماری استخوان آدینامیک، که ظرفیت بافری استخوان برای کلسیم کم است.$e13$),

    (v_owner_id, v_topic,
     $q14$کدام عبارت درباره حداکثر دوز binderهای کلسیمی صحیح است؟$q14$,
     'mcq',
     '["KDIGO حداکثر دوز دقیق ۲۰۰۰ میلی‌گرم کلسیم المنتال را تعیین کرده است", "binderهای کلسیمی در هر دوزی تعادل کلسیم را منفی نگه می‌دارند", "در کودکان، به علت نیاز اسکلت، محدودیتی برای دوز کلسیم وجود ندارد", "تعادل مثبت کلسیم فقط با دوزهای بالای ۵۰۰۰ میلی‌گرم ایجاد می‌شود", "بیماران بزرگسال CKD پیش از دیالیز با حتی ۱۵۰۰ میلی‌گرم در روز کربنات کلسیم در تعادل مثبت کلسیم بوده‌اند؛ KDIGO حداکثر دوز را مشخص نکرده، اما وجود احتمالی یک حد بالای ایمن را می‌پذیرد"]'::jsonb,
     4, null, null, null, null, null,
     '["calcium balance", "maximum dose", "KDIGO"]'::jsonb, 'hard', 2,
     $e14$بیماران بزرگسال CKD پیش از دیالیز با دریافت حتی ۱۵۰۰ میلی‌گرم در روز کربنات کلسیم در تعادل مثبت کلسیم بوده‌اند. توصیه‌های فعلی KDIGO حداکثر دوز binder کلسیمی را مشخص نمی‌کنند، اما وجود احتمالی یک حد بالای ایمن برای دوز کلسیم را می‌پذیرند.$e14$),

    (v_owner_id, v_topic,
     $q15$دختر ۱۳ ساله دیالیزی که از ۳ ماه پیش sevelamer hydrochloride مصرف می‌کند، اکنون بیکربنات سرم 16 mEq/L دارد (قبلاً 21). بهترین اقدام کدام است؟$q15$,
     'mcq',
     '["تغییر به sevelamer carbonate، چون آزاد شدن اسید کلریدریک هنگام اتصال فسفر در فرم هیدروکلراید می‌تواند اسیدوز متابولیک ایجاد کند", "ادامه همان دارو، چون sevelamer بر وضعیت اسید و باز اثری ندارد", "تغییر به هیدروکسید آلومینیوم", "تغییر به کربنات لانتانوم", "افزودن نمک منیزیم"]'::jsonb,
     0, null, null, null, null, null,
     '["sevelamer hydrochloride", "metabolic acidosis"]'::jsonb, 'hard', 3,
     $e15$چون هنگام اتصال فسفر اسید کلریدریک آزاد می‌شود، sevelamer hydrochloride ممکن است اسیدوز متابولیک ایجاد کند. استفاده از sevelamer carbonate این عارضه را برطرف می‌کند.$e15$),

    (v_owner_id, v_topic,
     $q16$دو کارآزمایی تصادفی کنترل‌شده در کودکان، sevelamer hydrochloride را با کدام binder مقایسه کردند و نتیجه چه بود؟$q16$,
     'mcq',
     '["با کربنات لانتانوم؛ sevelamer ضعیف‌تر بود", "با کربنات کلسیم؛ sevelamer کلسیم را افزایش داد", "با هیدروکسید آلومینیوم؛ sevelamer قوی‌تر بود", "با sucroferric oxyhydroxide؛ نتایج برابر بود", "با استات کلسیم؛ ظرفیت اتصال فسفر هم‌ارز بود و sevelamer کلسیم سرم را افزایش نداد"]'::jsonb,
     4, null, null, null, null, null,
     '["sevelamer", "pediatric RCTs"]'::jsonb, 'medium', 2,
     $e16$دو کارآزمایی تصادفی کنترل‌شده در کودکان نشان دادند sevelamer hydrochloride ظرفیت اتصال فسفر هم‌ارز با استات کلسیم دارد و کلسیم سرم را افزایش نمی‌دهد.$e16$),

    (v_owner_id, v_topic,
     $q17$نوجوان ۱۵ ساله دیالیزی با هیپرفسفاتمی، کلسیم سرم مرزی بالا و دیس‌لیپیدمی (LDL بالا، HDL پایین) دارد. کدام binder می‌تواند علاوه بر کنترل فسفر، اثر مطلوبی بر پروفایل لیپید داشته باشد؟$q17$,
     'mcq',
     '["کربنات کلسیم", "هیدروکسید آلومینیوم", "sevelamer، که کلسترول تام و LDL را کاهش و HDL را افزایش می‌دهد", "نمک منیزیم", "استات کلسیم"]'::jsonb,
     2, null, null, null, null, null,
     '["sevelamer", "lipids", "dyslipidemia"]'::jsonb, 'hard', 3,
     $e17$sevelamer علاوه بر کاهش فسفر، کلسترول تام و LDL را کاهش و HDL را افزایش می‌دهد. طبق Table 2، مانند یک رزین متصل‌شونده به کلسترول عمل می‌کند. بدون کلسیم بودن آن نیز در کلسیم مرزی بالا مزیت است.$e17$),

    (v_owner_id, v_topic,
     $q18$پسر ۱۱ ساله دیالیزی که از یک سال پیش sevelamer carbonate با دوز بالا مصرف می‌کند، با وجود مکمل ارگوکلسیفرول همچنان 25(OH)D پایین دارد. بر اساس Table 2، کدام ویژگی دارو باید مدنظر باشد؟$q18$,
     'mcq',
     '["sevelamer جذب کلسیم را افزایش می‌دهد", "sevelamer به ویتامین‌های محلول در چربی متصل می‌شود", "sevelamer باعث تجمع آلومینیوم می‌شود", "sevelamer FGF23 را افزایش می‌دهد", "sevelamer باعث هیپرمنیزیمی می‌شود"]'::jsonb,
     1, null, null, null, null, null,
     '["sevelamer", "fat-soluble vitamins"]'::jsonb, 'hard', 3,
     $e18$طبق Table 2، sevelamer به ویتامین‌های محلول در چربی متصل می‌شود. همچنین گران است، تجویز آن در کودکان کم‌سن دشوار است و فرم هیدروکلراید ممکن است اسیدوز متابولیک ایجاد کند.$e18$),

    (v_owner_id, v_topic,
     $q19$بر اساس Table 2، کدام فرم دارویی فقط برای sevelamer carbonate موجود است؟$q19$,
     'mcq',
     '["قرص ۸۰۰ میلی‌گرمی", "سوسپانسیون ۲۵۰ میلی‌گرم در ۵ میلی‌لیتر", "قرص جویدنی ۵۰۰ میلی‌گرمی", "ساشه ۲۴۰۰ میلی‌گرمی", "کپسول ۱۰۰ میلی‌گرمی"]'::jsonb,
     3, null, null, null, null, null,
     '["formulations", "sevelamer carbonate"]'::jsonb, 'medium', 2,
     $e19$قرص ۸۰۰ میلی‌گرمی برای هر دو فرم sevelamer موجود است، اما ساشه ۲۴۰۰ میلی‌گرمی فقط برای sevelamer carbonate. سوسپانسیون ۲۵۰ میلی‌گرم در ۵ میلی‌لیتر مربوط به کربنات کلسیم، قرص جویدنی ۵۰۰ میلی‌گرمی مربوط به sucroferric oxyhydroxide، و کپسول ۱۰۰ میلی‌گرمی مربوط به آلومینیوم است.$e19$),

    (v_owner_id, v_topic,
     $q20$پسر ۱۴ ساله دیالیزی با فسفر 10.5 mg/dL و کلسیم 11.5 mg/dL، به حداکثر دوز sevelamer و محدودیت رژیمی پاسخ نداده است. کدام رویکرد درباره هیدروکسید آلومینیوم صحیح است؟$q20$,
     'mcq',
     '["آلومینیوم به عنوان درمان نگهدارنده طولانی‌مدت مناسب است", "آلومینیوم در کودکان به هیچ عنوان قابل استفاده نیست", "آلومینیوم فقط به عنوان درمان «نجات‌بخش» کوتاه‌مدت در هیپرفسفاتمی شدید همراه با هیپرکلسمی که به سایر binderها پاسخ نداده قابل استفاده است و پایش منظم سطح خونی آلومینیوم ضروری است", "آلومینیوم بدون نیاز به پایش سطح خونی قابل استفاده است", "آلومینیوم خط اول درمان در هیپرکلسمی است"]'::jsonb,
     2, null, null, null, null, null,
     '["aluminum", "rescue therapy"]'::jsonb, 'hard', 3,
     $e20$آلومینیوم فقط به عنوان درمان «نجات‌بخش» کوتاه‌مدت قابل استفاده است: هیپرفسفاتمی شدید همراه با هیپرکلسمی که به سایر P-binderها پاسخ نداده است. در صورت استفاده، پایش منظم سطح خونی آلومینیوم ضروری است.$e20$),

    (v_owner_id, v_topic,
     $q21$نوجوانی که به‌طور طولانی‌مدت و بدون پایش هیدروکسید آلومینیوم مصرف کرده، با اختلال شناختی و تشنج، آنمی و درد استخوانی مراجعه کرده است. بیوپسی استخوان turnover پایین نشان می‌دهد. کدام مجموعه عوارض با سمیت آلومینیوم سازگار است؟$q21$,
     'mcq',
     '["هیپرکالمی، هیپرمنیزیمی و اسهال", "اسیدوز متابولیک و کاهش ویتامین‌های محلول در چربی", "افزایش پارامترهای آهن و اسهال", "بیماری استخوان آدینامیک، انسفالوپاتی و آنمی", "هیپرکلسمی و افزایش FGF23"]'::jsonb,
     3, null, null, null, null, null,
     '["aluminum toxicity"]'::jsonb, 'hard', 3,
     $e21$هیدروکسید آلومینیوم binder بسیار مؤثری است، اما مصرف طولانی‌مدت آن می‌تواند به بیماری استخوان آدینامیک، انسفالوپاتی و آنمی منجر شود.$e21$),

    (v_owner_id, v_topic,
     $q22$خانواده نوجوان ۱۶ ساله دیالیزی که در یک کشور دیگر کربنات لانتانوم مصرف کرده، می‌پرسند آیا با قطع دارو لانتانوم به‌سرعت از بدن دفع می‌شود و آیا ادامه آن در کودکان توصیه می‌شود. پاسخ صحیح کدام است؟$q22$,
     'mcq',
     '["لانتانوم در استخوان بیماران دیالیزی تجمع می‌یابد و تا ۲ سال پس از قطع دارو باقی می‌ماند؛ با توجه به تجربه سمیت آلومینیوم، در کودکان CKD توصیه نمی‌شود", "لانتانوم ظرف چند روز کاملاً دفع می‌شود و در کودکان خط اول است", "لانتانوم جذب سیستمیک ندارد و در استخوان تجمع نمی‌یابد", "لانتانوم ضعیف‌تر از کربنات کلسیم است و به همین دلیل توصیه نمی‌شود", "لانتانوم فقط به علت هزینه در کودکان استفاده نمی‌شود"]'::jsonb,
     0, null, null, null, null, null,
     '["lanthanum", "bone accumulation", "pediatrics"]'::jsonb, 'hard', 3,
     $e22$بیماران تحت درمان طولانی با لانتانوم سطح سرمی افزایش‌یافته دارند. لانتانوم در استخوان بیماران دیالیزی تجمع می‌یابد و تا ۲ سال پس از قطع باقی می‌ماند. با توجه به تجربه سمیت آلومینیوم، binderهای حاوی لانتانوم فعلاً در کودکان CKD توصیه نمی‌شوند.$e22$),

    (v_owner_id, v_topic,
     $q23$کدام عبارت درباره قدرت اتصال فسفر کربنات لانتانوم صحیح است؟$q23$,
     'mcq',
     '["ضعیف‌تر از کربنات کلسیم است", "معادل نمک‌های منیزیم است", "فقط در حضور کلسیم مؤثر است", "فسفر روده را مؤثرتر از کربنات کلسیم و sevelamer متصل می‌کند", "در pH اسیدی معده غیرفعال است"]'::jsonb,
     3, null, null, null, null, null,
     '["lanthanum", "potency"]'::jsonb, 'medium', 2,
     $e23$کربنات لانتانوم فسفر روده را مؤثرتر از کربنات کلسیم و sevelamer متصل می‌کند. علت عدم توصیه آن در کودکان، تجمع در استخوان و ناشناخته بودن اثرات طولانی‌مدت آن بر استخوان در حال رشد است، نه ضعف اثر.$e23$),

    (v_owner_id, v_topic,
     $q24$دختر ۱۲ ساله دیالیزی هیپرفسفاتمی، کلسیم سرم مرزی بالا، آنمی با فقر آهن (فریتین و اشباع ترانسفرین پایین) و FGF23 بسیار بالا دارد. کدام binder بیشترین مزیت هم‌زمان را دارد؟$q24$,
     'mcq',
     '["کربنات کلسیم", "هیدروکسید آلومینیوم", "نمک منیزیم", "استات کلسیم", "binder آهن‌دار (مثل sucroferric oxyhydroxide) که فسفر و FGF23 را کاهش و پارامترهای آهن سرم را افزایش می‌دهد"]'::jsonb,
     4, null, null, null, null, null,
     '["iron-based binders", "sucroferric oxyhydroxide"]'::jsonb, 'hard', 3,
     $e24$P-binderهای آهن‌دار فسفر و FGF23 سرم را کاهش و هم‌زمان پارامترهای آهن سرم را افزایش می‌دهند. یک کارآزمایی تصادفی open-label نشان داد sucroferric oxyhydroxide در کودکان CKD به اندازه استات کلسیم مؤثر است. عوارض آن عمدتاً گوارشی است.$e24$),

    (v_owner_id, v_topic,
     $q25$پسر ۱۳ ساله تحت همودیالیز برای کاهش بار کلسیم، binder ترکیبی منیزیم و کربنات کلسیم دریافت می‌کند. اکنون اسهال، پتاسیم سرم بالا و منیزیم بالا دارد. کدام عبارت صحیح است؟$q25$,
     'mcq',
     '["نمک‌های منیزیم قوی‌ترین binderها هستند و عوارض آن‌ها قابل‌چشم‌پوشی است", "نمک‌های منیزیم فعالیت اتصال فسفر نسبتاً ضعیفی دارند؛ اسهال، هیپرکالمی و هیپرمنیزیمی عوارض اصلی آن‌هاست و در بیماران دیالیزی باید از محلول دیالیز بدون منیزیم استفاده شود", "هیپرکالمی ارتباطی با نمک منیزیم ندارد", "باید غلظت منیزیم محلول دیالیز افزایش یابد", "اثرات طولانی‌مدت بار منیزیم کاملاً شناخته و بی‌خطر است"]'::jsonb,
     1, null, null, null, null, null,
     '["magnesium salts", "dialysate"]'::jsonb, 'hard', 3,
     $e25$نمک‌های منیزیم فعالیت اتصال فسفر نسبتاً ضعیفی دارند. اسهال، هیپرکالمی و هیپرمنیزیمی عوارض اصلی آن‌هاست و اثرات طولانی‌مدت افزایش بار منیزیم روشن نیست. در بیماران دیالیزی باید از محلول دیالیز بدون منیزیم استفاده شود.$e25$),

    (v_owner_id, v_topic,
     $q26$کدام عبارت درباره عوامل جدیدتر کاهنده فسفر صحیح است؟$q26$,
     'mcq',
     '["جذب روده‌ای فسفر توسط NPT2b تنظیم می‌شود؛ نیاسین و نیکوتین‌آمید با تعدیل بیان آن در بزرگسالان دیالیزی کاهش پایدار فسفر ایجاد کرده‌اند، اما در یک کارآزمایی تصادفی در بزرگسالان HD، مهار NPT2b در کاهش فسفر مؤثر نبود و این عوامل در کودکان مطالعه نشده‌اند", "مهار NPT2b در کارآزمایی‌های کودکان بسیار مؤثر بوده است", "نیاسین با افزایش دفع کلیوی فسفر عمل می‌کند", "آدامس متصل‌شونده به فسفر خط اول درمان در کودکان است", "NPT2b ناقل فسفات در توبول پروگزیمال است و ارتباطی با روده ندارد"]'::jsonb,
     0, null, null, null, null, null,
     '["NPT2b", "niacin", "newer agents"]'::jsonb, 'hard', 2,
     $e26$جذب روده‌ای فسفر توسط ناقل وابسته به سدیم نوع 2b (NPT2b) تنظیم می‌شود. نیاسین و متابولیت آن نیکوتین‌آمید با تعدیل بیان NPT2b در بزرگسالان دیالیزی کاهش پایدار فسفر ایجاد کرده‌اند. اما در یک کارآزمایی تصادفی در بزرگسالان HD، مهار NPT2b مؤثر نبود. آدامس متصل‌شونده به فسفر بزاقی نیز پیشنهاد شده است. هیچ‌یک در کودکان مطالعه نشده‌اند.$e26$),

    (v_owner_id, v_topic,
     $q27$سیترات کلسیم و کتوگلوتارات کلسیم binderهای مؤثری هستند. چه عاملی استفاده از آن‌ها را محدود می‌کند؟$q27$,
     'mcq',
     '["تجمع در استخوان", "انسفالوپاتی", "عوارض گوارشی و هزینه بالا", "اسیدوز متابولیک", "هیپرمنیزیمی"]'::jsonb,
     2, null, null, null, null, null,
     '["calcium citrate", "ketoglutarate"]'::jsonb, 'medium', 2,
     $e27$سیترات کلسیم و کتوگلوتارات نیز P-binderهای مؤثری‌اند، اما عوارض گوارشی و هزینه بالا استفاده از آن‌ها را محدود می‌کند.$e27$),

    (v_owner_id, v_topic,
     $q28$نوجوان ۱۵ ساله همودیالیزی کربنات کلسیم با دوز بالا و کلسیتریول مصرف می‌کند. فسفر 7.8 mg/dL، کلسیم 10.9 mg/dL و PTH زیر محدوده هدف است و ALP پایین است. کدام راهبرد درباره P-binder منطقی‌تر است؟$q28$,
     'mcq',
     '["افزایش دوز کربنات کلسیم", "تغییر به هیدروکسید آلومینیوم طولانی‌مدت", "شروع کربنات لانتانوم", "کاهش یا قطع binder کلسیمی و جایگزینی با binder بدون کلسیم مناسب کودکان (مثل sevelamer carbonate یا binder آهن‌دار)، همراه با بازنگری در دوز ویتامین D", "افزودن نمک منیزیم به کربنات کلسیم بدون تغییر سایر داروها"]'::jsonb,
     3, null, null, null, null, null,
     '["adynamic bone", "integrated management"]'::jsonb, 'hard', 3,
     $e28$دوزهای بالای کربنات کلسیم به‌ویژه در بیماران تحت درمان با ویتامین D یا با بیماری آدینامیک به هیپرکلسمی منجر می‌شوند. در هیپرکلسمی، binderهای بدون کلسیم اندیکاسیون دارند. لانتانوم در کودکان توصیه نمی‌شود و آلومینیوم فقط درمان نجات‌بخش کوتاه‌مدت است.$e28$),

    (v_owner_id, v_topic,
     $q29$بر اساس Table 2، binderهای حاوی کلسیم را از نظر مقدار فسفر متصل‌شده به ازای هر میلی‌گرم کلسیم جذب‌شده مقایسه کنید. ترتیب از کارآمدترین به کم‌کارآمدترین کدام است؟$q29$,
     'mcq',
     '["کربنات کلسیم > استات کلسیم > منیزیم و کربنات کلسیم", "استات کلسیم > کربنات کلسیم > منیزیم و کربنات کلسیم", "منیزیم و کربنات کلسیم > استات کلسیم > کربنات کلسیم", "همه برابرند", "کربنات کلسیم > منیزیم و کربنات کلسیم > استات کلسیم"]'::jsonb,
     2, null, null, null, null, null,
     '["Table 2", "efficiency per calcium absorbed", "Mg + Ca carbonate"]'::jsonb, 'hard', 3,
     $e29$طبق Table 2، فسفر متصل‌شده به ازای کلسیم جذب‌شده برای منیزیم و کربنات کلسیم حدود ۱ میلی‌گرم به ازای ۲.۳ میلی‌گرم، برای استات کلسیم حدود ۱ میلی‌گرم به ازای ۳ میلی‌گرم، و برای کربنات کلسیم حدود ۱ میلی‌گرم به ازای ۸ میلی‌گرم است. پس ترکیب منیزیم کمترین بار کلسیم را به ازای فسفر متصل‌شده دارد، ولی عوارض و اثرات طولانی‌مدت آن مطرح است.$e29$),

    (v_owner_id, v_topic,
     $q30$P-binderها با تشکیل کمپلکس‌های ____ با فسفر در لوله گوارش، جذب روده‌ای فسفر را کاهش می‌دهند.$q30$,
     'fill_blank', '[]'::jsonb, null,
     '["کم‌محلول"]'::jsonb, null, null, null, null,
     '["mechanism"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q31$در یک کارآزمایی تصادفی در بزرگسالان با eGFR بین ____ تا ____ و فسفر طبیعی، درمان با binder با افزایش کلسیفیکاسیون ____ همراه بود.$q31$,
     'fill_blank', '[]'::jsonb, null,
     '["۲۰", "۴۵", "کرونر"]'::jsonb, null, null, null, null,
     '["adult RCT"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q32$P-binderهای ____ به جز در موارد ____ آشکار، درمان خط اول‌اند.$q32$,
     'fill_blank', '[]'::jsonb, null,
     '["کلسیمی", "هیپرکلسمی"]'::jsonb, null, null, null, null,
     '["first-line"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q33$کربنات کلسیم ____ درصد و استات کلسیم ____ درصد کلسیم المنتال دارد.$q33$,
     'fill_blank', '[]'::jsonb, null,
     '["۴۰", "۲۵"]'::jsonb, null, null, null, null,
     '["elemental calcium"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q34$طبق Table 2، ____ تا ____ درصد کلسیم کربنات کلسیم و ____ درصد کلسیم استات کلسیم جذب می‌شود.$q34$,
     'fill_blank', '[]'::jsonb, null,
     '["۲۰", "۳۰", "۲۲"]'::jsonb, null, null, null, null,
     '["Table 2", "absorption"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q35$طبق Table 2، کربنات کلسیم حدود ۱ میلی‌گرم فسفر به ازای هر ____ میلی‌گرم و استات کلسیم به ازای هر ____ میلی‌گرم کلسیم جذب‌شده متصل می‌کند.$q35$,
     'fill_blank', '[]'::jsonb, null,
     '["۸", "۳"]'::jsonb, null, null, null, null,
     '["Table 2", "phosphate bound"]'::jsonb, 'hard', 2, null),

    (v_owner_id, v_topic,
     $q36$بیماران بزرگسال CKD پیش از دیالیز با دریافت حتی ____ میلی‌گرم در روز کربنات کلسیم در تعادل ____ کلسیم بوده‌اند.$q36$,
     'fill_blank', '[]'::jsonb, null,
     '["۱۵۰۰", "مثبت"]'::jsonb, null, null, null, null,
     '["calcium balance"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q37$sevelamer یک هیدروژل بدون کلسیم و آلومینیوم از ____ با اتصالات عرضی است.$q37$,
     'fill_blank', '[]'::jsonb, null,
     '["پلی‌آلیل‌آمین"]'::jsonb, null, null, null, null,
     '["sevelamer", "structure"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q38$sevelamer hydrochloride به علت آزاد شدن ____ هنگام اتصال فسفر ممکن است اسیدوز متابولیک ایجاد کند؛ فرم ____ این عارضه را ندارد.$q38$,
     'fill_blank', '[]'::jsonb, null,
     '["اسید کلریدریک", "کربنات"]'::jsonb, null, null, null, null,
     '["sevelamer hydrochloride", "acidosis"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q39$sevelamer کلسترول تام و ____ را کاهش و ____ را افزایش می‌دهد.$q39$,
     'fill_blank', '[]'::jsonb, null,
     '["LDL", "HDL"]'::jsonb, null, null, null, null,
     '["sevelamer", "lipids"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q40$مصرف طولانی‌مدت هیدروکسید آلومینیوم می‌تواند باعث بیماری استخوان ____، ____ و آنمی شود.$q40$,
     'fill_blank', '[]'::jsonb, null,
     '["آدینامیک", "انسفالوپاتی"]'::jsonb, null, null, null, null,
     '["aluminum toxicity"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q41$لانتانوم در استخوان بیماران دیالیزی تجمع می‌یابد و تا ____ سال پس از قطع دارو باقی می‌ماند.$q41$,
     'fill_blank', '[]'::jsonb, null,
     '["۲"]'::jsonb, null, null, null, null,
     '["lanthanum"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q42$binderهای آهن‌دار فسفر و ____ سرم را کاهش و پارامترهای ____ سرم را افزایش می‌دهند.$q42$,
     'fill_blank', '[]'::jsonb, null,
     '["FGF23", "آهن"]'::jsonb, null, null, null, null,
     '["iron-based binders"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q43$عوارض اصلی نمک‌های منیزیم ____، ____ و هیپرمنیزیمی است و در بیماران دیالیزی باید از محلول دیالیز ____ استفاده شود.$q43$,
     'fill_blank', '[]'::jsonb, null,
     '["اسهال", "هیپرکالمی", "بدون منیزیم"]'::jsonb, null, null, null, null,
     '["magnesium salts"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q44$جذب روده‌ای فسفر توسط ناقل ____ تنظیم می‌شود و ____ و متابولیت آن نیکوتین‌آمید بیان آن را تعدیل می‌کنند.$q44$,
     'fill_blank', '[]'::jsonb, null,
     '["NPT2b (ناقل فسفات وابسته به سدیم نوع 2b)", "نیاسین (ویتامین B3)"]'::jsonb, null, null, null, null,
     '["NPT2b"]'::jsonb, 'hard', 2, null),

    (v_owner_id, v_topic,
     $q45$طبق Table 2، کربنات کلسیم به صورت مایع با غلظت ____ میلی‌گرم در ____ میلی‌لیتر موجود است.$q45$,
     'fill_blank', '[]'::jsonb, null,
     '["۲۵۰", "۵"]'::jsonb, null, null, null, null,
     '["Table 2", "formulations"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q46$هر P-binder را به عارضه یا محدودیت اصلی آن وصل کنید.$q46$,
     'matching', '[]'::jsonb, null, null,
     '[{"key": "1", "text": "کربنات کلسیم"}, {"key": "2", "text": "استات کلسیم"}, {"key": "3", "text": "sevelamer hydrochloride"}, {"key": "4", "text": "هیدروکسید آلومینیوم"}, {"key": "5", "text": "کربنات لانتانوم"}, {"key": "6", "text": "sucroferric oxyhydroxide"}, {"key": "7", "text": "نمک‌های منیزیم"}]'::jsonb,
     '[{"key": "A", "text": "بیماری آدینامیک، انسفالوپاتی و آنمی"}, {"key": "B", "text": "تجمع در استخوان تا ۲ سال؛ در کودکان توصیه نمی‌شود"}, {"key": "C", "text": "اسیدوز متابولیک و اتصال به ویتامین‌های محلول در چربی"}, {"key": "D", "text": "بار کلسیم بالا و خطر هیپرکلسمی"}, {"key": "E", "text": "اسهال، هیپرکالمی و هیپرمنیزیمی"}, {"key": "F", "text": "عوارض گوارشی (اسهال و تهوع)"}, {"key": "G", "text": "عوارض گوارشی شایع‌تر به‌ویژه در شیرخواران"}]'::jsonb,
     '[{"left": "1", "right": "D"}, {"left": "2", "right": "G"}, {"left": "3", "right": "C"}, {"left": "4", "right": "A"}, {"left": "5", "right": "B"}, {"left": "6", "right": "F"}, {"left": "7", "right": "E"}]'::jsonb,
     false,
     '["adverse effects"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q47$بر اساس Table 2، هر فرم دارویی را به binder مربوط وصل کنید.$q47$,
     'matching', '[]'::jsonb, null, null,
     '[{"key": "1", "text": "قرص ۴۷۵ یا ۹۵۰ میلی‌گرمی"}, {"key": "2", "text": "کپسول ۱۰۰ میلی‌گرمی"}, {"key": "3", "text": "قرص جویدنی ۵۰۰ میلی‌گرمی"}, {"key": "4", "text": "قرص یا ساشه جویدنی ۵۰۰، ۷۵۰ یا ۱۰۰۰ میلی‌گرمی"}, {"key": "5", "text": "قرص ۸۰۰ میلی‌گرمی یا ساشه ۲۴۰۰ میلی‌گرمی"}, {"key": "6", "text": "قرص ۲۵۰، ۵۰۰، ۱۲۵۰ و ۲۵۰۰ میلی‌گرمی یا مایع"}]'::jsonb,
     '[{"key": "A", "text": "کربنات کلسیم"}, {"key": "B", "text": "استات کلسیم"}, {"key": "C", "text": "sevelamer"}, {"key": "D", "text": "binderهای حاوی آلومینیوم"}, {"key": "E", "text": "کربنات لانتانوم"}, {"key": "F", "text": "sucroferric oxyhydroxide"}]'::jsonb,
     '[{"left": "1", "right": "B"}, {"left": "2", "right": "D"}, {"left": "3", "right": "F"}, {"left": "4", "right": "E"}, {"left": "5", "right": "C"}, {"left": "6", "right": "A"}]'::jsonb,
     false,
     '["Table 2", "formulations"]'::jsonb, 'hard', 2, null),

    (v_owner_id, v_topic,
     $q48$هر سناریوی بالینی را به مناسب‌ترین انتخاب binder وصل کنید.$q48$,
     'matching', '[]'::jsonb, null, null,
     '[{"key": "1", "text": "هیپرفسفاتمی با کلسیم طبیعی، بدون ویتامین D فعال"}, {"key": "2", "text": "هیپرفسفاتمی با هیپرکلسمی"}, {"key": "3", "text": "هیپرفسفاتمی شدید و هیپرکلسمی مقاوم به سایر binderها"}, {"key": "4", "text": "هیپرفسفاتمی همراه با آنمی فقر آهن و FGF23 بالا"}, {"key": "5", "text": "بیمار تحت sevelamer hydrochloride با اسیدوز متابولیک جدید"}]'::jsonb,
     '[{"key": "A", "text": "هیدروکسید آلومینیوم کوتاه‌مدت با پایش سطح آلومینیوم"}, {"key": "B", "text": "binder کلسیمی (خط اول)"}, {"key": "C", "text": "تغییر به sevelamer carbonate"}, {"key": "D", "text": "binder بدون کلسیم، به‌تنهایی یا همراه با binder کلسیمی"}, {"key": "E", "text": "binder آهن‌دار (sucroferric oxyhydroxide)"}]'::jsonb,
     '[{"left": "1", "right": "B"}, {"left": "2", "right": "D"}, {"left": "3", "right": "A"}, {"left": "4", "right": "E"}, {"left": "5", "right": "C"}]'::jsonb,
     false,
     '["clinical scenarios", "binder choice"]'::jsonb, 'hard', 3, null),

    (v_owner_id, v_topic,
     $q49$هر binder یا عامل را به وضعیت شواهد آن در کودکان وصل کنید.$q49$,
     'matching', '[]'::jsonb, null, null,
     '[{"key": "1", "text": "sevelamer hydrochloride"}, {"key": "2", "text": "sucroferric oxyhydroxide"}, {"key": "3", "text": "کربنات لانتانوم"}, {"key": "4", "text": "نیاسین / نیکوتین‌آمید"}, {"key": "5", "text": "کربنات کلسیم"}]'::jsonb,
     '[{"key": "A", "text": "کارآزمایی تصادفی open-label: به اندازه استات کلسیم مؤثر"}, {"key": "B", "text": "دو کارآزمایی تصادفی: هم‌ارز با استات کلسیم و بدون افزایش کلسیم"}, {"key": "C", "text": "در کودکان مطالعه نشده است"}, {"key": "D", "text": "در کودکان CKD توصیه نمی‌شود"}, {"key": "E", "text": "پرمصرف‌ترین؛ کارایی در بزرگسالان و کودکان نشان داده شده است"}]'::jsonb,
     '[{"left": "1", "right": "B"}, {"left": "2", "right": "A"}, {"left": "3", "right": "D"}, {"left": "4", "right": "C"}, {"left": "5", "right": "E"}]'::jsonb,
     false,
     '["pediatric evidence"]'::jsonb, 'hard', 2, null),

    (v_owner_id, v_topic,
     $q50$بر اساس Table 2، هر binder حاوی کلسیم را به مقدار فسفر متصل‌شده به ازای کلسیم جذب‌شده وصل کنید.$q50$,
     'matching', '[]'::jsonb, null, null,
     '[{"key": "1", "text": "کربنات کلسیم"}, {"key": "2", "text": "استات کلسیم"}, {"key": "3", "text": "منیزیم و کربنات کلسیم"}]'::jsonb,
     '[{"key": "A", "text": "حدود ۱ میلی‌گرم به ازای ۳ میلی‌گرم"}, {"key": "B", "text": "حدود ۱ میلی‌گرم به ازای ۲.۳ میلی‌گرم"}, {"key": "C", "text": "حدود ۱ میلی‌گرم به ازای ۸ میلی‌گرم"}]'::jsonb,
     '[{"left": "1", "right": "C"}, {"left": "2", "right": "A"}, {"left": "3", "right": "B"}]'::jsonb,
     false,
     '["Table 2", "phosphate bound per calcium absorbed"]'::jsonb, 'hard', 2, null);
end $$;
