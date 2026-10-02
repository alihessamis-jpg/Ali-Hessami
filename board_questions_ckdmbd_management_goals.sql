-- Nephron Board Questions — CKD-MBD Management: Goals of Treatment
-- question set (10 MCQ, 7 fill-in-the-blank, 2 matching). Covers the shift
-- from a bone-only to a bone-plus-cardiovascular treatment focus, trend-based
-- monitoring, pediatric calcium requirements vs. adult extrapolation, the
-- limits of the evidence base in children, and the guidelines/organizations
-- involved (KDIGO, K/DOQI, ESPN, NICE).
--
-- Part 1 repeats the same schema-upgrade statements from the earlier
-- question sets (harmless no-ops if already applied) so this file also
-- works standalone.
--
-- Part 2 inserts the 19 questions under topic "CKD / CKD-MBD / Management Goals" for your
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

-- ---------- Part 2: CKD-MBD Management Goals question set ----------
do $$
declare
  v_owner_id uuid;
  v_topic text := 'CKD / CKD-MBD / Management Goals';
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
     $q1$در یک جلسه آموزشی، از فلو خواسته می‌شود تغییر اهداف درمان CKD-MBD در سال‌های اخیر را توضیح دهد. کدام عبارت دقیق‌تر است؟$q1$,
     'mcq',
     '["اهداف درمان همچنان فقط بر کنترل هیپرپاراتیروئیدی ثانویه متمرکز است", "تمرکز درمان از اختلالات استخوانی به‌طور کامل به عروق منتقل شده و سلامت استخوان دیگر هدف درمان نیست", "هدف اصلی فقط طبیعی کردن فسفر است", "در گذشته تمرکز بر استئودیستروفی کلیوی و هیپرپاراتیروئیدی ثانویه بود؛ اکنون با شناخت ارتباط Ca، P، PTH و کلسیفیکاسیون عروقی با مرگ‌ومیر و حوادث زودرس قلبی‌عروقی، پیشگیری از مرگ زودرس و عوارض قلبی‌عروقی نیز هدف است و نیاز بالای اسکلت در حال رشد به کلسیم هم باید مدیریت شود", "اهداف درمان در کودکان و بزرگسالان کاملاً یکسان است"]'::jsonb,
     3, null, null, null, null, null,
     '["treatment goals", "historical shift"]'::jsonb, 'medium', 2,
     $e1$درمان CKD-MBD در گذشته بر استئودیستروفی کلیوی و هیپرپاراتیروئیدی ثانویه متمرکز بود. اکنون با شناخت ارتباط Ca، P، PTH و کلسیفیکاسیون عروقی با مرگ‌ومیر، پیشگیری از مرگ زودرس و عوارض قلبی‌عروقی نیز هدف است. همچنین نیاز بالای اسکلت در حال رشد به کلسیم باید برای پیشگیری از شکستگی و بیماری استخوانی ناتوان‌کننده مدیریت شود.$e1$),

    (v_owner_id, v_topic,
     $q2$PTH دختر ۱۰ ساله با CKD مرحله ۴ در چهار نوبت گذشته در محدوده هدف و ثابت بوده و اکنون یک نوبت ۴۰٪ بالاتر گزارش شده است. Ca، P و ALP ثابت‌اند و بیمار علامتی ندارد. بهترین اقدام کدام است؟$q2$,
     'mcq',
     '["شروع فوری کلسیتریول با دوز بالا", "تصمیم‌گیری بر اساس روند شاخص‌ها و نه یک مقدار منفرد؛ تکرار و پیگیری روند PTH همراه با Ca، P و ALP پیش از تغییر درمان", "شروع سیناکلست", "درخواست فوری بیوپسی استخوان", "قطع P-binder"]'::jsonb,
     1, null, null, null, null, null,
     '["trends vs single values", "PTH"]'::jsonb, 'medium', 3,
     $e2$از اصول مدیریت CKD-MBD، پیگیری روند Ca، P، PTH، ALP و 25D به جای مقادیر منفرد است. این شاخص‌ها باید در محدوده‌های اختصاصی سن و مرحله CKD حفظ شوند.$e2$),

    (v_owner_id, v_topic,
     $q3$یک بزرگسال‌محور پیشنهاد می‌کند در نوجوان ۱۳ ساله با CKD مرحله ۴، با استناد به مطالعات بزرگسالان، دریافت کلسیم به حداقل ممکن محدود شود تا خطر کلسیفیکاسیون عروقی کم شود. مهم‌ترین نقد این رویکرد کدام است؟$q3$,
     'mcq',
     '["اسکلت در حال رشد کودکان به کلسیم نیاز دارد و اگر مینرالیزاسیون طبیعی پیش از رسیدن به اوج توده استخوانی کامل نشود، پیامدهای ویرانگری تا بزرگسالی خواهد داشت؛ پس تعمیم یافته‌های بزرگسالان ممکن است مناسب نباشد", "کلسیم هیچ نقشی در کلسیفیکاسیون عروقی ندارد", "کودکان نیاز کمتری به کلسیم از بزرگسالان دارند", "محدودیت کلسیم در کودکان خطر شکستگی را کاهش می‌دهد", "اوج توده استخوانی پس از ۴۰ سالگی حاصل می‌شود، پس عجله‌ای نیست"]'::jsonb,
     0, null, null, null, null, null,
     '["calcium requirement", "adult extrapolation", "peak bone mass"]'::jsonb, 'hard', 3,
     $e3$تعمیم یافته‌های مطالعات بزرگسالان CKD ممکن است مناسب نباشد، چون اسکلت در حال رشد کودکان به کلسیم نیاز دارد. اگر مینرالیزاسیون طبیعی استخوان پیش از رسیدن به اوج توده استخوانی رخ ندهد، پیامدهای ویرانگری تا بزرگسالی خواهد داشت.$e3$),

    (v_owner_id, v_topic,
     $q4$کدام مورد جزو اصول مدیریت CKD-MBD در کودکان نیست؟$q4$,
     'mcq',
     '["حفظ Ca، P، PTH، ALP و 25D در محدوده‌های اختصاصی سن و مرحله CKD", "اصلاح اختلالات متابولیک مانند اسیدوز و سوءتغذیه", "استفاده از محدوده‌های مرجع ثابت بزرگسالان برای همه سنین", "تقویت رشد بهینه", "اجتناب از کلسیفیکاسیون خارج اسکلتی"]'::jsonb,
     2, null, null, null, null, null,
     '["principles of management"]'::jsonb, 'medium', 2,
     $e4$اصول مدیریت شامل حفظ Ca، P، PTH، ALP و 25D در محدوده‌های اختصاصی سن و مرحله CKD، پیگیری روندها، اصلاح اسیدوز و سوءتغذیه، تقویت رشد بهینه و اجتناب از کلسیفیکاسیون خارج اسکلتی است. محدوده‌های ثابت بزرگسالان مناسب نیستند.$e4$),

    (v_owner_id, v_topic,
     $q5$کدام عبارت وضعیت شواهد درمان CKD-MBD در کودکان را بهتر توصیف می‌کند؟$q5$,
     'mcq',
     '["کارآزمایی‌های متعدد در کودکان کاهش شکستگی و حوادث قلبی‌عروقی را با این درمان‌ها ثابت کرده‌اند", "هیچ کارآزمایی تصادفی درباره اصلاح شاخص‌های بیوشیمیایی وجود ندارد", "شواهد بزرگسالان را می‌توان بدون محدودیت به کودکان تعمیم داد", "همه توصیه‌های راهنماها در کودکان بر شواهد سطح بالا استوار است", "درمان‌هایی که غلظت‌های غیرطبیعی Ca، P، PTH و ویتامین D را اصلاح می‌کنند در کارآزمایی‌های تصادفی متعدد اثربخش بوده‌اند، اما شواهد سطح بالا درباره اثر آن‌ها بر پیامدهای بالینی مانند شکستگی و حوادث قلبی‌عروقی در کودکان وجود ندارد"]'::jsonb,
     4, null, null, null, null, null,
     '["evidence", "hard endpoints"]'::jsonb, 'hard', 2,
     $e5$درمان‌هایی که غلظت‌های غیرطبیعی Ca، P، PTH و ویتامین D را اصلاح می‌کنند در کارآزمایی‌های تصادفی متعدد اثربخش بوده‌اند. اما شواهد سطح بالا درباره اثر این درمان‌ها بر پیامدهای بالینی، مانند شکستگی و حوادث قلبی‌عروقی، در کودکان وجود ندارد.$e5$),

    (v_owner_id, v_topic,
     $q6$پسر ۱۲ ساله تحت دیالیز با شرایط پیچیده (سیستینوز، نارسایی رشد شدید و شکستگی‌های مکرر) مراجعه کرده است. توصیه راهنما در مورد او با شرایط بالینی‌اش همخوانی کامل ندارد. با توجه به ماهیت راهنماهای CKD-MBD کودکان، کدام رویکرد صحیح‌تر است؟$q6$,
     'mcq',
     '["اجرای دقیق و بدون تغییر توصیه راهنما، چون همه توصیه‌ها بر شواهد قطعی استوارند", "نادیده گرفتن کامل راهنماها", "چون شواهد پیامدهای قطعی در کودکان وجود ندارد، بسیاری از توصیه‌ها «ضعیف» یا فقط مبتنی بر نظر کارشناسی‌اند و باید با قضاوت بالینی پزشک معالج و بر اساس نیازهای فردی بیمار به‌دقت سنجیده و تطبیق داده شوند", "استفاده از راهنماهای بزرگسالان به جای راهنماهای کودکان", "تعویق هر تصمیم درمانی تا انتشار شواهد سطح بالا"]'::jsonb,
     2, null, null, null, null, null,
     '["guidelines", "weak recommendations", "clinical judgment"]'::jsonb, 'medium', 3,
     $e6$چون شواهد پیامدهای قطعی در کودکان وجود ندارد، بسیاری از توصیه‌ها «ضعیف» یا فقط مبتنی بر نظر کارشناسی‌اند. این توصیه‌ها باید با قضاوت بالینی پزشک معالج و بر اساس نیازهای فردی بیمار به‌دقت سنجیده و تطبیق داده شوند.$e6$),

    (v_owner_id, v_topic,
     $q7$دختر ۶ ساله با CKD مرحله ۳ هنوز شواهدی از کلسیفیکاسیون عروقی، دفورمیتی یا شکستگی ندارد و Ca، P و PTH در حد مرزی‌اند. والدین می‌پرسند چرا اکنون که «مشکلی ندارد» باید درمان CKD-MBD را جدی گرفت. کدام اصل مدیریتی پاسخ اصلی به این سؤال است؟$q7$,
     'mcq',
     '["درمان فقط پس از بروز علائم استخوانی لازم است", "هدف کلیدی مدیریت CKD-MBD پیشگیری اولیه است؛ یعنی کنترل شاخص‌ها پیش از بروز کلسیفیکاسیون خارج اسکلتی و بیماری استخوانی", "هدف فقط کنترل PTH در زمان شروع دیالیز است", "پیشگیری در کودکان کم‌سن اثری ندارد", "درمان فقط پس از مشاهده کلسیفیکاسیون در CT توصیه می‌شود"]'::jsonb,
     1, null, null, null, null, null,
     '["primary prevention"]'::jsonb, 'hard', 3,
     $e7$هدف کلیدی مدیریت CKD-MBD باید بر پیشگیری اولیه متمرکز باشد. این با شواهد شروع زودرس تغییرات عروقی و استخوانی در CKD کودکان همخوان است.$e7$),

    (v_owner_id, v_topic,
     $q8$نوجوان ۱۴ ساله تحت دیالیز صفاقی با هیپرفسفاتمی، در حال جهش رشد است. کدام رویکرد با اصول مدیریت CKD-MBD در کودکان سازگارتر است؟$q8$,
     'mcq',
     '["حداکثر کردن دریافت کلسیم بدون توجه به کلسیفیکاسیون", "حذف کامل کلسیم از رژیم و داروها", "تمرکز فقط بر طبیعی کردن PTH", "تأمین نیاز کلسیم اسکلت در حال رشد برای پیشگیری از شکستگی و بیماری استخوانی، همراه با حفظ شاخص‌ها در محدوده‌های اختصاصی سن و اجتناب از کلسیفیکاسیون خارج اسکلتی", "پیروی کامل از اهداف درمانی بزرگسالان"]'::jsonb,
     3, null, null, null, null, null,
     '["balancing goals", "calcium", "extraskeletal calcification"]'::jsonb, 'hard', 3,
     $e8$نیاز بالای اسکلت در حال رشد به کلسیم باید شناخته و به‌درستی مدیریت شود تا از شکستگی و بیماری استخوانی ناتوان‌کننده پیشگیری شود. در عین حال حفظ شاخص‌ها در محدوده‌های اختصاصی سن و اجتناب از کلسیفیکاسیون خارج اسکلتی از اصول مدیریت است.$e8$),

    (v_owner_id, v_topic,
     $q9$پسر ۹ ساله با CKD مرحله ۴، اسیدوز متابولیک و سوءتغذیه دارد. Ca، P و PTH در محدوده هدف‌اند. بر اساس اصول مدیریت CKD-MBD، کدام عبارت صحیح است؟$q9$,
     'mcq',
     '["اصلاح اختلالات متابولیک مانند اسیدوز و سوءتغذیه خود جزو اصول مدیریت CKD-MBD است", "با طبیعی بودن Ca، P و PTH، مدیریت CKD-MBD کامل است", "اسیدوز و سوءتغذیه ارتباطی با CKD-MBD ندارند", "اصلاح اسیدوز فقط پس از پیوند لازم است", "سوءتغذیه فقط بر رشد اثر دارد و به استخوان مربوط نیست"]'::jsonb,
     0, null, null, null, null, null,
     '["metabolic abnormalities", "acidosis", "malnutrition"]'::jsonb, 'medium', 2,
     $e9$اصلاح اختلالات متابولیک مانند اسیدوز و سوءتغذیه، در کنار کنترل شاخص‌های معدنی، تقویت رشد بهینه و اجتناب از کلسیفیکاسیون، جزو اصول مدیریت CKD-MBD است.$e9$),

    (v_owner_id, v_topic,
     $q10$کدام‌یک از راهنماهای زیر یک راهنمای ملی است که مدیریت CKD-MBD در کودکان را نیز پوشش داده است؟$q10$,
     'mcq',
     '["KDIGO", "K/DOQI", "ESPN", "AHA", "NICE (انگلستان)"]'::jsonb,
     4, null, null, null, null, null,
     '["guidelines", "organizations"]'::jsonb, 'easy', 2,
     $e10$راهنماهای بین‌المللی KDIGO، K/DOQI (بنیاد ملی کلیه) و ESPN، و همچنین راهنماهای ملی مانند NICE در انگلستان، مدیریت CKD-MBD در کودکان را پوشش داده‌اند.$e10$),

    (v_owner_id, v_topic,
     $q11$درمان CKD-MBD در گذشته بر مدیریت ____ و ____ متمرکز بود.$q11$,
     'fill_blank', '[]'::jsonb, null,
     '["استئودیستروفی کلیوی", "هیپرپاراتیروئیدی ثانویه"]'::jsonb, null, null, null, null,
     '["historical focus"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q12$امروزه اهداف درمان CKD-MBD بر پیشگیری از ____ و عوارض ____ نیز تمرکز دارد.$q12$,
     'fill_blank', '[]'::jsonb, null,
     '["مرگ زودرس", "قلبی‌عروقی"]'::jsonb, null, null, null, null,
     '["current goals"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q13$Ca، P، PTH، ALP و 25D باید در محدوده‌های اختصاصی ____ و ____ حفظ شوند و ____ آن‌ها، و نه مقادیر منفرد، پیگیری شود.$q13$,
     'fill_blank', '[]'::jsonb, null,
     '["سن", "مرحله CKD", "روند"]'::jsonb, null, null, null, null,
     '["target ranges"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q14$هدف کلیدی مدیریت CKD-MBD باید بر پیشگیری ____ متمرکز باشد.$q14$,
     'fill_blank', '[]'::jsonb, null,
     '["اولیه"]'::jsonb, null, null, null, null,
     '["primary prevention"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q15$اگر مینرالیزاسیون طبیعی استخوان پیش از رسیدن به ____ رخ ندهد، پیامدهای ویرانگری تا بزرگسالی خواهد داشت.$q15$,
     'fill_blank', '[]'::jsonb, null,
     '["اوج توده استخوانی (peak bone mass)"]'::jsonb, null, null, null, null,
     '["peak bone mass"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q16$شواهد سطح بالا درباره اثر درمان‌های CKD-MBD بر پیامدهای بالینی مانند ____ و حوادث ____ در کودکان وجود ندارد.$q16$,
     'fill_blank', '[]'::jsonb, null,
     '["شکستگی", "قلبی‌عروقی"]'::jsonb, null, null, null, null,
     '["evidence"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q17$چون شواهد پیامدهای قطعی در کودکان وجود ندارد، بسیاری از توصیه‌های راهنماها «____» یا فقط مبتنی بر ____ هستند.$q17$,
     'fill_blank', '[]'::jsonb, null,
     '["ضعیف", "نظر کارشناسی"]'::jsonb, null, null, null, null,
     '["guidelines"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q18$هر اختصار را به سازمان یا ماهیت آن وصل کنید.$q18$,
     'matching', '[]'::jsonb, null, null,
     '[{"key": "1", "text": "KDIGO"}, {"key": "2", "text": "K/DOQI"}, {"key": "3", "text": "ESPN"}, {"key": "4", "text": "NICE"}]'::jsonb,
     '[{"key": "A", "text": "انجمن اروپایی نفرولوژی کودکان"}, {"key": "B", "text": "راهنمای ملی انگلستان (National Institute of Health and Care Excellence)"}, {"key": "C", "text": "Kidney Disease: Improving Global Outcomes"}, {"key": "D", "text": "طرح کیفیت پیامدهای بیماری کلیه بنیاد ملی کلیه"}]'::jsonb,
     '[{"left": "1", "right": "C"}, {"left": "2", "right": "D"}, {"left": "3", "right": "A"}, {"left": "4", "right": "B"}]'::jsonb,
     false,
     '["guidelines", "organizations"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q19$هر سناریو را به اصل مدیریتی که بیشترین ارتباط را با آن دارد وصل کنید.$q19$,
     'matching', '[]'::jsonb, null, null,
     '[{"key": "1", "text": "تصمیم‌گیری درباره تغییر درمان پس از یک PTH منفرد بالا در بیمار پایدار"}, {"key": "2", "text": "پیشنهاد محدودیت شدید کلسیم در نوجوان با استناد به مطالعات بزرگسالان"}, {"key": "3", "text": "کودک CKD مرحله ۳ بدون عارضه که والدینش ضرورت درمان را زیر سؤال می‌برند"}, {"key": "4", "text": "بیمار با شرایط پیچیده که توصیه راهنما با وضعیتش همخوانی ندارد"}, {"key": "5", "text": "بیمار با شاخص‌های معدنی طبیعی اما اسیدوز و سوءتغذیه"}]'::jsonb,
     '[{"key": "A", "text": "پیشگیری اولیه"}, {"key": "B", "text": "پیگیری روندها به جای مقادیر منفرد"}, {"key": "C", "text": "اصلاح اختلالات متابولیک"}, {"key": "D", "text": "نیاز اسکلت در حال رشد به کلسیم و تعمیم‌ناپذیری داده‌های بزرگسالان"}, {"key": "E", "text": "تطبیق توصیه‌های ضعیف با قضاوت بالینی و نیاز فردی"}]'::jsonb,
     '[{"left": "1", "right": "B"}, {"left": "2", "right": "D"}, {"left": "3", "right": "A"}, {"left": "4", "right": "E"}, {"left": "5", "right": "C"}]'::jsonb,
     false,
     '["principles", "clinical application"]'::jsonb, 'medium', 3, null);
end $$;
