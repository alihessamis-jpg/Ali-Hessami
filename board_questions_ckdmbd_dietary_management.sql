-- Nephron Board Questions — CKD-MBD Dietary Management (Phosphate & Calcium)
-- question set (12 MCQ, 8 fill-in-the-blank, 3 matching). Covers early
-- phosphate control rationale (FGF23), K/DOQI dietary phosphate targets by
-- CKD stage, organic vs. inorganic phosphate bioavailability, hidden
-- phosphate sources (food additives, medication excipients), the
-- protein-phosphate link, and pediatric dietary calcium intake data.
--
-- Part 1 repeats the same schema-upgrade statements from the earlier
-- question sets (harmless no-ops if already applied) so this file also
-- works standalone.
--
-- Part 2 inserts the 23 questions under topic "CKD / CKD-MBD / Dietary Management" for your
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

-- ---------- Part 2: CKD-MBD Dietary Management question set ----------
do $$
declare
  v_owner_id uuid;
  v_topic text := 'CKD / CKD-MBD / Dietary Management';
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
     $q1$پسر ۷ ساله با CKD مرحله ۲ فسفر، کلسیم و PTH سرم طبیعی دارد. والدین می‌پرسند وقتی فسفر خون طبیعی است، چرا باید از الان مشاوره تغذیه درباره فسفر داشته باشند. بهترین پاسخ کدام است؟$q1$,
     'mcq',
     '["مشاوره تغذیه فقط پس از بالا رفتن فسفر سرم لازم است", "مشاوره فقط برای کنترل وزن است", "FGF23 پیش از بروز اختلال در Ca، P یا PTH سرم بالا می‌رود؛ پس کنترل بهینه فسفر از ابتدای CKD جزء حیاتی مدیریت پیشگیرانه است", "محدودیت شدید فسفر زیر محدوده طبیعی سنی از مرحله ۲ لازم است", "فسفر رژیم غذایی تأثیری بر CKD-MBD ندارد"]'::jsonb,
     2, null, null, null, null, null,
     '["early phosphate control", "FGF23"]'::jsonb, 'medium', 3,
     $e1$چون سطوح بالای FGF23 پیش از بروز اختلال در Ca، P یا PTH سرم دیده می‌شود، کنترل بهینه فسفر سرم جزء حیاتی مدیریت پیشگیرانه است. K/DOQI و Pediatric Renal Nutrition Taskforce مشاوره تغذیه منظم را از مراحل اولیه CKD توصیه می‌کنند.$e1$),

    (v_owner_id, v_topic,
     $q2$دختر ۹ ساله با CKD مرحله ۳، فسفر و PTH سرم طبیعی دارد. هدف دریافت فسفر رژیمی او بر اساس راهنماها کدام است؟$q2$,
     'mcq',
     '["در محدوده طبیعی متناسب با سن", "۵۰٪ دریافت توصیه‌شده", "حد پایین محدوده طبیعی (۸۰٪ دریافت توصیه‌شده)", "بدون محدودیت", "حذف کامل لبنیات و پروتئین حیوانی"]'::jsonb,
     0, null, null, null, null, null,
     '["phosphate target", "mild-moderate CKD"]'::jsonb, 'medium', 3,
     $e2$در مراحل خفیف تا متوسط CKD، دریافت فسفر رژیمی در محدوده طبیعی متناسب با سن محدود می‌شود. محدودیت تا حد پایین محدوده طبیعی (۸۰٪ DRI طبق K/DOQI) برای CKD پیشرفته با هیپرفسفاتمی یا هیپرپاراتیروئیدی پایدار است.$e2$),

    (v_owner_id, v_topic,
     $q3$نوجوان ۱۴ ساله با CKD مرحله ۵ پیش از دیالیز، هیپرفسفاتمی و هیپرپاراتیروئیدی پایدار دارد. دریافت توصیه‌شده (DRI) فسفر برای سن او 1250 mg/day است. بر اساس K/DOQI، هدف دریافت فسفر رژیمی او حدوداً چقدر است؟$q3$,
     'mcq',
     '["1250 mg/day", "625 mg/day", "1500 mg/day", "1000 mg/day", "400 mg/day"]'::jsonb,
     3, null, null, null, null, null,
     '["phosphate target", "advanced CKD", "calculation"]'::jsonb, 'hard', 3,
     $e3$در CKD پیشرفته با هیپرفسفاتمی یا هیپرپاراتیروئیدی پایدار، دریافت فسفر تا حد پایین محدوده طبیعی محدود می‌شود. K/DOQI ۸۰٪ DRI را پیشنهاد می‌کند (۰.۸ × ۱۲۵۰ = ۱۰۰۰ میلی‌گرم در روز).$e3$),

    (v_owner_id, v_topic,
     $q4$متخصص تغذیه برای نوجوان دیالیزی رژیمی با ۶۰ گرم پروتئین در روز طراحی کرده است. فسفر همراه با این مقدار پروتئین حدوداً چقدر است و پیام بالینی آن چیست؟$q4$,
     'mcq',
     '["۱۲۰ تا ۱۸۰ میلی‌گرم؛ فسفر ارتباطی با پروتئین ندارد", "۶۰۰ تا ۷۲۰ میلی‌گرم؛ چون به ازای هر گرم پروتئین ۱۰ تا ۱۲ میلی‌گرم فسفر دریافت می‌شود، کاهش فسفر نباید به قیمت کاهش دریافت پروتئین تمام شود", "۱۵۰۰ تا ۲۰۰۰ میلی‌گرم؛ پروتئین باید حذف شود", "۳۰۰ تا ۳۶۰ میلی‌گرم؛ محدودیت پروتئین بهترین راه کنترل فسفر است", "۶۰۰ تا ۷۲۰ میلی‌گرم؛ پس پروتئین باید به نصف کاهش یابد"]'::jsonb,
     1, null, null, null, null, null,
     '["protein-phosphate link", "calculation"]'::jsonb, 'hard', 3,
     $e4$دریافت فسفر مستقیماً با دریافت پروتئین مرتبط است و به ازای هر گرم پروتئین ۱۰ تا ۱۲ میلی‌گرم فسفر دریافت می‌شود (۶۰ × ۱۰ تا ۱۲ = ۶۰۰ تا ۷۲۰ میلی‌گرم). هرگونه کاهش فسفر نباید دریافت پروتئین را مختل کند.$e4$),

    (v_owner_id, v_topic,
     $q5$چرا فسفر موجود در غذاهای فرآوری‌شده برای کودکان CKD مشکل‌سازتر از فسفر موجود در غذاهای طبیعی پروتئینی است؟$q5$,
     'mcq',
     '["فسفات‌های آلی غذاهای طبیعی تقریباً به‌طور کامل جذب می‌شوند", "غذاهای فرآوری‌شده فسفر ندارند", "افزودنی‌های فسفات معدنی فقط در روده بزرگ جذب می‌شوند", "فسفات‌های آلی و معدنی جذب یکسانی دارند", "افزودنی‌های فسفات معدنی (مانند اسید فسفریک و سدیم فسفات) تقریباً به‌طور کامل جذب می‌شوند، در حالی که فسفات‌های آلی فراهمی زیستی کمتری دارند"]'::jsonb,
     4, null, null, null, null, null,
     '["inorganic phosphate", "bioavailability"]'::jsonb, 'medium', 2,
     $e5$غذاهای فرآوری‌شده احتمالاً حاوی افزودنی‌های فسفات معدنی مانند اسید فسفریک و سدیم فسفات هستند که تقریباً به‌طور کامل جذب می‌شوند. در مقابل، فسفات‌های آلی فراهمی زیستی کمتری دارند.$e5$),

    (v_owner_id, v_topic,
     $q6$مادر پسر ۱۲ ساله دیالیزی برای کنترل فسفر برچسب مواد غذایی را بررسی می‌کند. نوشابه کولا، سوسیس و نان صنعتی روی برچسب «E number» مربوط به فسفات دارند. کدام راهنمایی صحیح‌تر است؟$q6$,
     'mcq',
     '["E number فقط وجود افزودنی فسفات را نشان می‌دهد، نه مقدار آن؛ این محصولات (گوشت فرآوری‌شده، لبنیات، محصولات نانوایی و نوشابه‌های کولا) می‌توانند مقادیر قابل‌توجهی فسفات معدنی با جذب تقریباً کامل داشته باشند", "E number مقدار دقیق فسفر را نشان می‌دهد و می‌توان با آن دریافت را محاسبه کرد", "نوشابه‌های کولا فسفر ندارند", "فسفات افزودنی در محصولات نانوایی وجود ندارد", "وجود E number نشان‌دهنده فسفات آلی با جذب کم است"]'::jsonb,
     0, null, null, null, null, null,
     '["food labels", "E numbers", "processed foods"]'::jsonb, 'hard', 3,
     $e6$غذاهای فرآوری‌شده با مقادیر قابل‌توجه فسفات معدنی افزوده شامل گوشت، لبنیات، محصولات نانوایی و نوشیدنی‌هایی مثل کولا هستند. وجود این افزودنی‌ها، اما نه مقدار آن‌ها، با «E number» نشان داده می‌شود.$e6$),

    (v_owner_id, v_topic,
     $q7$دختر ۱۵ ساله دیالیزی با وجود پایبندی خوب به رژیم و P-binder، هیپرفسفاتمی مقاوم دارد. او چند داروی ضد فشار خون و آنتی‌اسید مصرف می‌کند. کدام منبع پنهان فسفر باید بررسی شود؟$q7$,
     'mcq',
     '["فسفات آلی موجود در سبزیجات", "آب آشامیدنی", "فسفات‌های معدنی که به عنوان ماده جانبی (excipient) به داروهایی مانند آنتی‌اسیدها و بسیاری از داروهای ضد فشار خون افزوده می‌شوند", "محلول دیالیز", "فسفر موجود در P-binder کلسیمی"]'::jsonb,
     2, null, null, null, null, null,
     '["medication excipients", "refractory hyperphosphatemia"]'::jsonb, 'hard', 3,
     $e7$فسفات‌های معدنی به عنوان ماده جانبی به چند دارو، مانند آنتی‌اسیدها و بسیاری از داروهای ضد فشار خون، افزوده می‌شوند و می‌توانند دریافت روزانه فسفر را به‌طور قابل‌توجهی افزایش دهند.$e7$),

    (v_owner_id, v_topic,
     $q8$نوجوانی با رژیم غذایی غربی حدود ۱۸۰۰ میلی‌گرم فسفر در روز دریافت می‌کند. اگر بخش جذب‌شده آن را مطابق میانگین ذکرشده در نظر بگیرید، حدوداً چه مقدار فسفر از روده جذب می‌شود؟$q8$,
     'mcq',
     '["حدود ۱۸۰ تا ۳۶۰ میلی‌گرم (۱۰ تا ۲۰٪)", "حدود ۱۰۸۰ تا ۱۲۶۰ میلی‌گرم (۶۰ تا ۷۰٪)", "کل ۱۸۰۰ میلی‌گرم (۱۰۰٪)", "حدود ۵۴۰ تا ۷۲۰ میلی‌گرم (۳۰ تا ۴۰٪)", "کمتر از ۱۰۰ میلی‌گرم"]'::jsonb,
     1, null, null, null, null, null,
     '["western diet", "absorption", "calculation"]'::jsonb, 'medium', 3,
     $e8$میانگین دریافت فسفر در رژیم غربی حدود ۱۵۰۰ تا ۲۰۰۰ میلی‌گرم در روز است و ۶۰ تا ۷۰٪ آن جذب می‌شود (۱۸۰۰ × ۰.۶ تا ۰.۷ = ۱۰۸۰ تا ۱۲۶۰ میلی‌گرم). سهم فسفات معدنی افزودنی با جذب تقریباً کامل می‌تواند این مقدار را بیشتر کند.$e8$),

    (v_owner_id, v_topic,
     $q9$برای کودک ۸ ساله با CKD مرحله ۴، به علت هیپرفسفاتمی رژیم بسیار محدود در فسفر با حذف تقریباً کامل لبنیات و گوشت تجویز شده است. سه ماه بعد سرعت رشد و آلبومین سرم کاهش یافته و دریافت کلسیم بسیار پایین است. کدام تفسیر صحیح‌تر است؟$q9$,
     'mcq',
     '["این تغییرات ارتباطی با رژیم ندارد", "باید محدودیت فسفر از این هم شدیدتر شود", "کاهش رشد فقط ناشی از PTH است", "محدودیت شدید فسفر رژیمی ممکن است دریافت کافی سایر مواد مغذی، به‌ویژه پروتئین و کلسیم، را مختل کند؛ کاهش فسفر نباید به قیمت کاهش پروتئین باشد", "حذف لبنیات دریافت کلسیم را افزایش می‌دهد"]'::jsonb,
     3, null, null, null, null, null,
     '["aggressive restriction", "protein", "calcium"]'::jsonb, 'hard', 3,
     $e9$محدودیت شدید فسفر رژیمی دشوار است، چون ممکن است دریافت کافی سایر مواد مغذی، به‌ویژه پروتئین و کلسیم، را مختل کند. چون فسفر مستقیماً با پروتئین همراه است، هرگونه کاهش فسفر نباید دریافت پروتئین را مختل کند.$e9$),

    (v_owner_id, v_topic,
     $q10$فلویی پیشنهاد می‌کند همه کودکان CKD مرحله ۴–۵ بخش، برای کاهش بار کلسیم، از P-binder کلسیمی به binder بدون کلسیم منتقل شوند. با توجه به داده‌های دریافت کلسیم در این کودکان، کدام نکته باید در نظر گرفته شود؟$q10$,
     'mcq',
     '["همه این کودکان کلسیم بیش از حد از رژیم دریافت می‌کنند", "در یک مطالعه، ۶۷٪ کودکان CKD مرحله ۴–۵ دریافت کلسیم رژیمی کمتر از مقدار توصیه‌شده داشتند و کلسیم اضافی از داروها، عمدتاً P-binderها، برای تأمین نیاز تغذیه‌ای کلسیم لازم بود؛ پس تغییر binder باید با ارزیابی دریافت کلی کلسیم همراه باشد", "کلسیم P-binderها جذب نمی‌شود و در محاسبه دریافت نقشی ندارد", "نیاز کلسیم کودکان با بزرگسالان برابر است", "کمبود کلسیم در CKD کودکان نادر است"]'::jsonb,
     1, null, null, null, null, null,
     '["calcium intake", "phosphate binders"]'::jsonb, 'hard', 3,
     $e10$در یک مطالعه اخیر، ۶۷٪ کودکان CKD مرحله ۴–۵ دریافت کلسیم رژیمی کمتر از مقدار توصیه‌شده داشتند. کلسیم اضافی از داروها، عمدتاً P-binderها، برای حفظ نیاز تغذیه‌ای کلسیم لازم بود.$e10$),

    (v_owner_id, v_topic,
     $q11$پسر ۱۰ ساله دیالیزی روزانه حدود ۳۰۰ گرم محصولات گوشتی فرآوری‌شده حاوی افزودنی فسفات مصرف می‌کند. افزودنی‌ها حدوداً چه مقدار فسفر به رژیم روزانه او اضافه می‌کنند؟$q11$,
     'mcq',
     '["۱۸ تا ۲۱ میلی‌گرم", "۶۰ تا ۷۰ میلی‌گرم", "۱۸۰ تا ۲۱۰ میلی‌گرم", "۶۰۰ تا ۷۰۰ میلی‌گرم", "۱۵۰۰ تا ۲۰۰۰ میلی‌گرم"]'::jsonb,
     2, null, null, null, null, null,
     '["phosphate additives", "calculation"]'::jsonb, 'medium', 3,
     $e11$افزودنی‌ها ممکن است محتوای فسفر غذا را ۶۰ تا ۷۰ میلی‌گرم به ازای هر ۱۰۰ گرم محصول افزایش دهند (۳ × ۶۰ تا ۷۰ = ۱۸۰ تا ۲۱۰ میلی‌گرم). این فسفر معدنی تقریباً به‌طور کامل جذب می‌شود.$e11$),

    (v_owner_id, v_topic,
     $q12$کدام عبارت درباره راهنماهای K/DOQI و Pediatric Renal Nutrition Taskforce برای مدیریت تغذیه‌ای Ca و P در کودکان صحیح است؟$q12$,
     'mcq',
     '["فقط برای کودکان دیالیزی (5D) تدوین شده‌اند", "مشاوره تغذیه را فقط پس از رسیدن به CKD مرحله ۵ توصیه می‌کنند", "حذف کامل فسفر رژیمی را توصیه می‌کنند", "محدودیت پروتئین را مقدم بر محدودیت فسفر می‌دانند", "برای کودکان CKD مراحل ۲ تا 5D تدوین شده‌اند و هر دو مشاوره تغذیه منظم را از مراحل اولیه CKD توصیه می‌کنند"]'::jsonb,
     4, null, null, null, null, null,
     '["guidelines", "dietary counseling"]'::jsonb, 'medium', 2,
     $e12$K/DOQI و Pediatric Renal Nutrition Taskforce راهنماهایی برای مدیریت تغذیه‌ای Ca و P در کودکان CKD مراحل ۲ تا 5D منتشر کرده‌اند. هر دو مشاوره تغذیه منظم را از مراحل اولیه CKD توصیه می‌کنند.$e12$),

    (v_owner_id, v_topic,
     $q13$چون سطوح بالای ____ پیش از بروز اختلال در Ca، P یا PTH سرم دیده می‌شود، کنترل بهینه ____ سرم جزء حیاتی مدیریت پیشگیرانه است.$q13$,
     'fill_blank', '[]'::jsonb, null,
     '["FGF23", "فسفر"]'::jsonb, null, null, null, null,
     '["FGF23", "prevention"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q14$در CKD پیشرفته با هیپرفسفاتمی یا هیپرپاراتیروئیدی پایدار، K/DOQI محدود کردن دریافت فسفر را به ____ درصد دریافت توصیه‌شده (DRI) پیشنهاد می‌کند.$q14$,
     'fill_blank', '[]'::jsonb, null,
     '["۸۰"]'::jsonb, null, null, null, null,
     '["K/DOQI", "phosphate target"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q15$میانگین دریافت فسفر با رژیم غربی حدود ____ تا ____ میلی‌گرم در روز است و ____ تا ____ درصد آن جذب می‌شود.$q15$,
     'fill_blank', '[]'::jsonb, null,
     '["۱۵۰۰", "۲۰۰۰", "۶۰", "۷۰"]'::jsonb, null, null, null, null,
     '["western diet"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q16$دو نمونه از افزودنی‌های فسفات معدنی در غذاهای فرآوری‌شده ____ و ____ هستند که تقریباً به‌طور کامل جذب می‌شوند.$q16$,
     'fill_blank', '[]'::jsonb, null,
     '["اسید فسفریک", "سدیم فسفات"]'::jsonb, null, null, null, null,
     '["inorganic additives"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q17$افزودنی‌ها ممکن است محتوای فسفر غذا را ____ تا ____ میلی‌گرم به ازای هر ۱۰۰ گرم محصول افزایش دهند.$q17$,
     'fill_blank', '[]'::jsonb, null,
     '["۶۰", "۷۰"]'::jsonb, null, null, null, null,
     '["additives"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q18$روی برچسب مواد غذایی، «E number» فقط ____ افزودنی فسفات را نشان می‌دهد، نه ____ آن را.$q18$,
     'fill_blank', '[]'::jsonb, null,
     '["وجود", "مقدار"]'::jsonb, null, null, null, null,
     '["E numbers"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q19$به ازای هر گرم پروتئین حدود ____ تا ____ میلی‌گرم فسفر دریافت می‌شود.$q19$,
     'fill_blank', '[]'::jsonb, null,
     '["۱۰", "۱۲"]'::jsonb, null, null, null, null,
     '["protein-phosphate link"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q20$در یک مطالعه، ____ درصد کودکان CKD مرحله ۴–۵ دریافت کلسیم رژیمی کمتر از مقدار توصیه‌شده داشتند و کلسیم اضافی عمدتاً از ____ تأمین می‌شد.$q20$,
     'fill_blank', '[]'::jsonb, null,
     '["۶۷", "P-binderها"]'::jsonb, null, null, null, null,
     '["calcium intake"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q21$هر منبع فسفر را به ویژگی آن وصل کنید.$q21$,
     'matching', '[]'::jsonb, null, null,
     '[{"key": "1", "text": "فسفات آلی در غذاهای طبیعی"}, {"key": "2", "text": "افزودنی‌های فسفات معدنی در غذاهای فرآوری‌شده"}, {"key": "3", "text": "فسفات معدنی به عنوان ماده جانبی در داروها"}, {"key": "4", "text": "فسفر همراه پروتئین رژیمی"}]'::jsonb,
     '[{"key": "A", "text": "تقریباً به‌طور کامل جذب می‌شود؛ وجودش با E number مشخص می‌شود"}, {"key": "B", "text": "فراهمی زیستی کمتر"}, {"key": "C", "text": "در آنتی‌اسیدها و بسیاری از داروهای ضد فشار خون؛ منبع پنهان فسفر"}, {"key": "D", "text": "۱۰ تا ۱۲ میلی‌گرم به ازای هر گرم؛ محدودیت آن نباید دریافت پروتئین را مختل کند"}]'::jsonb,
     '[{"left": "1", "right": "B"}, {"left": "2", "right": "A"}, {"left": "3", "right": "C"}, {"left": "4", "right": "D"}]'::jsonb,
     false,
     '["phosphate sources", "bioavailability"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q22$هر وضعیت بالینی را به هدف دریافت فسفر رژیمی مربوط وصل کنید.$q22$,
     'matching', '[]'::jsonb, null, null,
     '[{"key": "1", "text": "CKD مرحله ۲ با شاخص‌های سرمی طبیعی"}, {"key": "2", "text": "CKD مرحله ۳ با فسفر و PTH طبیعی"}, {"key": "3", "text": "CKD مرحله ۵ با هیپرفسفاتمی پایدار"}, {"key": "4", "text": "CKD مرحله ۴ با هیپرپاراتیروئیدی پایدار"}]'::jsonb,
     '[{"key": "X", "text": "در محدوده طبیعی متناسب با سن، همراه با مشاوره تغذیه منظم"}, {"key": "Y", "text": "حد پایین محدوده طبیعی (۸۰٪ DRI طبق K/DOQI)"}]'::jsonb,
     '[{"left": "1", "right": "X"}, {"left": "2", "right": "X"}, {"left": "3", "right": "Y"}, {"left": "4", "right": "Y"}]'::jsonb,
     true,
     '["phosphate target", "CKD stage"]'::jsonb, 'medium', 3, null),

    (v_owner_id, v_topic,
     $q23$هر عدد را به یافته مربوط وصل کنید.$q23$,
     'matching', '[]'::jsonb, null, null,
     '[{"key": "1", "text": "۱۵۰۰ تا ۲۰۰۰ میلی‌گرم در روز"}, {"key": "2", "text": "۶۰ تا ۷۰٪"}, {"key": "3", "text": "۶۰ تا ۷۰ میلی‌گرم به ازای هر ۱۰۰ گرم"}, {"key": "4", "text": "۱۰ تا ۱۲ میلی‌گرم"}, {"key": "5", "text": "۶۷٪"}, {"key": "6", "text": "۸۰٪"}]'::jsonb,
     '[{"key": "A", "text": "فسفر همراه هر گرم پروتئین"}, {"key": "B", "text": "کودکان CKD مرحله ۴–۵ با دریافت کلسیم رژیمی کمتر از توصیه"}, {"key": "C", "text": "میانگین دریافت فسفر با رژیم غربی"}, {"key": "D", "text": "هدف K/DOQI برای دریافت فسفر در CKD پیشرفته با هیپرفسفاتمی یا هیپرپاراتیروئیدی پایدار (نسبت به DRI)"}, {"key": "E", "text": "سهم جذب‌شده فسفر رژیمی"}, {"key": "F", "text": "افزایش محتوای فسفر غذا با افزودنی‌ها"}]'::jsonb,
     '[{"left": "1", "right": "C"}, {"left": "2", "right": "E"}, {"left": "3", "right": "F"}, {"left": "4", "right": "A"}, {"left": "5", "right": "B"}, {"left": "6", "right": "D"}]'::jsonb,
     false,
     '["numbers"]'::jsonb, 'medium', 2, null);
end $$;
