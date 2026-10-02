-- Nephron Board Questions — CKD-MBD Parathyroidectomy, Antiresorptive
-- Therapy, Growth Hormone & Dialysis question set (21 MCQ, 12
-- fill-in-the-blank, 4 matching). Covers surgical parathyroidectomy
-- indications (calciphylaxis, progressive bone disease, extraskeletal
-- calcification), preoperative evaluation/imaging, autotransplantation
-- (goal, site, recurrence risk), the calcimimetic-era decline in
-- parathyroidectomy need, bisphosphonates (renal excretion, AKI risk,
-- adynamic bone/growth concerns, pediatric case-report-only evidence),
-- denosumab (RANKL mechanism, renal-independent pharmacokinetics,
-- pediatric hypocalcemia risk, adult-only efficacy evidence), ESPN growth
-- hormone criteria (growth potential, treatable risk factors first), and
-- dialysis phosphate removal (standard HD/PD inadequacy, daily/nocturnal
-- HD phosphate clearance and hypophosphatemia, dialysate calcium needs,
-- the FHN Daily Trial).
--
-- Part 1 repeats the same schema-upgrade statements from the earlier
-- question sets (harmless no-ops if already applied) so this file also
-- works standalone.
--
-- Part 2 inserts the 37 questions under topic "CKD / CKD-MBD / Parathyroidectomy, Antiresorptive Therapy, Growth Hormone & Dialysis" for your
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

-- ---------- Part 2: CKD-MBD Parathyroidectomy/Antiresorptive/GH/Dialysis question set ----------
do $$
declare
  v_owner_id uuid;
  v_topic text := 'CKD / CKD-MBD / Parathyroidectomy, Antiresorptive Therapy, Growth Hormone & Dialysis';
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
     $q1$دختر ۱۶ ساله همودیالیزی به علت QT طولانی کاندید سیناکلست نیست. با وجود درمان دارویی بهینه، هیپرکلسمی و هیپرفسفاتمی پایدار دارد و اکنون ضایعات پوستی دردناک نکروتیک با تشخیص کلسیفیلاکسی پیدا کرده است. اقدام مناسب کدام است؟$q1$,
     'mcq',
     '["شروع سیناکلست با دوز پایین", "افزایش دوز کلسیتریول", "پاراتیروئیدکتومی، پس از رد سایر علل هیپرکلسمی و تصویربرداری پاراتیروئید", "شروع بیس‌فسفونات", "افزایش کربنات کلسیم"]'::jsonb,
     2, null, null, null, null, null,
     '["parathyroidectomy", "calciphylaxis", "indications"]'::jsonb, 'hard', 3,
     $e1$در بیماران با منع مصرف یا پاسخ ناکامل به کلسی‌میمتیک‌ها، پاراتیروئیدکتومی در این شرایط اندیکاسیون دارد: هیپرکلسمی و هیپرفسفاتمی پایدار و عودکننده با وجود درمان دارویی بهینه، بیماری استخوانی پیشرونده و ناتوان‌کننده، کلسیفیکاسیون خارج استخوانی پیشرونده و/یا کلسیفیلاکسی. QT طولانی منع شروع سیناکلست است.$e1$),

    (v_owner_id, v_topic,
     $q2$کدام مورد در متن جزو اندیکاسیون‌های پاراتیروئیدکتومی در بیماران با منع مصرف یا پاسخ ناکامل به کلسی‌میمتیک ذکر نشده است؟$q2$,
     'mcq',
     '["هیپرکلسمی و هیپرفسفاتمی پایدار و عودکننده با وجود درمان بهینه", "بیماری استخوانی پیشرونده و ناتوان‌کننده", "کلسیفیکاسیون خارج استخوانی پیشرونده", "یک نوبت PTH بالا در بیمار بدون علامت که هنوز درمان دارویی بهینه نشده است", "کلسیفیلاکسی"]'::jsonb,
     3, null, null, null, null, null,
     '["parathyroidectomy", "indications"]'::jsonb, 'medium', 2,
     $e2$اندیکاسیون‌های پاراتیروئیدکتومی شامل هیپرکلسمی و هیپرفسفاتمی پایدار و عودکننده با وجود درمان بهینه، بیماری استخوانی پیشرونده و ناتوان‌کننده، کلسیفیکاسیون خارج استخوانی پیشرونده و/یا کلسیفیلاکسی است. یک PTH بالای منفرد بدون بهینه‌سازی درمان اندیکاسیون نیست.$e2$),

    (v_owner_id, v_topic,
     $q3$برای پسر ۱۵ ساله دیالیزی با هیپرپاراتیروئیدی مقاوم و هیپرکلسمی پایدار، پاراتیروئیدکتومی مطرح شده است. پیش از جراحی، کدام اقدام توصیه می‌شود؟$q3$,
     'mcq',
     '["رد سایر علل هیپرکلسمی و بیماری استخوانی، و تصویربرداری پاراتیروئید با سونوگرافی یا مطالعات رادیونوکلئید برای شناسایی هیپرپلازی، هیپرتروفی یا آدنومی که پاسخ ضعیف به درمان دارویی را توجیه می‌کند", "انجام فوری جراحی بدون تصویربرداری", "شروع بیس‌فسفونات و انتظار ۶ ماهه", "DXA به عنوان تنها ارزیابی پیش از عمل", "بیوپسی پاراتیروئید از طریق پوست"]'::jsonb,
     0, null, null, null, null, null,
     '["preoperative evaluation", "parathyroid imaging"]'::jsonb, 'hard', 3,
     $e3$سایر علل هیپرکلسمی و بیماری استخوانی باید رد شوند. تصویربرداری پاراتیروئید با سونوگرافی یا مطالعات رادیونوکلئید برای شناسایی هیپرپلازی، هیپرتروفی یا آدنوم‌هایی که پاسخ ضعیف به درمان دارویی را ایجاد می‌کنند به کار می‌رود.$e3$),

    (v_owner_id, v_topic,
     $q4$جراح برای نوجوان ۱۴ ساله کاندید پاراتیروئیدکتومی، به جای پاراتیروئیدکتومی کامل، اتوترانسپلانت قطعات بافت پاراتیروئید را پیشنهاد می‌کند. هدف اصلی و محل معمول این کار کدام است؟$q4$,
     'mcq',
     '["افزایش PTH به بالاتر از حد طبیعی؛ عضله ساعد", "پیشگیری از عود؛ داخل مدیاستن", "پیشگیری از هیپوکلسمی شدید و مادام‌العمر؛ لایه زیرجلدی شکم", "کاهش هزینه جراحی؛ زیر کپسول کلیه", "پیشگیری از کلسیفیلاکسی؛ داخل استخوان"]'::jsonb,
     2, null, null, null, null, null,
     '["autotransplantation", "hypocalcemia"]'::jsonb, 'hard', 3,
     $e4$برای جلوگیری از خطر هیپوکلسمی شدید و مادام‌العمر، اتوترانسپلانت قطعات بافت پاراتیروئید در لایه زیرجلدی شکم می‌تواند جایگزین پاراتیروئیدکتومی کامل باشد. بافت پیوندی رشد می‌کند و PTH ترشح می‌کند.$e4$),

    (v_owner_id, v_topic,
     $q5$دختری ۳ سال پس از پاراتیروئیدکتومی همراه با اتوترانسپلانت زیرجلدی شکمی، دوباره PTH رو به افزایش دارد. کدام توضیح با رفتار بافت پیوندی سازگار است؟$q5$,
     'mcq',
     '["بافت اتوترانسپلانت پس از پیوند همیشه آتروفی می‌شود", "افزایش PTH حتماً ناشی از خطای آزمایشگاه است", "PTH فقط از غدد گردنی ترشح می‌شود", "بافت پاراتیروئید اتوترانسپلانت‌شده تمایل به رشد و ترشح PTH دارد؛ پس افزایش PTH می‌تواند از بافت پیوندی منشأ بگیرد", "اتوترانسپلانت باعث هیپوکلسمی مادام‌العمر می‌شود"]'::jsonb,
     3, null, null, null, null, null,
     '["autotransplant", "recurrence"]'::jsonb, 'hard', 3,
     $e5$بافت‌های پاراتیروئید اتوترانسپلانت‌شده تمایل به رشد و ترشح PTH دارند. همین ویژگی از هیپوکلسمی مادام‌العمر پیشگیری می‌کند، اما می‌تواند منشأ افزایش دوباره PTH هم باشد.$e5$),

    (v_owner_id, v_topic,
     $q6$با در دسترس قرار گرفتن کلسی‌میمتیک‌ها، کدام تغییر در هیپرپاراتیروئیدی مقاوم رخ داده است؟$q6$,
     'mcq',
     '["بروز هیپرپاراتیروئیدی مقاوم و نیاز به پاراتیروئیدکتومی کاهش یافته است", "نیاز به پاراتیروئیدکتومی افزایش یافته است", "پاراتیروئیدکتومی دیگر اندیکاسیون ندارد", "کلسی‌میمتیک‌ها جایگزین کامل جراحی شده‌اند", "تغییری رخ نداده است"]'::jsonb,
     0, null, null, null, null, null,
     '["calcimimetics era", "parathyroidectomy incidence"]'::jsonb, 'easy', 2,
     $e6$با در دسترس قرار گرفتن کلسی‌میمتیک‌ها، بروز هیپرپاراتیروئیدی مقاوم و نیاز به پاراتیروئیدکتومی کاهش یافته است. با این حال، در منع مصرف یا پاسخ ناکامل همچنان اندیکاسیون دارد.$e6$),

    (v_owner_id, v_topic,
     $q7$نوجوان ۱۵ ساله ۲ سال پس از پیوند کلیه، eGFR حدود 45 و BMD پایین دارد. همکاری شروع بیس‌فسفونات را پیشنهاد می‌کند. کدام مجموعه نگرانی با شواهد موجود سازگار است؟$q7$,
     'mcq',
     '["بیس‌فسفونات‌ها در کودکان CKD کارآزمایی‌شده و بی‌خطرند", "بیس‌فسفونات‌ها فقط از طریق کبد دفع می‌شوند و بر کلیه اثری ندارند", "بیس‌فسفونات‌ها turnover را افزایش می‌دهند و رشد را تسریع می‌کنند", "دفع کلیوی و خطر AKI نه‌همیشه برگشت‌پذیر؛ نبود مطالعه کارایی و ایمنی در کودکان CKD؛ و توان تشدید بیماری آدینامیک و اختلال رشد طولی با کاهش turnover. پیش از هر تصمیم، ارزیابی دقیق ساختار و تشکیل استخوان لازم است", "تنها نگرانی هزینه است"]'::jsonb,
     3, null, null, null, null, null,
     '["bisphosphonates", "post-transplant", "concerns"]'::jsonb, 'hard', 3,
     $e7$بیس‌فسفونات‌ها از طریق کلیه دفع می‌شوند و ممکن است AKI ایجاد کنند که همیشه کاملاً برگشت‌پذیر نیست. کارایی و ایمنی آن‌ها در کودکان CKD مطالعه نشده است. با کاهش turnover می‌توانند بیماری آدینامیک را تشدید و رشد طولی را مختل کنند.$e7$),

    (v_owner_id, v_topic,
     $q8$استفاده از بیس‌فسفونات در کودکان CKD عمدتاً در چه قالبی گزارش شده است؟$q8$,
     'mcq',
     '["کارآزمایی‌های تصادفی بزرگ", "گزارش‌های موردی، عمدتاً برای درمان هیپرکلسمی یا پس از پیوند کلیه", "مطالعات کوهورت چندمرکزی برای پیشگیری از شکستگی", "متاآنالیز کارآزمایی‌های کودکان دیالیزی", "هیچ گزارشی وجود ندارد"]'::jsonb,
     1, null, null, null, null, null,
     '["bisphosphonates", "pediatric evidence"]'::jsonb, 'medium', 2,
     $e8$کارایی و ایمنی بیس‌فسفونات‌ها در کودکان CKD مطالعه نشده و فقط گزارش‌های موردی، عمدتاً برای درمان هیپرکلسمی یا پس از پیوند کلیه، منتشر شده است.$e8$),

    (v_owner_id, v_topic,
     $q9$پسر ۱۱ ساله دیالیزی با PTH سرکوب‌شده، ALP پایین و سابقه شکستگی کاندید بیس‌فسفونات شده است. مهم‌ترین خطر استخوانی این درمان در این بیمار کدام است؟$q9$,
     'mcq',
     '["تشدید بیماری آدینامیک احتمالی زمینه‌ای و اختلال رشد طولی، به علت کاهش سرعت turnover استخوان", "ایجاد استئیت فیبروزا", "افزایش بیش از حد turnover", "افزایش ناگهانی رشد قدی", "رسوب آلومینیوم"]'::jsonb,
     0, null, null, null, null, null,
     '["bisphosphonates", "adynamic bone", "growth"]'::jsonb, 'hard', 3,
     $e9$بیس‌فسفونات‌ها با کاهش سرعت turnover استخوان می‌توانند بیماری آدینامیک موجود را تشدید و رشد طولی را مختل کنند. PTH سرکوب‌شده و ALP پایین به نفع turnover پایین است. پیش از درمان، ارزیابی دقیق ساختار و تشکیل استخوان لازم است.$e9$),

    (v_owner_id, v_topic,
     $q10$کدام عبارت مکانیسم اثر دنوزوماب را درست بیان می‌کند؟$q10$,
     'mcq',
     '["آنالوگ PTH است که تشکیل استخوان را تحریک می‌کند", "به هیدروکسی‌آپاتیت متصل می‌شود و از کلیه دفع می‌شود", "آنتی‌بادی مونوکلونال انسانی است که به RANKL متصل می‌شود و اثر آن را مهار می‌کند؛ RANKL توسط سلول‌های استئوبلاستی بیان می‌شود و جذب استئوکلاستی استخوان را واسطه‌گری می‌کند", "مدولاتور آلوستریک CaSR است", "مهارکننده اسکلروستین است"]'::jsonb,
     2, null, null, null, null, null,
     '["denosumab", "mechanism"]'::jsonb, 'medium', 2,
     $e10$دنوزوماب آنتی‌بادی مونوکلونال انسانی است که به RANKL متصل می‌شود و اثر آن را مهار می‌کند. RANKL توسط سلول‌های استئوبلاستی بیان می‌شود و واسطه جذب استئوکلاستی استخوان است. گزینه B مربوط به بیس‌فسفونات‌هاست.$e10$),

    (v_owner_id, v_topic,
     $q11$متخصص غدد پیشنهاد می‌کند برای دختر ۱۳ ساله دیالیزی با استئوپنی، به جای بیس‌فسفونات دنوزوماب تجویز شود، با این استدلال که دفع آن کلیوی نیست. کدام پاسخ دقیق‌تر است؟$q11$,
     'mcq',
     '["استدلال درست است و دنوزوماب در کودکان CKD ایمن و مؤثر شناخته شده است", "مطالعات اولیه نشان می‌دهد فارماکوکینتیک دنوزوماب تحت تأثیر عملکرد کلیه نیست، اما کارایی آن در کودکان CKD مطالعه نشده و خطر هیپوکلسمی علامت‌دار در کودکان ممکن است حتی از بزرگسالان مهم‌تر باشد", "دنوزوماب مانند بیس‌فسفونات‌ها از کلیه دفع می‌شود", "دنوزوماب باعث هیپرکلسمی می‌شود", "دنوزوماب BMD را کاهش می‌دهد"]'::jsonb,
     1, null, null, null, null, null,
     '["denosumab", "hypocalcemia", "children"]'::jsonb, 'hard', 3,
     $e11$مطالعات اولیه نشان می‌دهد فارماکوکینتیک دنوزوماب تحت تأثیر عملکرد کلیه نیست. با این حال، کارایی آن در کودکان CKD مطالعه نشده و خطر هیپوکلسمی علامت‌دار در کودکان ممکن است حتی از بزرگسالان مهم‌تر باشد.$e11$),

    (v_owner_id, v_topic,
     $q12$شواهد اثربخشی دنوزوماب در کدام جمعیت نشان داده شده است؟$q12$,
     'mcq',
     '["کودکان دیالیزی", "کودکان پس از پیوند کلیه", "نوجوانان با CKD پیش از دیالیز", "شیرخواران با ریکتز", "زنان مسن با تراکم استخوان پایین؛ افزایش BMD و پیشگیری از شکستگی"]'::jsonb,
     4, null, null, null, null, null,
     '["denosumab", "evidence"]'::jsonb, 'medium', 2,
     $e12$دنوزوماب در زنان مسن با تراکم استخوان پایین BMD را افزایش و شکستگی را کاهش داده است. اثربخشی آن در کودکان CKD مطالعه نشده است.$e12$),

    (v_owner_id, v_topic,
     $q13$پسر ۱۷ ساله با CKD مرحله ۴، قد کوتاه (Height SDS برابر ۲.۵-) دارد. اسیدوز، سوءتغذیه و اختلالات معدنی او اصلاح شده‌اند، اما رادیوگرافی مچ دست بسته شدن اپی‌فیزها را نشان می‌دهد. درباره درمان با هورمون رشد کدام عبارت صحیح است؟$q13$,
     'mcq',
     '["کاندید مناسب است، چون CKD مرحله ۴ و قد کوتاه دارد", "باید دوز دو برابر شروع شود", "هورمون رشد فقط در دیالیز اندیکاسیون دارد", "کاندید نیست؛ ESPN درمان را برای کودکانی توصیه می‌کند که پتانسیل رشد دارند و این بیمار با اپی‌فیزهای بسته پتانسیل رشد ندارد", "ابتدا باید بیس‌فسفونات شروع شود"]'::jsonb,
     3, null, null, null, null, null,
     '["growth hormone", "ESPN criteria", "growth potential"]'::jsonb, 'hard', 3,
     $e13$راهنمای ESPN کودکان CKD مراحل ۳ تا ۵ را کاندید هورمون رشد می‌داند، به شرطی که پس از رسیدگی کافی به سایر عوامل خطر قابل‌درمان، همچنان اختلال رشد داشته باشند و پتانسیل رشد داشته باشند.$e13$),

    (v_owner_id, v_topic,
     $q14$دختر ۸ ساله با CKD مرحله ۳ اختلال رشد پایدار، اسیدوز متابولیک اصلاح‌نشده (بیکربنات 16) و سوءتغذیه دارد. والدین درخواست شروع فوری هورمون رشد دارند. بر اساس راهنمای ESPN، اقدام مناسب کدام است؟$q14$,
     'mcq',
     '["ابتدا رسیدگی کافی به عوامل خطر قابل‌درمان، مانند اصلاح اسیدوز و سوءتغذیه؛ در صورت تداوم اختلال رشد با وجود پتانسیل رشد، هورمون رشد مطرح می‌شود", "شروع فوری هورمون رشد بدون اصلاح اسیدوز", "هورمون رشد در CKD مرحله ۳ اندیکاسیون ندارد", "انتظار تا شروع دیالیز", "شروع کلسیتریول با دوز بالا به جای هورمون رشد"]'::jsonb,
     0, null, null, null, null, null,
     '["growth hormone", "treatable risk factors"]'::jsonb, 'medium', 3,
     $e14$ESPN کودکان CKD مراحل ۳ تا ۵ را کاندید هورمون رشد می‌داند، اگر اختلال رشد پایدار پس از رسیدگی کافی به سایر عوامل خطر قابل‌درمان باقی بماند و پتانسیل رشد داشته باشند.$e14$),

    (v_owner_id, v_topic,
     $q15$کدام عبارت درباره برداشت فسفر با نسخه‌های استاندارد دیالیز صحیح است؟$q15$,
     'mcq',
     '["دیالیز صفاقی روزانه حدود ۸۰۰ میلی‌گرم و همودیالیز هر جلسه حدود ۳۰۰ میلی‌گرم برداشت می‌کند", "هر دو روش فسفر کافی برداشت می‌کنند و نیازی به binder نیست", "همودیالیز استاندارد هر جلسه بیش از ۲۰۰۰ میلی‌گرم برداشت می‌کند", "دیالیز صفاقی فسفر برداشت نمی‌کند", "برداشت ناکافی است: دیالیز صفاقی روزانه ۳۰۰ تا ۴۰۰ میلی‌گرم و همودیالیز استاندارد هر جلسه حدود ۸۰۰ میلی‌گرم"]'::jsonb,
     4, null, null, null, null, null,
     '["dialysis", "phosphate removal"]'::jsonb, 'medium', 2,
     $e15$نسخه‌های استاندارد PD و HD فسفر ناکافی برداشت می‌کنند: PD روزانه ۳۰۰ تا ۴۰۰ میلی‌گرم و HD استاندارد هر جلسه ۸۰۰ میلی‌گرم.$e15$),

    (v_owner_id, v_topic,
     $q16$نوجوانی تحت همودیالیز استاندارد ۳ بار در هفته، روزانه حدود ۱۲۰۰ میلی‌گرم فسفر دریافت می‌کند که حدود ۶۵٪ آن جذب می‌شود. برداشت هفتگی فسفر با دیالیز در مقایسه با جذب هفتگی تقریباً چگونه است؟$q16$,
     'mcq',
     '["برداشت حدود ۲۴۰۰ میلی‌گرم در برابر جذب حدود ۵۵۰۰ میلی‌گرم در هفته؛ تعادل مثبت قابل‌توجه که نیاز به محدودیت رژیمی و P-binder را توجیه می‌کند", "برداشت حدود ۸۰۰۰ میلی‌گرم در برابر جذب حدود ۵۵۰۰ میلی‌گرم؛ تعادل منفی", "برداشت و جذب تقریباً برابرند", "برداشت حدود ۸۰۰ میلی‌گرم در برابر جذب ۸۴۰۰ میلی‌گرم", "برداشت حدود ۲۴۰۰ میلی‌گرم در برابر جذب ۱۲۰۰ میلی‌گرم"]'::jsonb,
     0, null, null, null, null, null,
     '["phosphate balance", "calculation"]'::jsonb, 'hard', 3,
     $e16$HD استاندارد هر جلسه حدود ۸۰۰ میلی‌گرم برداشت می‌کند (۳ × ۸۰۰ = ۲۴۰۰ میلی‌گرم در هفته). جذب روزانه حدود ۱۲۰۰ × ۰.۶۵ ≈ ۷۸۰ میلی‌گرم و هفتگی حدود ۵۵۰۰ میلی‌گرم است. این تعادل مثبت نشان می‌دهد چرا دیالیز استاندارد به‌تنهایی کافی نیست.$e16$),

    (v_owner_id, v_topic,
     $q17$پسر ۱۴ ساله از همودیالیز استاندارد به همودیالیز روزانه، آهسته و مداوم منتقل شده است. P-binderها قطع شده‌اند و اکنون فسفر سرم 2.4 mg/dL است. کدام اقدام با تجربه موجود سازگار است؟$q17$,
     'mcq',
     '["شروع مجدد P-binder با دوز بالا", "افزودن فسفر به محلول دیالیز برای پیشگیری از پیامدهای طولانی‌مدت هیپوفسفاتمی", "شروع سیناکلست", "کاهش کلسیم محلول دیالیز به زیر ۱.۲۵ mmol/L", "هیپوفسفاتمی در این روش رخ نمی‌دهد و باید آزمایش تکرار شود"]'::jsonb,
     1, null, null, null, null, null,
     '["daily slow continuous HD", "hypophosphatemia"]'::jsonb, 'hard', 3,
     $e17$همودیالیز روزانه، آهسته و مداوم برداشت فسفر عالی دارد و اغلب امکان قطع P-binder را می‌دهد. برخی بیماران دچار هیپوفسفاتمی شده‌اند و برای جلوگیری از پیامدهای طولانی‌مدت آن، افزودن فسفر به محلول دیالیز لازم شده است.$e17$),

    (v_owner_id, v_topic,
     $q18$کدام مقایسه درباره اثر دیالیز مکرر بر فسفر سرم صحیح است؟$q18$,
     'mcq',
     '["در FHN Daily Trial، دیالیز ۶ بار در هفته فسفر را ۰.۴۵ mmol/L و دیالیز شبانه مکرر ۰.۱۸ mmol/L کاهش داد", "هیچ‌کدام فسفر را کاهش ندادند", "در FHN Daily Trial، دیالیز ۶ بار در هفته فسفر را ۰.۱۸ mmol/L نسبت به ۳ بار در هفته کاهش داد، در حالی که همودیالیز شبانه مکرر فسفر را ۰.۴۵ mmol/L نسبت به همودیالیز معمول کاهش داد", "هر دو روش فسفر را به یک اندازه کاهش دادند", "دیالیز مکرر فسفر را افزایش داد"]'::jsonb,
     2, null, null, null, null, null,
     '["FHN Daily Trial", "nocturnal HD"]'::jsonb, 'hard', 2,
     $e18$در FHN Daily Trial، دیالیز ۶ بار در هفته فسفر سرم را ۰.۱۸ mmol/L نسبت به دیالیز ۳ بار در هفته کاهش داد. همودیالیز شبانه مکرر فسفر را ۰.۴۵ mmol/L نسبت به همودیالیز معمول کاهش داد.$e18$),

    (v_owner_id, v_topic,
     $q19$دختر ۱۲ ساله به برنامه همودیالیز شبانه طولانی منتقل می‌شود. درباره غلظت کلسیم محلول دیالیز کدام عبارت صحیح است؟$q19$,
     'mcq',
     '["کلسیم محلول دیالیز باید به حداقل کاهش یابد", "کلسیم محلول دیالیز اهمیتی ندارد", "در کودکان تحت HD شبانه، محلول بدون کلسیم توصیه می‌شود", "غلظت کلسیم محلول باید همان غلظت HD معمول باشد", "کودکان تحت HD روزانه طولانی یا شبانه به کلسیم بالاتر محلول دیالیز (۱.۵ تا ۱.۷۵ mmol/L) نیاز دارند"]'::jsonb,
     4, null, null, null, null, null,
     '["nocturnal HD", "dialysate calcium"]'::jsonb, 'hard', 3,
     $e19$کودکان تحت HD روزانه طولانی یا شبانه به سطوح بالاتر کلسیم محلول دیالیز (۱.۵ تا ۱.۷۵ mmol/L) نیاز دارند.$e19$),

    (v_owner_id, v_topic,
     $q20$نوجوانی با هیپرفسفاتمی مقاوم تحت HD استاندارد که P-binder با دوز بالا مصرف می‌کند، به HD شبانه مکرر منتقل می‌شود. کدام برنامه پیگیری منطقی‌تر است؟$q20$,
     'mcq',
     '["ادامه همان دوز binder و همان کلسیم محلول دیالیز", "افزایش دوز binder برای پیشگیری از عود هیپرفسفاتمی", "پایش نزدیک فسفر با امکان کاهش یا قطع binder، توجه به احتمال هیپوفسفاتمی و نیاز به افزودن فسفر به محلول، و استفاده از کلسیم بالاتر در محلول دیالیز", "شروع بیس‌فسفونات", "پاراتیروئیدکتومی پیش از شروع HD شبانه"]'::jsonb,
     2, null, null, null, null, null,
     '["integrated", "nocturnal HD transition"]'::jsonb, 'hard', 3,
     $e20$دیالیز مکرر یا شبانه برداشت فسفر عالی دارد و اغلب امکان قطع P-binder را می‌دهد. برخی بیماران به افزودن فسفر به محلول نیاز پیدا می‌کنند و کودکان تحت HD شبانه به کلسیم بالاتر محلول (۱.۵ تا ۱.۷۵ mmol/L) نیاز دارند.$e20$),

    (v_owner_id, v_topic,
     $q21$کاهش ۰.۴۵ mmol/L فسفر سرم با همودیالیز شبانه مکرر تقریباً معادل چند mg/dL است؟$q21$,
     'mcq',
     '["حدود ۰.۱۵ mg/dL", "حدود ۰.۵۶ mg/dL", "حدود ۴.۵ mg/dL", "حدود ۱.۴ mg/dL", "حدود ۳.۱ mg/dL"]'::jsonb,
     3, null, null, null, null, null,
     '["unit conversion", "phosphate"]'::jsonb, 'medium', 3,
     $e21$هر ۱ mmol/L فسفر تقریباً برابر ۳.۱ mg/dL است (۰.۴۵ × ۳.۱ ≈ ۱.۴ mg/dL). کاهش ۰.۱۸ mmol/L در FHN Daily حدود ۰.۵۶ mg/dL است.$e21$),

    (v_owner_id, v_topic,
     $q22$اندیکاسیون‌های پاراتیروئیدکتومی شامل هیپرکلسمی و هیپرفسفاتمی پایدار و عودکننده، بیماری استخوانی پیشرونده و ناتوان‌کننده، کلسیفیکاسیون ____ پیشرونده و/یا ____ است.$q22$,
     'fill_blank', '[]'::jsonb, null,
     '["خارج استخوانی", "کلسیفیلاکسی"]'::jsonb, null, null, null, null,
     '["parathyroidectomy", "indications"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q23$تصویربرداری پاراتیروئید با ____ یا مطالعات ____ برای شناسایی هیپرپلازی، هیپرتروفی یا آدنوم انجام می‌شود.$q23$,
     'fill_blank', '[]'::jsonb, null,
     '["سونوگرافی", "رادیونوکلئید"]'::jsonb, null, null, null, null,
     '["parathyroid imaging"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q24$اتوترانسپلانت قطعات بافت پاراتیروئید در لایه ____ شکم انجام می‌شود تا از هیپوکلسمی شدید و ____ جلوگیری شود.$q24$,
     'fill_blank', '[]'::jsonb, null,
     '["زیرجلدی", "مادام‌العمر"]'::jsonb, null, null, null, null,
     '["autotransplantation"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q25$بیس‌فسفونات‌ها از طریق ____ دفع می‌شوند و ممکن است AKI ایجاد کنند که همیشه کاملاً ____ نیست.$q25$,
     'fill_blank', '[]'::jsonb, null,
     '["کلیه", "برگشت‌پذیر"]'::jsonb, null, null, null, null,
     '["bisphosphonates"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q26$بیس‌فسفونات‌ها با کاهش turnover می‌توانند بیماری استخوان ____ را تشدید و رشد ____ را مختل کنند.$q26$,
     'fill_blank', '[]'::jsonb, null,
     '["آدینامیک", "طولی"]'::jsonb, null, null, null, null,
     '["bisphosphonates", "risks"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q27$دنوزوماب آنتی‌بادی مونوکلونال انسانی علیه ____ است که توسط سلول‌های ____ بیان می‌شود.$q27$,
     'fill_blank', '[]'::jsonb, null,
     '["RANKL", "استئوبلاستی"]'::jsonb, null, null, null, null,
     '["denosumab"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q28$فارماکوکینتیک دنوزوماب تحت تأثیر عملکرد ____ نیست، اما خطر ____ علامت‌دار در کودکان ممکن است بیشتر از بزرگسالان باشد.$q28$,
     'fill_blank', '[]'::jsonb, null,
     '["کلیه", "هیپوکلسمی"]'::jsonb, null, null, null, null,
     '["denosumab", "hypocalcemia"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q29$ESPN کودکان CKD مراحل ____ تا ____ را با اختلال رشد پایدار، پس از رسیدگی به سایر عوامل قابل‌درمان و به شرط داشتن ____ رشد، کاندید هورمون رشد می‌داند.$q29$,
     'fill_blank', '[]'::jsonb, null,
     '["۳", "۵", "پتانسیل"]'::jsonb, null, null, null, null,
     '["growth hormone"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q30$دیالیز صفاقی روزانه ____ تا ____ میلی‌گرم و همودیالیز استاندارد هر جلسه حدود ____ میلی‌گرم فسفر برداشت می‌کند.$q30$,
     'fill_blank', '[]'::jsonb, null,
     '["۳۰۰", "۴۰۰", "۸۰۰"]'::jsonb, null, null, null, null,
     '["phosphate removal"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q31$در FHN Daily Trial، دیالیز ____ بار در هفته فسفر سرم را ____ mmol/L نسبت به دیالیز ۳ بار در هفته کاهش داد.$q31$,
     'fill_blank', '[]'::jsonb, null,
     '["۶", "۰.۱۸"]'::jsonb, null, null, null, null,
     '["FHN"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q32$همودیالیز شبانه مکرر فسفر سرم را ____ mmol/L نسبت به همودیالیز معمول کاهش داد.$q32$,
     'fill_blank', '[]'::jsonb, null,
     '["۰.۴۵"]'::jsonb, null, null, null, null,
     '["nocturnal HD"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q33$کودکان تحت HD روزانه طولانی یا شبانه به کلسیم محلول دیالیز ____ تا ____ mmol/L نیاز دارند.$q33$,
     'fill_blank', '[]'::jsonb, null,
     '["۱.۵", "۱.۷۵"]'::jsonb, null, null, null, null,
     '["dialysate calcium"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q34$هر درمان را به نکته کلیدی یا نگرانی اصلی آن وصل کنید.$q34$,
     'matching', '[]'::jsonb, null, null,
     '[{"key": "1", "text": "پاراتیروئیدکتومی کامل"}, {"key": "2", "text": "اتوترانسپلانت پاراتیروئید"}, {"key": "3", "text": "بیس‌فسفونات‌ها"}, {"key": "4", "text": "دنوزوماب"}, {"key": "5", "text": "هورمون رشد"}, {"key": "6", "text": "همودیالیز روزانه آهسته و مداوم"}]'::jsonb,
     '[{"key": "A", "text": "دفع کلیوی، AKI، تشدید آدینامیک و اختلال رشد"}, {"key": "B", "text": "خطر هیپوکلسمی شدید و مادام‌العمر"}, {"key": "C", "text": "نیاز به پتانسیل رشد و رسیدگی قبلی به عوامل قابل‌درمان"}, {"key": "D", "text": "احتمال هیپوفسفاتمی و نیاز به افزودن فسفر به محلول"}, {"key": "E", "text": "بافت پیوندی رشد می‌کند و PTH ترشح می‌کند"}, {"key": "F", "text": "مهار RANKL؛ خطر هیپوکلسمی علامت‌دار در کودکان"}]'::jsonb,
     '[{"left": "1", "right": "B"}, {"left": "2", "right": "E"}, {"left": "3", "right": "A"}, {"left": "4", "right": "F"}, {"left": "5", "right": "C"}, {"left": "6", "right": "D"}]'::jsonb,
     false,
     '["therapies", "key concerns"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q35$در بیمار با منع مصرف یا پاسخ ناکامل به کلسی‌میمتیک، هر وضعیت را مشخص کنید: اندیکاسیون پاراتیروئیدکتومی یا نه.$q35$,
     'matching', '[]'::jsonb, null, null,
     '[{"key": "1", "text": "کلسیفیلاکسی"}, {"key": "2", "text": "کلسیفیکاسیون خارج استخوانی پیشرونده"}, {"key": "3", "text": "PTH بالای منفرد در بیمار بدون علامت پیش از بهینه‌سازی درمان"}, {"key": "4", "text": "بیماری استخوانی پیشرونده و ناتوان‌کننده"}, {"key": "5", "text": "هیپرکلسمی ناشی از علت دیگری که هنوز رد نشده است"}, {"key": "6", "text": "هیپرکلسمی و هیپرفسفاتمی پایدار با وجود درمان دارویی بهینه"}]'::jsonb,
     '[{"key": "X", "text": "اندیکاسیون پاراتیروئیدکتومی"}, {"key": "Y", "text": "اندیکاسیون نیست یا ابتدا باید ارزیابی یا درمان تکمیل شود"}]'::jsonb,
     '[{"left": "1", "right": "X"}, {"left": "2", "right": "X"}, {"left": "3", "right": "Y"}, {"left": "4", "right": "X"}, {"left": "5", "right": "Y"}, {"left": "6", "right": "X"}]'::jsonb,
     true,
     '["parathyroidectomy", "indication assessment"]'::jsonb, 'hard', 3, null),

    (v_owner_id, v_topic,
     $q36$هر روش یا مطالعه دیالیز را به عدد مربوط وصل کنید.$q36$,
     'matching', '[]'::jsonb, null, null,
     '[{"key": "1", "text": "برداشت روزانه فسفر با دیالیز صفاقی استاندارد"}, {"key": "2", "text": "برداشت فسفر در هر جلسه همودیالیز استاندارد"}, {"key": "3", "text": "کاهش فسفر با دیالیز ۶ بار در هفته (FHN)"}, {"key": "4", "text": "کاهش فسفر با همودیالیز شبانه مکرر"}, {"key": "5", "text": "کلسیم محلول در HD شبانه یا روزانه طولانی کودکان"}]'::jsonb,
     '[{"key": "A", "text": "۰.۴۵ mmol/L"}, {"key": "B", "text": "۸۰۰ میلی‌گرم"}, {"key": "C", "text": "۱.۵ تا ۱.۷۵ mmol/L"}, {"key": "D", "text": "۳۰۰ تا ۴۰۰ میلی‌گرم"}, {"key": "E", "text": "۰.۱۸ mmol/L"}]'::jsonb,
     '[{"left": "1", "right": "D"}, {"left": "2", "right": "B"}, {"left": "3", "right": "E"}, {"left": "4", "right": "A"}, {"left": "5", "right": "C"}]'::jsonb,
     false,
     '["dialysis", "numbers"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q37$هر ویژگی را به داروی مربوط وصل کنید.$q37$,
     'matching', '[]'::jsonb, null, null,
     '[{"key": "1", "text": "دفع کلیوی"}, {"key": "2", "text": "آنتی‌بادی مونوکلونال انسانی"}, {"key": "3", "text": "فارماکوکینتیک مستقل از عملکرد کلیه"}, {"key": "4", "text": "گزارش‌های موردی در هیپرکلسمی و پس از پیوند کودکان"}, {"key": "5", "text": "افزایش BMD و پیشگیری از شکستگی در زنان مسن"}, {"key": "6", "text": "خطر AKI نه‌همیشه برگشت‌پذیر"}]'::jsonb,
     '[{"key": "X", "text": "بیس‌فسفونات‌ها"}, {"key": "Y", "text": "دنوزوماب"}]'::jsonb,
     '[{"left": "1", "right": "X"}, {"left": "2", "right": "Y"}, {"left": "3", "right": "Y"}, {"left": "4", "right": "X"}, {"left": "5", "right": "Y"}, {"left": "6", "right": "X"}]'::jsonb,
     true,
     '["bisphosphonates vs denosumab"]'::jsonb, 'medium', 2, null);
end $$;
