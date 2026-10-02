-- Nephron Board Questions — schema upgrade + CKD-MBD Epidemiology question
-- set (8 MCQ, 7 fill-in-the-blank, 2 matching).
--
-- Part 1: extends board_questions with the columns the app's new
-- fill-in-the-blank and matching question types need (question_type,
-- fill_answers, match_left/right/answer, allow_reuse, tags, difficulty,
-- taxonomy), and makes correct_index nullable since only MCQ rows use it.
-- Safe to re-run — "add column if not exists" / guarded drop-not-null.
--
-- Part 2: inserts the 17 questions under topic "CKD / CKD-MBD /
-- Epidemiology" for your account. Skipped automatically if that topic
-- already has questions, so re-running this file is a no-op (delete the
-- topic's existing rows first if you want to reload it with edits).

-- ---------- Part 1: schema upgrade ----------
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

-- ---------- Part 2: CKD-MBD Epidemiology question set ----------
do $$
declare
  v_owner_id uuid;
  v_topic text := 'CKD / CKD-MBD / Epidemiology';
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
     $q1$دختر ۱۴ ساله‌ای با CKD مرحله ۴ ناشی از هیپوپلازی کلیه در درمانگاه پیگیری می‌شود. بلوغ او Tanner 4 است و Height Z-score او ۲.۶- است. PTH بالاتر از محدوده هدف و 25(OH)D برابر 12 ng/mL است. عضو تیم والیبال مدرسه است و برای هیپرفسفاتمی کربنات کلسیم مصرف می‌کند. کدام‌یک از ویژگی‌های این بیمار با کاهش خطر شکستگی همراه بوده است؟$q1$,
     'mcq',
     '["مرحله بلوغ Tanner 4","شرکت در ورزش تیمی","مصرف P-binder کلسیمی","کمبود 25-hydroxyvitamin D","قد کوتاه (Z-score پایین)"]'::jsonb,
     2, null, null, null, null, null,
     '["fracture","risk factors","phosphate binder"]'::jsonb, 'hard', 3,
     $e1$در CKD پیش از دیالیز، مصرف P-binder، به‌ویژه نوع کلسیمی، با کاهش خطر شکستگی همراه بوده است. علت احتمالی کنترل بهتر فسفر و/یا افزایش دریافت کلسیم است. سایر گزینه‌ها همگی ریسک‌فاکتور شکستگی هستند.$e1$),

    (v_owner_id, v_topic,
     $q2$چهار کودک با CKD پیش از دیالیز را در نظر بگیرید. بر اساس ریسک‌فاکتورهای شناخته‌شده، کدام‌یک بیشترین خطر شکستگی را دارد؟$q2$,
     'mcq',
     '["پسر ۸ ساله، Tanner 1، قد نرمال، PTH در محدوده هدف، فعالیت ورزشی ندارد","دختر ۱۵ ساله، Tanner 5، Height Z-score ۲.۸-، PTH بالا، کلسیم پایین، دشواری در راه رفتن، عضو تیم بسکتبال","پسر ۱۲ ساله، Tanner 2، PTH بالا، مصرف کربنات کلسیم با کنترل خوب فسفر","دختر ۶ ساله، Tanner 1، 25D نرمال، مصرف P-binder کلسیمی","پسر ۱۰ ساله، قد نرمال، فقط کمبود خفیف 25D"]'::jsonb,
     1, null, null, null, null, null,
     '["fracture","risk factors","CKiD"]'::jsonb, 'medium', 3,
     $e2$این بیمار تقریباً همه ریسک‌فاکتورها را با هم دارد: جنس مؤنث (خطر نسبی حدود ۳ برابر در برابر ۲.۴ در پسران)، Tanner 4–5، قد کوتاه، PTH بالا، کلسیم پایین، دشواری پایه در راه رفتن و ورزش تیمی.$e2$),

    (v_owner_id, v_topic,
     $q3$والدین پسری ۱۱ ساله که به‌تازگی به ESKD رسیده درباره پیامدهای استخوانی او در بزرگسالی سؤال می‌کنند. بر اساس داده‌های کوهورت هلندی (بزرگسالانی که پیش از ۱۴ سالگی دچار ESKD شده بودند)، شایع‌ترین پیامد گزارش‌شده کدام است؟$q3$,
     'mcq',
     '["بیماری استخوانی شدید","کاهش شدید قد نهایی بزرگسالی","ناتوانی ناشی از بیماری استخوانی","نکروز آسپتیک","شکستگی با ترومای خفیف"]'::jsonb,
     1, null, null, null, null, null,
     '["long-term outcome","final height","Dutch cohort"]'::jsonb, 'medium', 2,
     $e3$کاهش شدید قد نهایی در ۶۱٪ گزارش شد. بیماری استخوانی شدید در ۳۷٪ و ناتوانی در ۱۸٪ بود.$e3$),

    (v_owner_id, v_topic,
     $q4$در مطالعه هلندی، «بیماری استخوانی شدید» با چند معیار تعریف شد. کدام مورد جزو این معیارها نبود؟$q4$,
     'mcq',
     '["دفورمیتی استخوانی","درد مزمن","شکستگی با ترومای خفیف","نکروز آسپتیک","کاهش BMD در DXA"]'::jsonb,
     4, null, null, null, null, null,
     '["definition","severe bone disease","Dutch cohort"]'::jsonb, 'medium', 2,
     $e4$تعریف این مطالعه بالینی بود (دفورمیتی، درد مزمن، شکستگی با ترومای خفیف و/یا نکروز آسپتیک) و یافته دانسیتومتری را شامل نمی‌شد.$e4$),

    (v_owner_id, v_topic,
     $q5$یک فلو در گزارش مرکز خود می‌نویسد که «۱۵٪ کودکان تحت PD علائم اسکلتی دارند، پس بیماری استخوانی بالینی در CKD کودکان شیوع پایینی دارد». بهترین نقد بر این استدلال کدام است؟$q5$,
     'mcq',
     '["این عدد مربوط به همودیالیز است، نه PD","این رقم احتمالاً شیوع واقعی را کمتر از حد برآورد می‌کند. در CKD مرحله ۴–۵، درد استخوانی فعالیت روزانه ۵۸٪ کودکان را مختل کرده است.","شیوع واقعی کمتر از ۵٪ است","علائم اسکلتی فقط با بیوپسی استخوان قابل ارزیابی است","این رقم شامل یافته‌های رادیولوژیک نیست"]'::jsonb,
     1, null, null, null, null, null,
     '["prevalence","bone pain","peritoneal dialysis"]'::jsonb, 'hard', 3,
     $e5$رقم ۱۵٪ احتمالاً کم‌برآورد است. گزینه E نادرست است، چون رقم ۱۵٪ علائم رادیولوژیک را هم شامل می‌شد.$e5$),

    (v_owner_id, v_topic,
     $q6$پسر ۱۳ ساله با CKD مرحله ۴ هیپرفسفاتمی دارد و کلسیم سرم او نرمال است. رزیدنت با استناد به داده‌های اپیدمیولوژیک می‌گوید: «P-binder کلسیمی خطر شکستگی را کم می‌کند، پس برای همه بیماران بهترین انتخاب است.» دقیق‌ترین پاسخ کدام است؟$q6$,
     'mcq',
     '["درست است؛ اثر محافظتی آن در کارآزمایی‌های تصادفی اثبات شده است","این داده‌ها در کودکان دیالیزی به دست آمده و قابل تعمیم نیست","ارتباط مشاهده شده، اما مکانیسم احتمالی (کنترل فسفر و/یا دریافت کلسیم) است. با توجه به ریسک بالای کلسیفیکاسیون عروقی و افزایش ۱۰ برابری عوارض CV در این بیماران، تصمیم باید فردی باشد.","P-binder کلسیمی با افزایش خطر شکستگی همراه است","فقط binderهای غیرکلسیمی با کاهش شکستگی مرتبط بوده‌اند"]'::jsonb,
     2, null, null, null, null, null,
     '["phosphate binder","vascular calcification","evidence interpretation"]'::jsonb, 'hard', 3,
     $e6$سؤال تلفیقی: شواهد مشاهده‌ای و مربوط به CKD پیش از دیالیز است و بار کلسیمی را باید در برابر خطر قلبی‌عروقی و کلسیفیکاسیون عروقی سنجید.$e6$),

    (v_owner_id, v_topic,
     $q7$دختر ۱۷ ساله‌ای که از ۱۰ سالگی تحت همودیالیز است، برای ارزیابی پیش از پیوند مراجعه کرده است. کدام عبارت درباره وضعیت قلبی‌عروقی او صحیح‌تر است؟$q7$,
     'mcq',
     '["کلسیفیکاسیون عروقی پیش از ۳۰ سالگی در ESKD دیده نمی‌شود","عوارض و مرگ‌ومیر قلبی‌عروقی در کودکان دیالیزی حدود ۱۰ برابر جمعیت عادی است و کلسیفیکاسیون عروقی حتی در کودکان و جوانان ESKD وجود دارد","افزایش خطر CV فقط در بزرگسالان CKD مطرح است","خطر CV در کودکان دیالیزی حدود ۲ برابر است","کلسیفیکاسیون عروقی فقط در بیماران دیابتی دیده می‌شود"]'::jsonb,
     1, null, null, null, null, null,
     '["cardiovascular","vascular calcification","dialysis"]'::jsonb, 'medium', 2,
     $e7$کودکان CKD، به‌ویژه دیالیزی، افزایش ۱۰ برابری عوارض و مرگ‌ومیر CV دارند و کلسیفیکاسیون عروقی حتی در کودکان و جوانان ESKD دیده می‌شود.$e7$),

    (v_owner_id, v_topic,
     $q8$در کوهورت CKiD، خطر شکستگی در دختران و پسران با CKD پیش از دیالیز در مقایسه با کودکان سالم به ترتیب چند برابر بود؟$q8$,
     'mcq',
     '["۲ و ۲","۳ و ۲.۴","۲.۴ و ۳","۱.۵ و ۲","۱۰ و ۱۰"]'::jsonb,
     1, null, null, null, null, null,
     '["fracture","CKiD","sex difference"]'::jsonb, 'medium', 2,
     $e8$ترتیب مهم است: افزایش در دختران ۳ برابر و در پسران ۲.۴ برابر بود.$e8$),

    (v_owner_id, v_topic,
     $q9$علائم اسکلتی (دفورمیتی اندام، درد استخوان، شکستگی یا شواهد رادیولوژیک) در ____ درصد کودکان تحت دیالیز صفاقی گزارش شده است.$q9$,
     'fill_blank', '[]'::jsonb, null,
     '["۱۵"]'::jsonb, null, null, null, null,
     '["prevalence","peritoneal dialysis"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q10$در CKD مرحله ۴–۵، درد استخوانی قابل‌توجه فعالیت روزانه ____ درصد کودکان را مختل کرده است.$q10$,
     'fill_blank', '[]'::jsonb, null,
     '["۵۸"]'::jsonb, null, null, null, null,
     '["bone pain","CKD 4-5"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q11$در کوهورت CKiD، خطر شکستگی در پسران ____ برابر و در دختران ____ برابر کودکان سالم بود.$q11$,
     'fill_blank', '[]'::jsonb, null,
     '["۲.۴", "۳"]'::jsonb, null, null, null, null,
     '["fracture","CKiD"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q12$مراحل بلوغ ____ با افزایش خطر شکستگی در CKD کودکان همراه است.$q12$,
     'fill_blank', '[]'::jsonb, null,
     '["Tanner 4–5"]'::jsonb, null, null, null, null,
     '["fracture","puberty"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q13$از نظر آزمایشگاهی، سطح ____ بالاتر و سطوح ____ و ____ پایین‌تر با افزایش خطر شکستگی ارتباط دارند.$q13$,
     'fill_blank', '[]'::jsonb, null,
     '["PTH", "کلسیم", "25-hydroxyvitamin D"]'::jsonb, null, null, null, null,
     '["fracture","laboratory"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q14$در بزرگسالانی که پیش از ۱۴ سالگی دچار ESKD شده بودند، ____ درصد بیماری استخوانی شدید و ____ درصد ناتوانی ناشی از آن را گزارش کردند.$q14$,
     'fill_blank', '[]'::jsonb, null,
     '["۳۷", "۱۸"]'::jsonb, null, null, null, null,
     '["long-term outcome","Dutch cohort"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q15$کودکان مبتلا به CKD، به‌ویژه بیماران دیالیزی، افزایش ____ برابری در عوارض و مرگ‌ومیر قلبی‌عروقی دارند.$q15$,
     'fill_blank', '[]'::jsonb, null,
     '["۱۰"]'::jsonb, null, null, null, null,
     '["cardiovascular"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q16$هر عدد را به یافته مربوط وصل کنید.$q16$,
     'matching', '[]'::jsonb, null, null,
     '[{"key":"1","text":"۱۵٪"},{"key":"2","text":"۵۸٪"},{"key":"3","text":"۳۷٪"},{"key":"4","text":"۶۱٪"},{"key":"5","text":"۱۸٪"},{"key":"6","text":"۱۰ برابر"},{"key":"7","text":"۳ برابر"}]'::jsonb,
     '[{"key":"A","text":"کاهش شدید قد نهایی بزرگسالی (کوهورت هلندی)"},{"key":"B","text":"افزایش عوارض و مرگ CV در کودکان دیالیزی"},{"key":"C","text":"علائم اسکلتی در کودکان تحت PD"},{"key":"D","text":"ناتوانی ناشی از بیماری استخوانی"},{"key":"E","text":"بیماری استخوانی شدید در بزرگسالی"},{"key":"F","text":"اختلال فعالیت روزانه به علت درد استخوان در CKD 4–5"},{"key":"G","text":"خطر شکستگی در دختران با CKD پیش از دیالیز"}]'::jsonb,
     '[{"left":"1","right":"C"},{"left":"2","right":"F"},{"left":"3","right":"E"},{"left":"4","right":"A"},{"left":"5","right":"D"},{"left":"6","right":"B"},{"left":"7","right":"G"}]'::jsonb,
     false,
     '["epidemiology numbers"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q17$جهت ارتباط هر عامل با خطر شکستگی در CKD کودکان را مشخص کنید. (هر گزینه ستون راست می‌تواند چند بار استفاده شود)$q17$,
     'matching', '[]'::jsonb, null, null,
     '[{"key":"1","text":"دشواری پایه در راه رفتن"},{"key":"2","text":"مصرف P-binder کلسیمی"},{"key":"3","text":"Height Z-score پایین‌تر"},{"key":"4","text":"شرکت در ورزش تیمی"},{"key":"5","text":"سطح 25D پایین"},{"key":"6","text":"Tanner 4–5"},{"key":"7","text":"PTH بالاتر"}]'::jsonb,
     '[{"key":"X","text":"افزایش خطر"},{"key":"Y","text":"کاهش خطر"}]'::jsonb,
     '[{"left":"1","right":"X"},{"left":"2","right":"Y"},{"left":"3","right":"X"},{"left":"4","right":"X"},{"left":"5","right":"X"},{"left":"6","right":"X"},{"left":"7","right":"X"}]'::jsonb,
     true,
     '["fracture","risk factors"]'::jsonb, 'medium', 2, null);
end $$;
