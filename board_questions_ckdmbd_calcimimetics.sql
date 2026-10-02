-- Nephron Board Questions — CKD-MBD Calcimimetic Agents
-- question set (22 MCQ, 12 fill-in-the-blank, 4 matching). Covers
-- cinacalcet mechanism (CaSR allosteric modulation) and expected lab
-- changes, the ESPN consensus criteria for starting cinacalcet in children
-- (age >3y, dialysis, severe persistent HPT, calcium threshold, optimized
-- conventional therapy), contraindications/cautions (QT prolongation,
-- seizure history, arrhythmia, liver disease, drug interactions),
-- hypocalcemia management and dose titration, the EVOLVE trial (design and
-- results), the 23-RCT meta-analysis (surrogate vs. hard outcomes), the
-- pediatric cinacalcet trial evidence base, and etelcalcetide (mechanism,
-- IV administration after hemodialysis, adherence advantage, pediatric
-- data still pending).
--
-- Part 1 repeats the same schema-upgrade statements from the earlier
-- question sets (harmless no-ops if already applied) so this file also
-- works standalone.
--
-- Part 2 inserts the 38 questions under topic "CKD / CKD-MBD / Calcimimetic Agents" for your
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

-- ---------- Part 2: CKD-MBD Calcimimetic Agents question set ----------
do $$
declare
  v_owner_id uuid;
  v_topic text := 'CKD / CKD-MBD / Calcimimetic Agents';
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
     $q1$کدام عبارت مکانیسم اثر سیناکلست را درست بیان می‌کند؟$q1$,
     'mcq',
     '["آنتاگونیست رقابتی گیرنده PTH در استخوان است", "با فعال کردن گیرنده ویتامین D، ترشح PTH را مهار می‌کند", "به عنوان مدولاتور آلوستریک گیرنده حس‌گر کلسیم (CaSR)، حساسیت آن را به کلسیم خارج سلولی افزایش می‌دهد و PTH، Ca و P سرم را کاهش می‌دهد", "با اتصال به فسفر روده جذب فسفر را کاهش می‌دهد", "پپتید سنتتیکی است که داخل وریدی پس از همودیالیز تجویز می‌شود"]'::jsonb,
     2, null, null, null, null, null,
     '["cinacalcet", "mechanism"]'::jsonb, 'medium', 2,
     $e1$سیناکلست مدولاتور آلوستریک CaSR است که در چند بافت از جمله پاراتیروئید بیان می‌شود. این دارو حساسیت CaSR را به کلسیم خارج سلولی افزایش می‌دهد و با کاهش PTH، Ca و P، هیپرپاراتیروئیدی ثانویه را بهتر کنترل می‌کند. گزینه E توصیف etelcalcetide است.$e1$),

    (v_owner_id, v_topic,
     $q2$پس از شروع سیناکلست در نوجوان ۱۵ ساله همودیالیزی، کدام الگوی تغییرات آزمایشگاهی انتظار می‌رود؟$q2$,
     'mcq',
     '["کاهش PTH، کاهش Ca و کاهش P", "کاهش PTH، افزایش Ca و افزایش P", "افزایش PTH و کاهش Ca", "کاهش PTH بدون تغییر Ca و P", "افزایش Ca و کاهش P بدون تغییر PTH"]'::jsonb,
     0, null, null, null, null, null,
     '["cinacalcet", "expected lab changes"]'::jsonb, 'medium', 3,
     $e2$سیناکلست با افزایش حساسیت CaSR غلظت PTH، Ca و P سرم را کاهش می‌دهد. برخلاف ویتامین D فعال که Ca و P را بالا می‌برد، سیناکلست می‌تواند هیپوکلسمی ایجاد کند.$e2$),

    (v_owner_id, v_topic,
     $q3$پسر ۱۲ ساله همودیالیزی با وجود بهینه‌سازی درمان معمول، شامل P-binder، کنترل رژیم و استرول ویتامین D، هیپرپاراتیروئیدی شدید و پایدار دارد. کلسیم اصلاح‌شده با آلبومین 2.55 mmol/L و QTc طبیعی است و سابقه تشنج یا آریتمی ندارد. بر اساس اجماع ESPN، کدام اقدام مناسب است؟$q3$,
     'mcq',
     '["افزایش دوز کلسیتریول", "پاراتیروئیدکتومی فوری بدون درمان دارویی بیشتر", "افزودن کربنات کلسیم", "شروع سیناکلست با کمترین دوز مؤثر و تیتراسیون بر اساس Ca و PTH همراه با پایش منظم", "شروع etelcalcetide به عنوان درمان استاندارد کودکان"]'::jsonb,
     3, null, null, null, null, null,
     '["ESPN consensus", "eligibility"]'::jsonb, 'hard', 3,
     $e3$اجماع ESPN استفاده از سیناکلست را در کودکان دیالیزی بالای ۳ سال با هیپرپاراتیروئیدی شدید و پایدار، کلسیم بالا یا بالای طبیعی و وجود درمان معمول بهینه‌شده (شامل استرول‌های ویتامین D) توصیه می‌کند. دوز باید بر اساس Ca و PTH با کمترین دوز مؤثر تیتره شود. مطالعات etelcalcetide در کودکان در جریان است.$e3$),

    (v_owner_id, v_topic,
     $q4$شیرخوار ۲ ساله تحت دیالیز صفاقی هیپرپاراتیروئیدی شدید با کلسیم بالای طبیعی دارد. درباره شروع سیناکلست بر اساس اجماع ESPN، کدام عبارت صحیح است؟$q4$,
     'mcq',
     '["توصیه ESPN برای کودکان دیالیزی بالای ۳ سال است؛ این بیمار خارج از گروه سنی توصیه‌شده قرار دارد", "سیناکلست در همه سنین بدون محدودیت توصیه می‌شود", "سیناکلست فقط برای کودکان زیر ۳ سال توصیه می‌شود", "سن در تصمیم‌گیری مطرح نیست", "در شیرخواران دوز بالاتر لازم است"]'::jsonb,
     0, null, null, null, null, null,
     '["age limit", "ESPN"]'::jsonb, 'medium', 3,
     $e4$اجماع ESPN استفاده از سیناکلست را در کودکان دیالیزی بالای ۳ سال با هیپرپاراتیروئیدی شدید و پایدار و کلسیم بالا یا بالای طبیعی، با وجود درمان معمول بهینه، توصیه می‌کند.$e4$),

    (v_owner_id, v_topic,
     $q5$دختر ۱۴ ساله همودیالیزی با هیپرپاراتیروئیدی شدید و پایدار، کلسیم اصلاح‌شده با آلبومین 9.2 mg/dL دارد. درباره شروع سیناکلست کدام عبارت صحیح است؟$q5$,
     'mcq',
     '["این مقدار حدود ۲.۵۵ mmol/L است و شروع بلامانع است", "کلسیم در تصمیم شروع سیناکلست اهمیتی ندارد", "باید دوز بالا شروع شود تا PTH سریع کاهش یابد", "سیناکلست کلسیم را افزایش می‌دهد و این بیمار از آن سود می‌برد", "این مقدار حدود ۲.۳ mmol/L و کمتر از ۲.۴۰ mmol/L است؛ به علت خطر هیپوکلسمی، آریتمی‌های بالقوه کشنده و تشنج، سیناکلست نباید شروع شود"]'::jsonb,
     4, null, null, null, null, null,
     '["calcium threshold", "contraindication", "unit conversion"]'::jsonb, 'hard', 3,
     $e5$۹.۲ ÷ ۴ ≈ ۲.۳ mmol/L. چون سیناکلست می‌تواند هیپوکلسمی ایجاد کند که به آریتمی‌های بالقوه کشنده یا تشنج می‌انجامد، نباید در بیماران با کلسیم اصلاح‌شده با آلبومین کمتر از ۲.۴۰ mmol/L شروع شود.$e5$),

    (v_owner_id, v_topic,
     $q6$نوجوان ۱۶ ساله دیالیزی با هیپرپاراتیروئیدی شدید و کلسیم بالای طبیعی، کاندید سیناکلست است. در ECG پایه، QTc طولانی دیده می‌شود. اقدام صحیح کدام است؟$q6$,
     'mcq',
     '["شروع سیناکلست با دوز معمول", "سیناکلست نباید در بیماران با QT طولانی شروع شود؛ یک عارضه کشنده در دختر نوجوانی با QT طولانی تحت درمان سیناکلست گزارش شده است", "شروع سیناکلست با دوز دو برابر برای کوتاه‌کردن دوره درمان", "QT طولانی فقط در صورت سابقه تشنج اهمیت دارد", "سیناکلست QT را کوتاه می‌کند و انتخاب مناسبی است"]'::jsonb,
     1, null, null, null, null, null,
     '["QT prolongation", "fatal event"]'::jsonb, 'hard', 3,
     $e6$یک عارضه کشنده در دختر نوجوانی با QT طولانی تحت درمان سیناکلست گزارش شده است. بنابراین سیناکلست نباید در بیماران با فاصله QT طولانی شروع شود.$e6$),

    (v_owner_id, v_topic,
     $q7$سیناکلست در کدام وضعیت زیر جزو مواردی نیست که در متن برای مصرف آن احتیاط ذکر شده است؟$q7$,
     'mcq',
     '["سابقه تشنج", "سابقه آریتمی قلبی", "بیماری کبدی قابل‌توجه", "مصرف داروهایی که QTc را افزایش می‌دهند یا با متابولیسم سیناکلست تداخل دارند", "هیپرفسفاتمی"]'::jsonb,
     4, null, null, null, null, null,
     '["cautions"]'::jsonb, 'medium', 2,
     $e7$سیناکلست باید با احتیاط در بیماران با سابقه تشنج، آریتمی قلبی، بیماری کبدی قابل‌توجه و مصرف داروهایی که QTc را افزایش می‌دهند یا با متابولیسم آن تداخل دارند استفاده شود. سیناکلست خود فسفر را کاهش می‌دهد.$e7$),

    (v_owner_id, v_topic,
     $q8$پسر ۱۳ ساله همودیالیزی ۳ هفته پس از شروع سیناکلست، کلسیم یونیزه پایین و پارستزی دور دهان دارد. PTH کاهش یافته است. کدام اقدام با توصیه‌های موجود سازگارتر است؟$q8$,
     'mcq',
     '["افزایش دوز سیناکلست برای کاهش بیشتر PTH", "ادامه بدون تغییر، چون هیپوکلسمی با سیناکلست بی‌اهمیت است", "شروع etelcalcetide به جای آن", "قطع دیالیز", "بازبینی دوز سیناکلست به کمترین دوز مؤثر و تنظیم درمان معمول (دریافت کلسیم تغذیه‌ای، P-binder کلسیمی، آنالوگ ویتامین D و کلسیم محلول دیالیز) برای رسیدن به Ca طبیعی، همراه با پایش منظم Ca یونیزه"]'::jsonb,
     4, null, null, null, null, null,
     '["hypocalcemia management", "conventional therapy adjustment"]'::jsonb, 'hard', 3,
     $e8$پایش منظم Ca (یونیزه در صورت امکان) و PTH ضروری است. درمان معمول، شامل دریافت کلسیم تغذیه‌ای، P-binderهای کلسیمی، آنالوگ‌های ویتامین D و کلسیم محلول دیالیز، ممکن است برای رسیدن به Ca، P و PTH طبیعی نیاز به تنظیم داشته باشد. دوز سیناکلست باید کمترین دوز مؤثر باشد.$e8$),

    (v_owner_id, v_topic,
     $q9$کدام اصل در تیتراسیون دوز سیناکلست در کودکان صحیح است؟$q9$,
     'mcq',
     '["دوز باید فقط بر اساس وزن و بدون پایش تعیین شود", "دوز باید تا سرکوب کامل PTH افزایش یابد", "دوز باید بر اساس Ca و PTH سرم با دقت تیتره شود و از کمترین دوز مؤثر برای حفظ PTH در محدوده هدف استفاده شود", "دوز ثابت بالا بدون توجه به Ca", "دوز فقط بر اساس فسفر تنظیم شود"]'::jsonb,
     2, null, null, null, null, null,
     '["dose titration"]'::jsonb, 'medium', 2,
     $e9$سیناکلست باید بر اساس Ca و PTH سرم با دقت تیتره شود و از کمترین دوز مؤثر برای حفظ PTH در محدوده هدف استفاده شود.$e9$),

    (v_owner_id, v_topic,
     $q10$دختر ۱۰ ساله دیالیزی PTH بسیار بالا، کلسیم پایین تا پایین طبیعی، 25D طبیعی و فسفر کنترل‌شده دارد و هنوز ویتامین D فعال دریافت نکرده است. کدام اقدام منطقی‌تر است؟$q10$,
     'mcq',
     '["شروع فوری سیناکلست", "شروع استرول فعال ویتامین D به عنوان بخشی از درمان معمول؛ سیناکلست طبق ESPN برای هیپرپاراتیروئیدی با کلسیم بالا یا بالای طبیعی و پس از بهینه‌سازی درمان معمول است و در کلسیم پایین خطر هیپوکلسمی دارد", "شروع هم‌زمان سیناکلست و etelcalcetide", "پاراتیروئیدکتومی فوری", "هیچ درمانی لازم نیست"]'::jsonb,
     1, null, null, null, null, null,
     '["low calcium", "not a candidate", "reasoning"]'::jsonb, 'hard', 3,
     $e10$ESPN سیناکلست را برای کودکان دیالیزی با هیپرپاراتیروئیدی شدید و پایدار، با کلسیم بالا یا بالای طبیعی و با وجود درمان معمول بهینه‌شده (شامل استرول‌های ویتامین D) توصیه می‌کند. سیناکلست کلسیم را کاهش می‌دهد و نباید در کلسیم اصلاح‌شده کمتر از ۲.۴۰ mmol/L شروع شود.$e10$),

    (v_owner_id, v_topic,
     $q11$کدام عبارت طراحی کارآزمایی EVOLVE را درست توصیف می‌کند؟$q11$,
     'mcq',
     '["کارآزمایی در کودکان دیالیزی با PTH بیش از ۳۰۰ pg/mL", "بزرگ‌ترین RCT کلسی‌میمتیک‌ها شامل ۳۸۸۳ بیمار بزرگسال همودیالیزی با PTH پایه ۳۰۰ pg/mL (۳۱.۸ pmol/L) یا بیشتر و کلسیم ۸.۴ mg/dL (۲.۱ mmol/L) یا بیشتر", "کارآزمایی در بیماران CKD پیش از دیالیز با PTH طبیعی", "متاآنالیز ۲۳ کارآزمایی در بیماران دیالیزی", "کارآزمایی etelcalcetide در برابر سیناکلست"]'::jsonb,
     1, null, null, null, null, null,
     '["EVOLVE", "design"]'::jsonb, 'hard', 2,
     $e11$EVOLVE بزرگ‌ترین RCT ارزیابی کلسی‌میمتیک‌ها بود و ۳۸۸۳ بیمار بزرگسال همودیالیزی با PTH پایه ۳۰۰ pg/mL (۳۱.۸ pmol/L) یا بیشتر و کلسیم ۸.۴ mg/dL (۲.۱ mmol/L) یا بیشتر را شامل می‌شد.$e11$),

    (v_owner_id, v_topic,
     $q12$بر اساس آنچه در متن گزارش شده، کدام عبارت نتایج EVOLVE را درست بیان می‌کند؟$q12$,
     'mcq',
     '["بیماران دریافت‌کننده سیناکلست کمتر به پیامد اولیه ترکیبی (مرگ، انفارکتوس قلبی یا بستری قلبی‌عروقی) رسیدند (HR برابر ۰.۸۸، با فاصله اطمینان ۰.۷۹ تا ۰.۹۷)؛ تحلیل‌های ثانویه فایده در حوادث قلبی‌عروقی غیرآترواسکلروتیک مانند بستری برای نارسایی قلب و کاهش پاراتیروئیدکتومی را مطرح کردند", "سیناکلست مرگ‌ومیر را در کودکان کاهش داد", "سیناکلست خطر پاراتیروئیدکتومی را افزایش داد", "سیناکلست فقط حوادث آترواسکلروتیک را کاهش داد", "سیناکلست شکستگی را به‌طور معنی‌دار کاهش داد"]'::jsonb,
     0, null, null, null, null, null,
     '["EVOLVE", "results"]'::jsonb, 'hard', 2,
     $e12$در EVOLVE، بیماران دریافت‌کننده سیناکلست کمتر به پیامد اولیه ترکیبی زمان تا مرگ، انفارکتوس قلبی یا بستری قلبی‌عروقی رسیدند (HR برابر ۰.۸۸). تحلیل‌های ثانویه فایده در حوادث غیرآترواسکلروتیک مانند بستری برای نارسایی قلب و کاهش پاراتیروئیدکتومی را نشان دادند.$e12$),

    (v_owner_id, v_topic,
     $q13$فلویی معتقد است چون سیناکلست PTH را به‌طور قابل‌توجهی کاهش می‌دهد، حتماً مرگ‌ومیر و شکستگی را هم کم می‌کند. کدام شاهد بهترین نقد این استدلال است؟$q13$,
     'mcq',
     '["EVOLVE نشان داد سیناکلست PTH را کاهش نمی‌دهد", "کارآزمایی‌های کودکان کاهش مرگ‌ومیر را نشان داده‌اند", "سیناکلست پاراتیروئیدکتومی را افزایش می‌دهد", "متاآنالیز ۲۳ RCT شامل ۸۴۸۱ بیمار بزرگسال دیالیزی، با وجود کاهش معنی‌دار PTH و کاهش پاراتیروئیدکتومی، کاهش معنی‌داری در خطر شکستگی، حوادث قلبی‌عروقی یا مرگ‌ومیر با سیناکلست نشان نداد", "سیناکلست فقط در CKD پیش از دیالیز مؤثر است"]'::jsonb,
     3, null, null, null, null, null,
     '["meta-analysis", "surrogate vs hard outcomes"]'::jsonb, 'hard', 3,
     $e13$متاآنالیز ۲۳ RCT با ۸۴۸۱ بیمار بزرگسال دیالیزی، با وجود کاهش معنی‌دار PTH و کاهش بروز پاراتیروئیدکتومی، کاهش معنی‌داری در خطر شکستگی، حوادث قلبی‌عروقی یا مرگ‌ومیر نشان نداد. بهبود پیامد جایگزین (PTH) لزوماً به بهبود پیامدهای قطعی منجر نمی‌شود.$e13$),

    (v_owner_id, v_topic,
     $q14$کدام عبارت وضعیت کارآزمایی‌های سیناکلست در کودکان دیالیزی را درست توصیف می‌کند؟$q14$,
     'mcq',
     '["پنج کارآزمایی با حمایت صنعت (RCT یا open-label) انجام شده که فقط دو مورد منتشر شده‌اند؛ بیماران PTH پایه بالای ۳۰۰ pg/mL و Ca بالای ۲.۲ mmol/L داشتند و پیامد اولیه، یعنی کاهش حداقل ۳۰٪ PTH، فقط در یک مطالعه حاصل شد", "ده کارآزمایی بزرگ منتشرشده کاهش مرگ‌ومیر را نشان داده‌اند", "همه پنج کارآزمایی منتشر شده و همگی به پیامد اولیه رسیده‌اند", "هیچ کارآزمایی در کودکان انجام نشده است", "کارآزمایی‌ها فقط در کودکان CKD پیش از دیالیز بوده‌اند"]'::jsonb,
     0, null, null, null, null, null,
     '["pediatric trials", "evidence"]'::jsonb, 'hard', 2,
     $e14$پنج کارآزمایی RCT یا open-label با حمایت صنعت سیناکلست را در کودکان دیالیزی ارزیابی کرده‌اند و فقط دو مورد منتشر شده است. بیماران PTH پایه بالای ۳۰۰ pg/mL (۶ برابر حد بالای نرمال) و Ca بالای ۲.۲ mmol/L داشتند. پیامد اولیه، یعنی کاهش دست‌کم ۳۰٪ PTH، فقط در یک مطالعه حاصل شد.$e14$),

    (v_owner_id, v_topic,
     $q15$پنج مطالعه آینده‌نگر دیگر درباره سیناکلست در کودکان با PTH پایه ۳۰۰ تا ۵۰۰ pg/mL چه یافته‌ای داشتند؟$q15$,
     'mcq',
     '["سیناکلست در کاهش PTH بی‌اثر بود", "هیپوکلسمی در هیچ بیماری رخ نداد", "سیناکلست در کاهش PTH مؤثر بود، اما میزان دوره‌های هیپوکلسمی پس از مواجهه متفاوت گزارش شد", "سیناکلست باعث هیپرکلسمی شد", "مرگ‌ومیر به‌طور معنی‌دار کاهش یافت"]'::jsonb,
     2, null, null, null, null, null,
     '["prospective studies", "hypocalcemia"]'::jsonb, 'medium', 2,
     $e15$پنج مطالعه آینده‌نگر دیگر گزارش کردند سیناکلست در کاهش PTH در کودکان با PTH پایه ۳۰۰ تا ۵۰۰ pg/mL مؤثر است، اما میزان دوره‌های هیپوکلسمی پس از مواجهه متفاوت بود.$e15$),

    (v_owner_id, v_topic,
     $q16$کدام عبارت تفاوت etelcalcetide با سیناکلست را درست بیان می‌کند؟$q16$,
     'mcq',
     '["etelcalcetide مولکول کوچک خوراکی است و سیناکلست پپتید وریدی", "etelcalcetide پپتید سنتتیکی است که CaSR را در دومین خارج سلولی گیرنده روی سلول‌های اصلی پاراتیروئید به‌طور آلوستریک فعال می‌کند و فعال‌شدن آن را با کلسیم خارج سلولی تقویت می‌کند؛ سیناکلست PTH را با افزایش حساسیت CaSR به کلسیم خارج سلولی کاهش می‌دهد", "etelcalcetide آنتاگونیست CaSR است", "etelcalcetide با اتصال به فسفر روده عمل می‌کند", "هر دو از طریق گیرنده ویتامین D عمل می‌کنند"]'::jsonb,
     1, null, null, null, null, null,
     '["etelcalcetide", "mechanism comparison"]'::jsonb, 'hard', 2,
     $e16$etelcalcetide پپتید سنتتیکی است که CaSR را در دومین خارج سلولی گیرنده روی سلول‌های اصلی پاراتیروئید به‌طور آلوستریک فعال می‌کند. با تقویت فعال‌شدن گیرنده توسط کلسیم خارج سلولی، ترشح PTH را کاهش می‌دهد. سیناکلست مستقیماً با افزایش حساسیت CaSR به کلسیم خارج سلولی PTH را پایین می‌آورد.$e16$),

    (v_owner_id, v_topic,
     $q17$نوجوان ۱۷ ساله همودیالیزی با هیپرپاراتیروئیدی شدید، به علت عدم پایبندی، داروهای خوراکی از جمله سیناکلست را مصرف نمی‌کند. کدام ویژگی etelcalcetide در این زمینه مطرح است و محدودیت آن در کودکان چیست؟$q17$,
     'mcq',
     '["قرص خوراکی هفتگی است؛ در کودکان کاملاً تأییدشده است", "زیرجلدی ماهانه تجویز می‌شود؛ کارآزمایی‌های کودکان کامل شده‌اند", "از طریق محلول دیالیز صفاقی تجویز می‌شود", "داخل وریدی پس از هر جلسه همودیالیز تجویز می‌شود و می‌تواند پایبندی را بهبود دهد؛ در بزرگسالان PTH را به اندازه سیناکلست کاهش می‌دهد، اما مطالعات کودکان هنوز در جریان است", "در بزرگسالان کم‌اثرتر از سیناکلست است"]'::jsonb,
     3, null, null, null, null, null,
     '["etelcalcetide", "adherence", "hemodialysis"]'::jsonb, 'hard', 3,
     $e17$etelcalcetide داخل وریدی پس از هر جلسه HD تجویز می‌شود که می‌تواند پایبندی بیمار را بهبود دهد. مطالعات بزرگسالان نشان می‌دهد PTH را به اندازه سیناکلست کاهش می‌دهد. مطالعات در کودکان در جریان است.$e17$),

    (v_owner_id, v_topic,
     $q18$پسر ۱۲ ساله تحت دیالیز صفاقی شبانه در منزل است و پایبندی ضعیفی به سیناکلست خوراکی دارد. والدین درخواست etelcalcetide دارند. کدام نکته در تصمیم‌گیری مهم‌تر است؟$q18$,
     'mcq',
     '["etelcalcetide برای تجویز داخل وریدی پس از هر جلسه همودیالیز طراحی شده و این مزیت در دیالیز صفاقی وجود ندارد؛ همچنین داده‌های کودکان هنوز در دست انجام است", "etelcalcetide به محلول PD اضافه می‌شود", "etelcalcetide در کودکان PD دارای کارآزمایی منتشرشده است", "etelcalcetide قرص جویدنی است", "etelcalcetide هیچ خطر هیپوکلسمی ندارد"]'::jsonb,
     0, null, null, null, null, null,
     '["etelcalcetide", "peritoneal dialysis", "applicability"]'::jsonb, 'hard', 3,
     $e18$etelcalcetide داخل وریدی پس از هر جلسه HD تجویز می‌شود و مزیت پایبندی آن به این شیوه تجویز وابسته است. مطالعات در کودکان در جریان است.$e18$),

    (v_owner_id, v_topic,
     $q19$در پروتکل پایش کودکان تحت درمان با سیناکلست، کدام مورد اولویت دارد؟$q19$,
     'mcq',
     '["فقط اندازه‌گیری سالانه PTH", "پایش منظم کلسیم سرم (ترجیحاً کلسیم یونیزه در صورت دسترسی) و PTH، همراه با تنظیم درمان معمول برای رسیدن به Ca، P و PTH طبیعی", "فقط پایش فسفر", "اندازه‌گیری FGF23 در هر ویزیت", "پایش نیاز نیست، چون سیناکلست کلسیم را افزایش می‌دهد"]'::jsonb,
     1, null, null, null, null, null,
     '["monitoring", "ionized calcium"]'::jsonb, 'hard', 3,
     $e19$پایش منظم Ca سرم (ترجیحاً یونیزه) و PTH ضروری است. درمان معمول، شامل دریافت کلسیم تغذیه‌ای، P-binderهای کلسیمی، آنالوگ‌های ویتامین D و کلسیم محلول دیالیز، ممکن است نیاز به تنظیم داشته باشد.$e19$),

    (v_owner_id, v_topic,
     $q20$دختر ۱۵ ساله دیالیزی با هیپرپاراتیروئیدی شدید و کلسیم بالای طبیعی، سابقه صرع کنترل‌شده دارد و به علت عفونت یک داروی طولانی‌کننده QT دریافت می‌کند. QTc پایه طبیعی است. کدام رویکرد صحیح‌تر است؟$q20$,
     'mcq',
     '["سیناکلست کاملاً ممنوع است، چون سابقه تشنج دارد", "سیناکلست بدون هیچ ملاحظه‌ای شروع شود", "سیناکلست با احتیاط و فقط پس از ارزیابی دقیق مطرح است؛ سابقه تشنج و مصرف داروهای افزایش‌دهنده QTc جزو موارد احتیاط‌اند، و در صورت امکان بهتر است شروع تا پایان داروی طولانی‌کننده QT به تعویق بیفتد، همراه با پایش ECG و Ca", "سیناکلست با دوز بالا شروع شود تا دوره درمان کوتاه شود", "داروی طولانی‌کننده QT اهمیتی ندارد"]'::jsonb,
     2, null, null, null, null, null,
     '["cautions", "drug interactions", "liver disease"]'::jsonb, 'hard', 3,
     $e20$QT طولانی منع شروع سیناکلست است. سابقه تشنج، آریتمی، بیماری کبدی قابل‌توجه و داروهایی که QTc را افزایش می‌دهند یا با متابولیسم سیناکلست تداخل دارند، موارد احتیاط‌اند. این بیمار QTc پایه طبیعی دارد، پس منع مطلق ندارد، اما دو عامل احتیاط دارد.$e20$),

    (v_owner_id, v_topic,
     $q21$مهم‌ترین نگرانی ایمنی در شروع سیناکلست در کودکانی که کلسیم اصلاح‌شده پایین دارند کدام است؟$q21$,
     'mcq',
     '["هیپرکلسمی و کلسیفیکاسیون عروقی", "اسیدوز متابولیک", "تجمع دارو در استخوان", "هیپوکلسمی که می‌تواند به آریتمی‌های بالقوه کشنده یا تشنج منجر شود", "افزایش FGF23"]'::jsonb,
     3, null, null, null, null, null,
     '["hypocalcemia consequences"]'::jsonb, 'medium', 2,
     $e21$سیناکلست می‌تواند هیپوکلسمی ایجاد کند که به آریتمی‌های بالقوه کشنده یا تشنج منجر می‌شود. به همین دلیل در کلسیم اصلاح‌شده کمتر از ۲.۴۰ mmol/L نباید شروع شود.$e21$),

    (v_owner_id, v_topic,
     $q22$کدام مجموعه شرایط با معیارهای اجماع ESPN برای شروع سیناکلست در کودکان مطابقت کامل دارد؟$q22$,
     'mcq',
     '["کودک ۵ ساله تحت دیالیز با هیپرپاراتیروئیدی شدید و پایدار، کلسیم بالای طبیعی (اصلاح‌شده ۲.۵ mmol/L)، QTc طبیعی و درمان معمول بهینه‌شده شامل استرول ویتامین D", "کودک ۲ ساله تحت دیالیز با PTH بالا و کلسیم بالا", "کودک ۸ ساله با CKD مرحله ۳ و PTH کمی بالا", "نوجوان دیالیزی با کلسیم اصلاح‌شده ۲.۲ mmol/L", "نوجوان دیالیزی با QT طولانی و PTH بالا"]'::jsonb,
     0, null, null, null, null, null,
     '["ESPN criteria", "integrated"]'::jsonb, 'medium', 2,
     $e22$ESPN سیناکلست را در کودکان دیالیزی بالای ۳ سال با هیپرپاراتیروئیدی شدید و پایدار، کلسیم بالا یا بالای طبیعی و وجود درمان معمول بهینه‌شده توصیه می‌کند. گزینه B زیر ۳ سال، C غیردیالیزی و غیرشدید، D کلسیم کمتر از ۲.۴۰ و E دارای QT طولانی است.$e22$),

    (v_owner_id, v_topic,
     $q23$سیناکلست مدولاتور ____ گیرنده ____ است.$q23$,
     'fill_blank', '[]'::jsonb, null,
     '["آلوستریک", "حس‌گر کلسیم (CaSR)"]'::jsonb, null, null, null, null,
     '["mechanism"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q24$کارآزمایی EVOLVE شامل ____ بیمار بزرگسال همودیالیزی با PTH پایه ____ pg/mL یا بیشتر و کلسیم ____ mg/dL یا بیشتر بود.$q24$,
     'fill_blank', '[]'::jsonb, null,
     '["۳۸۸۳", "۳۰۰", "۸.۴"]'::jsonb, null, null, null, null,
     '["EVOLVE"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q25$در EVOLVE، نسبت خطر پیامد اولیه ترکیبی با سیناکلست برابر ____ بود (فاصله اطمینان ۹۵٪: ۰.۷۹ تا ۰.۹۷).$q25$,
     'fill_blank', '[]'::jsonb, null,
     '["۰.۸۸"]'::jsonb, null, null, null, null,
     '["EVOLVE", "hazard ratio"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q26$تحلیل‌های ثانویه EVOLVE فایده سیناکلست را در حوادث قلبی‌عروقی ____ (مانند بستری برای نارسایی قلب) و بروز کمتر ____ نشان دادند.$q26$,
     'fill_blank', '[]'::jsonb, null,
     '["غیرآترواسکلروتیک", "پاراتیروئیدکتومی"]'::jsonb, null, null, null, null,
     '["EVOLVE", "secondary analyses"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q27$متاآنالیز ____ RCT با ____ بیمار بزرگسال دیالیزی، کاهش معنی‌داری در شکستگی، حوادث قلبی‌عروقی یا مرگ‌ومیر با سیناکلست نشان نداد.$q27$,
     'fill_blank', '[]'::jsonb, null,
     '["۲۳", "۸۴۸۱"]'::jsonb, null, null, null, null,
     '["meta-analysis"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q28$از ____ کارآزمایی سیناکلست با حمایت صنعت در کودکان دیالیزی، فقط ____ مورد منتشر شده است.$q28$,
     'fill_blank', '[]'::jsonb, null,
     '["پنج", "دو"]'::jsonb, null, null, null, null,
     '["pediatric trials"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q29$پیامد اولیه کارآزمایی‌های کودکان کاهش دست‌کم ____ درصد PTH از سطح پایه بود.$q29$,
     'fill_blank', '[]'::jsonb, null,
     '["۳۰"]'::jsonb, null, null, null, null,
     '["pediatric trials", "endpoint"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q30$اجماع ESPN استفاده از سیناکلست را در کودکان دیالیزی بالای ____ سال توصیه می‌کند.$q30$,
     'fill_blank', '[]'::jsonb, null,
     '["۳"]'::jsonb, null, null, null, null,
     '["ESPN", "age"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q31$سیناکلست نباید در بیماران با کلسیم اصلاح‌شده با آلبومین کمتر از ____ mmol/L شروع شود.$q31$,
     'fill_blank', '[]'::jsonb, null,
     '["۲.۴۰"]'::jsonb, null, null, null, null,
     '["calcium threshold"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q32$سیناکلست نباید در بیماران با فاصله ____ طولانی شروع شود.$q32$,
     'fill_blank', '[]'::jsonb, null,
     '["QT"]'::jsonb, null, null, null, null,
     '["QT"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q33$etelcalcetide یک ____ سنتتیک است که به‌صورت ____ پس از هر جلسه همودیالیز تجویز می‌شود.$q33$,
     'fill_blank', '[]'::jsonb, null,
     '["پپتید", "داخل وریدی"]'::jsonb, null, null, null, null,
     '["etelcalcetide"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q34$etelcalcetide گیرنده CaSR را در دومین ____ گیرنده روی سلول‌های ____ پاراتیروئید فعال می‌کند.$q34$,
     'fill_blank', '[]'::jsonb, null,
     '["خارج سلولی", "اصلی (chief cells)"]'::jsonb, null, null, null, null,
     '["etelcalcetide", "site of action"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q35$هر ویژگی را به داروی مربوط وصل کنید.$q35$,
     'matching', '[]'::jsonb, null, null,
     '[{"key": "1", "text": "تجویز داخل وریدی پس از هر جلسه همودیالیز"}, {"key": "2", "text": "ارزیابی‌شده در EVOLVE"}, {"key": "3", "text": "پپتید سنتتیک با اثر بر دومین خارج سلولی CaSR"}, {"key": "4", "text": "دارای اجماع ESPN برای کودکان دیالیزی بالای ۳ سال"}, {"key": "5", "text": "مطالعات کودکان در جریان است"}, {"key": "6", "text": "عارضه کشنده گزارش‌شده در نوجوان با QT طولانی"}]'::jsonb,
     '[{"key": "X", "text": "سیناکلست"}, {"key": "Y", "text": "etelcalcetide"}]'::jsonb,
     '[{"left": "1", "right": "Y"}, {"left": "2", "right": "X"}, {"left": "3", "right": "Y"}, {"left": "4", "right": "X"}, {"left": "5", "right": "Y"}, {"left": "6", "right": "X"}]'::jsonb,
     true,
     '["cinacalcet vs etelcalcetide"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q36$بر اساس متن، هر وضعیت را مشخص کنید: منع شروع سیناکلست یا احتیاط در مصرف.$q36$,
     'matching', '[]'::jsonb, null, null,
     '[{"key": "1", "text": "QT طولانی"}, {"key": "2", "text": "کلسیم اصلاح‌شده کمتر از ۲.۴۰ mmol/L"}, {"key": "3", "text": "سابقه تشنج"}, {"key": "4", "text": "سابقه آریتمی قلبی"}, {"key": "5", "text": "بیماری کبدی قابل‌توجه"}, {"key": "6", "text": "مصرف داروهای افزایش‌دهنده QTc"}]'::jsonb,
     '[{"key": "X", "text": "نباید شروع شود"}, {"key": "Y", "text": "با احتیاط مصرف شود"}]'::jsonb,
     '[{"left": "1", "right": "X"}, {"left": "2", "right": "X"}, {"left": "3", "right": "Y"}, {"left": "4", "right": "Y"}, {"left": "5", "right": "Y"}, {"left": "6", "right": "Y"}]'::jsonb,
     true,
     '["contraindication vs caution"]'::jsonb, 'hard', 3, null),

    (v_owner_id, v_topic,
     $q37$هر مطالعه را به یافته اصلی آن وصل کنید.$q37$,
     'matching', '[]'::jsonb, null, null,
     '[{"key": "1", "text": "EVOLVE (پیامد اولیه)"}, {"key": "2", "text": "متاآنالیز ۲۳ RCT در بزرگسالان دیالیزی"}, {"key": "3", "text": "کارآزمایی‌های صنعتی سیناکلست در کودکان"}, {"key": "4", "text": "پنج مطالعه آینده‌نگر دیگر در کودکان"}, {"key": "5", "text": "مطالعات etelcalcetide در بزرگسالان"}]'::jsonb,
     '[{"key": "A", "text": "کاهش ۳۰٪ PTH فقط در یک مطالعه حاصل شد"}, {"key": "B", "text": "کاهش PTH مشابه سیناکلست"}, {"key": "C", "text": "HR برابر ۰.۸۸ برای پیامد ترکیبی مرگ، انفارکتوس قلبی یا بستری قلبی‌عروقی"}, {"key": "D", "text": "مؤثر در کاهش PTH با میزان متفاوت هیپوکلسمی"}, {"key": "E", "text": "بدون کاهش معنی‌دار شکستگی، حوادث قلبی‌عروقی یا مرگ‌ومیر با وجود کاهش PTH"}]'::jsonb,
     '[{"left": "1", "right": "C"}, {"left": "2", "right": "E"}, {"left": "3", "right": "A"}, {"left": "4", "right": "D"}, {"left": "5", "right": "B"}]'::jsonb,
     false,
     '["studies", "findings"]'::jsonb, 'hard', 2, null),

    (v_owner_id, v_topic,
     $q38$هر سناریو را به تصمیم صحیح درباره سیناکلست وصل کنید.$q38$,
     'matching', '[]'::jsonb, null, null,
     '[{"key": "1", "text": "۱۲ ساله، دیالیز، HPT شدید پایدار، Ca اصلاح‌شده ۲.۶ mmol/L، درمان معمول بهینه، QTc طبیعی"}, {"key": "2", "text": "۱۴ ساله، دیالیز، HPT شدید، Ca اصلاح‌شده ۲.۲۵ mmol/L"}, {"key": "3", "text": "۱۶ ساله، دیالیز، HPT شدید، Ca بالا، QTc طولانی"}, {"key": "4", "text": "۱۳ ساله تحت سیناکلست با هیپوکلسمی جدید"}, {"key": "5", "text": "۲ ساله تحت PD با HPT شدید"}]'::jsonb,
     '[{"key": "A", "text": "شروع با کمترین دوز مؤثر و پایش Ca و PTH"}, {"key": "B", "text": "عدم شروع به علت QT طولانی"}, {"key": "C", "text": "عدم شروع به علت کلسیم کمتر از ۲.۴۰ mmol/L"}, {"key": "D", "text": "خارج از گروه سنی توصیه ESPN (کمتر از ۳ سال)"}, {"key": "E", "text": "بازبینی دوز و تنظیم کلسیم رژیم، P-binder کلسیمی، ویتامین D و کلسیم محلول دیالیز"}]'::jsonb,
     '[{"left": "1", "right": "A"}, {"left": "2", "right": "C"}, {"left": "3", "right": "B"}, {"left": "4", "right": "E"}, {"left": "5", "right": "D"}]'::jsonb,
     false,
     '["clinical scenarios", "decision"]'::jsonb, 'hard', 3, null);
end $$;
