-- Nephron Board Questions — CKD-MBD Bone Disease After Kidney
-- Transplantation question set (12 MCQ, 8 fill-in-the-blank, 3 matching).
--
-- Part 1 repeats the same schema-upgrade statements from the earlier
-- question sets (harmless no-ops if already applied) so this file also
-- works standalone.
--
-- Part 2 inserts the 23 questions under topic "CKD / CKD-MBD / Bone
-- Disease After Transplant" for your account. Skipped automatically if
-- that topic already has questions, so re-running this file is a no-op
-- (delete the topic's existing rows first if you want to reload it with
-- edits).

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

-- ---------- Part 2: CKD-MBD Bone Disease After Transplant question set ----------
do $$
declare
  v_owner_id uuid;
  v_topic text := 'CKD / CKD-MBD / Bone Disease After Transplant';
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
     $q1$پسر ۱۴ ساله ۹ ماه پس از پیوند کلیه با عملکرد خوب گرافت، پردنیزولون روزانه، تاکرولیموس و مایکوفنولات مصرف می‌کند. PTH حدود ۲ برابر حد بالای نرمال است. به علت درد استخوان بیوپسی انجام شده که ضایعه آدینامیک نشان می‌دهد. کدام تفسیر صحیح‌تر است؟$q1$,
     'mcq',
     '["نمونه‌برداری خطا داشته، چون با PTH بالا ضایعه آدینامیک ممکن نیست","پس از پیوند بین PTH در گردش و turnover استخوان ناهمخوانی دیده می‌شود؛ برخی بیماران با وجود PTH نسبتاً بالا ضایعه آدینامیک پیدا می‌کنند و کورتیکواستروئید نگهدارنده ممکن است نقش علّی داشته باشد","این یافته نشان‌دهنده رد پیوند است","PTH بالا پس از پیوند همیشه با turnover بالا همراه است","علت اصلی، اثر مایکوفنولات است که به‌خوبی ثابت شده است"]'::jsonb,
     1, null, null, null, null, null,
     '["PTH-turnover disconnect","adynamic bone","corticosteroids"]'::jsonb, 'hard', 3,
     $e1$پس از پیوند، ناهمخوانی بین PTH در گردش و turnover استخوان دیده می‌شود. برخی بیماران turnover بالای پایدار دارند و برخی دیگر با وجود PTH نسبتاً بالا ضایعه آدینامیک پیدا می‌کنند. کورتیکواستروئیدهای نگهدارنده ممکن است نقش علّی داشته باشند. نقش مایکوفنولات ارزیابی نشده است.$e1$),

    (v_owner_id, v_topic,
     $q2$تیم پیوند در حال تدوین پروتکل پایش سلامت استخوان در کودکان پیوندی است. بر اساس داده‌های موجود، از دست رفتن قابل‌توجه استخوان پس از پیوند کلیه از چه زمانی ممکن است رخ دهد و پایش باید از چه زمانی مدنظر باشد؟$q2$,
     'mcq',
     '["از ۳ تا ۶ ماه پس از پیوند","فقط پس از ۵ سال","فقط در صورت رد حاد پیوند","پس از قطع کورتیکواستروئید","از دست رفتن استخوان پس از پیوند موفق رخ نمی‌دهد"]'::jsonb,
     0, null, null, null, null, null,
     '["bone loss","timing"]'::jsonb, 'medium', 3,
     $e2$از دست رفتن قابل‌توجه استخوان می‌تواند حتی ۳ تا ۶ ماه پس از پیوند کلیه رخ دهد. با وجود اینکه پیوند موفق بسیاری از اختلالات را اصلاح می‌کند، اختلالات استخوان و مواد معدنی همچنان مشکل عمده‌ای در جمعیت پیوندی هستند.$e2$),

    (v_owner_id, v_topic,
     $q3$دختر ۱۲ ساله که پیش از پیوند استئیت فیبروزا داشته، ۸ ماه پس از پیوند موفق در بیوپسی ستیغ ایلیاک بهبود تغییرات هیپرپاراتیروئیدی را نشان می‌دهد. با این حال pQCT کاهش واضح Z-score محتوای مواد معدنی استخوان را نشان می‌دهد. کدام عبارت صحیح‌تر است؟$q3$,
     'mcq',
     '["بهبود بافتی یعنی محتوای مواد معدنی هم باید طبیعی باشد و pQCT خطا دارد","کاهش Z-score فقط در استخوان ترابکولار دیده می‌شود","تغییرات بافتی هیپرپاراتیروئیدی ظرف ۶ ماه برطرف می‌شود، اما Z-score محتوای مواد معدنی استخوان به‌طور قابل‌توجهی پایین می‌ماند، به‌ویژه در استخوان کورتیکال","تغییرات بافتی هیپرپاراتیروئیدی پس از پیوند هرگز برطرف نمی‌شود","این یافته فقط در بزرگسالان دیده می‌شود"]'::jsonb,
     2, null, null, null, null, null,
     '["bone histology","bone mineral content","cortical bone"]'::jsonb, 'hard', 3,
     $e3$هم در بزرگسالان و هم در کودکان، تغییرات بافتی ستیغ ایلیاک ناشی از هیپرپاراتیروئیدی ثانویه ظرف ۶ ماه پس از پیوند برطرف می‌شود. اما Z-score محتوای مواد معدنی استخوان به‌طور قابل‌توجهی کاهش‌یافته باقی می‌ماند، به‌ویژه در استخوان کورتیکال.$e3$),

    (v_owner_id, v_topic,
     $q4$کدام مورد جزو اثرات کورتیکواستروئیدها بر متابولیسم استخوان و کلسیم نیست؟$q4$,
     'mcq',
     '["کاهش جذب روده‌ای کلسیم","افزایش دفع ادراری کلسیم","مهار فعالیت استئوبلاستی و کاهش تشکیل استخوان","افزایش فعالیت استئوکلاستی و جذب استخوان","افزایش تمایز استئوبلاستی و مینرالیزاسیون"]'::jsonb,
     4, null, null, null, null, null,
     '["corticosteroids","mechanisms"]'::jsonb, 'medium', 2,
     $e4$استروئیدها جذب روده‌ای کلسیم را کاهش و دفع ادراری کلسیم را افزایش می‌دهند. همچنین فعالیت استئوبلاستی و تشکیل استخوان را مهار و فعالیت استئوکلاستی و جذب استخوان را افزایش می‌دهند.$e4$),

    (v_owner_id, v_topic,
     $q5$در جلسه تیم پیوند، درباره اثر داروهای ضد رد پیوند بر استخوان بحث می‌شود. کدام عبارت با شواهد موجود سازگارتر است؟$q5$,
     'mcq',
     '["مایکوفنولات موفتیل اثر خنثی بر استخوان دارد و این در کارآزمایی‌ها ثابت شده است","آزاتیوپرین مهم‌ترین عامل از دست رفتن استخوان پس از پیوند است","کورتیکواستروئیدها اثری بر turnover استخوان ندارند","آزاتیوپرین اثر حداقلی بر remodeling اسکلتی دارد و نقش مایکوفنولات موفتیل به عنوان تعدیل‌کننده تشکیل و جذب استخوان ارزیابی نشده است","همه داروهای ضد رد پیوند اثر یکسانی بر استخوان دارند"]'::jsonb,
     3, null, null, null, null, null,
     '["immunosuppression","azathioprine","mycophenolate"]'::jsonb, 'hard', 3,
     $e5$آزاتیوپرین اثر حداقلی بر remodeling اسکلتی دارد. نقش سایر داروهای ضد رد پیوند، مانند مایکوفنولات موفتیل، به عنوان تعدیل‌کننده تشکیل و جذب استخوان ارزیابی نشده است. کورتیکواستروئیدهای نگهدارنده ممکن است نقش علّی در اختلال turnover داشته باشند.$e5$),

    (v_owner_id, v_topic,
     $q6$کدام‌یک از کودکان پیوندی زیر بیشترین خطر بیماری استخوانی پس از پیوند را دارد؟$q6$,
     'mcq',
     '["پسر ۱۰ ساله با عملکرد فوری و عالی گرافت، PTH طبیعی پیش از پیوند و رژیم بدون استروئید","دختر ۱۵ ساله با تأخیر در عملکرد گرافت و عملکرد ضعیف فعلی، هیپرپاراتیروئیدی ثانویه پایدار، بی‌حرکتی طولانی پس از عوارض جراحی و پردنیزولون روزانه","پسر ۸ ساله با عملکرد خوب گرافت که آزاتیوپرین دریافت می‌کند","دختر ۶ ساله با عملکرد خوب گرافت و فعالیت بدنی طبیعی","پسر ۱۲ ساله ۳ سال پس از پیوند با PTH طبیعی و بدون استروئید"]'::jsonb,
     1, null, null, null, null, null,
     '["risk factors","post-transplant bone disease"]'::jsonb, 'medium', 3,
     $e6$عواملی مانند هیپرپاراتیروئیدی ثانویه پایدار، بی‌حرکتی طولانی و تأخیر یا ضعف عملکرد گرافت بر سلامت استخوان اثر منفی دارند. داروهای ضد رد پیوند، به‌ویژه کورتیکواستروئیدها، نیز در ایجاد بیماری استخوانی پس از پیوند نقش دارند.$e6$),

    (v_owner_id, v_topic,
     $q7$پسری در ۲ سالگی پیوند کلیه شده و اکنون ۷ ساله است. عملکرد گرافت عالی است، اما Height SDS او تقریباً ثابت مانده و رشد جبرانی نداشته است. والدین می‌پرسند چرا با وجود پیوند زودهنگام قد او به همسالان نرسیده است. بهترین پاسخ کدام است؟$q7$,
     'mcq',
     '["پیوند زودهنگام همیشه رشد جبرانی کامل ایجاد می‌کند و حتماً رد مزمن وجود دارد","علت منحصراً ژنتیکی است و ربطی به بیماری کلیوی ندارد","عملکرد بهتر کلیه می‌تواند رشد را تسریع کند، اما رشد جبرانی ممکن است حتی در کودکانی که خیلی زود پیوند شده‌اند دیده نشود. علت چندعاملی است: داروهای ضد رد پیوند، هیپرپاراتیروئیدی پایدار، اختلال متابولیسم ویتامین D و FGF23، و تداوم نقص مینرالیزاسیون","رشد جبرانی فقط پس از قطع کامل همه داروهای ضد رد پیوند رخ می‌دهد","قد کوتاه پس از پیوند فقط ناشی از کمبود هورمون رشد است"]'::jsonb,
     2, null, null, null, null, null,
     '["catch-up growth","early transplantation"]'::jsonb, 'hard', 3,
     $e7$پس از پیوند موفق با رژیم‌های استاندارد، رشد ممکن است با بهبود عملکرد کلیه تسریع شود، اما رشد جبرانی حتی در کودکانی که خیلی زود پیوند شده‌اند ممکن است دیده نشود. علت کاملاً شناخته نشده، اما عوامل متعددی در آن نقش دارند.$e7$),

    (v_owner_id, v_topic,
     $q8$کدام مورد جزو عوامل مطرح در تداوم اختلال رشد پس از پیوند کلیه نیست؟$q8$,
     'mcq',
     '["داروهای ضد رد پیوند","هیپرپاراتیروئیدی ثانویه پایدار","اختلال متابولیسم ویتامین D و FGF23","تداوم نقص مینرالیزاسیون اسکلتی","اصلاح کامل اختلالات معدنی بلافاصله پس از پیوند"]'::jsonb,
     4, null, null, null, null, null,
     '["persistent growth retardation","contributors"]'::jsonb, 'medium', 2,
     $e8$علت تداوم اختلال رشد کاملاً شناخته نشده است. داروهای ضد رد پیوند، هیپرپاراتیروئیدی ثانویه پایدار، اختلال متابولیسم ویتامین D و FGF23، و تداوم نقص مینرالیزاسیون همگی ممکن است نقش داشته باشند.$e8$),

    (v_owner_id, v_topic,
     $q9$دختر ۹ ساله ۲ سال پس از پیوند کلیه Height SDS برابر ۲.۸- دارد و درمان با rhGH برای او آغاز می‌شود. درباره الگوی پاسخ رشدی، کدام مشاوره صحیح‌تر است؟$q9$,
     'mcq',
     '["rhGH پس از پیوند اثری بر رشد ندارد","پاسخ رشدی فقط پس از ۳ سال درمان ظاهر می‌شود","پاسخ رشدی در تمام سال‌های درمان ثابت و یکسان باقی می‌ماند","افزایش قابل‌توجه رشد طولی در سال اول درمان انتظار می‌رود، اما شدت پاسخ ممکن است پس از آن کاهش یابد","پاسخ رشدی به‌تدریج در سال‌های بعد بیشتر می‌شود"]'::jsonb,
     3, null, null, null, null, null,
     '["rhGH","growth response"]'::jsonb, 'medium', 3,
     $e9$مصرف rhGH در کودکان با کمبود قد قابل‌توجه پس از پیوند ممکن است در سال اول درمان افزایش قابل‌توجهی در رشد طولی ایجاد کند، اما شدت پاسخ رشدی ممکن است پس از آن کاهش یابد.$e9$),

    (v_owner_id, v_topic,
     $q10$پسر ۱۶ ساله ۱۸ ماه پس از پیوند، هیپرپاراتیروئیدی شدید و پایدار با هیپرکلسمی خفیف دارد و شروع سیناکلست مطرح شده است. مهم‌ترین نگرانی استخوانی مرتبط با این درمان کدام است؟$q10$,
     'mcq',
     '["تشدید بیماری استخوانی با turnover پایین، حتی در بیمارانی که PTH سرمی بالا دارند","ایجاد استئیت فیبروزا سیستیکا","رسوب اگزالات در مغز استخوان","افزایش حجم ترابکولار","کلسی‌میمتیک‌ها اثری بر turnover استخوان ندارند"]'::jsonb,
     0, null, null, null, null, null,
     '["calcimimetics","low turnover","persistent hyperparathyroidism"]'::jsonb, 'hard', 3,
     $e10$کلسی‌میمتیک‌ها ممکن است در کودکان با هیپرپاراتیروئیدی شدید و پایدار مطرح شوند، اما می‌توانند بیماری استخوانی با turnover پایین را تشدید کنند، حتی در بیمارانی که PTH سرمی بالا دارند.$e10$),

    (v_owner_id, v_topic,
     $q11$دختر ۱۳ ساله پس از درمان یک دوره رد حاد با پالس متیل‌پردنیزولون، پردنیزولون با دوز بالا دریافت می‌کند. در پیگیری، هیپرکلسیوری، تمایل به کلسیم سرم پایین و کاهش شاخص‌های تشکیل استخوان دارد. کدام مجموعه مکانیسم‌ها این یافته‌ها را بهتر توضیح می‌دهد؟$q11$,
     'mcq',
     '["افزایش جذب روده‌ای کلسیم و کاهش دفع ادراری آن","کاهش جذب روده‌ای کلسیم، افزایش دفع ادراری کلسیم و مهار فعالیت استئوبلاستی","تحریک استئوبلاست و مهار استئوکلاست","اثر مستقیم استروئید بر افزایش PTH و turnover بالا بدون اثر بر کلسیم","مهار بیان FGF23 توسط استروئید"]'::jsonb,
     1, null, null, null, null, null,
     '["corticosteroids","hypercalciuria","calcium balance"]'::jsonb, 'hard', 3,
     $e11$استروئیدها جذب روده‌ای کلسیم را کاهش و دفع ادراری کلسیم را افزایش می‌دهند. همچنین فعالیت استئوبلاستی و تشکیل استخوان را مهار و فعالیت استئوکلاستی و جذب استخوان را افزایش می‌دهند.$e11$),

    (v_owner_id, v_topic,
     $q12$کدام عبارت درباره تفسیر PTH سرم در کودکان پس از پیوند کلیه صحیح‌تر است؟$q12$,
     'mcq',
     '["PTH پس از پیوند پیش‌بینی‌کننده دقیق turnover استخوان است","PTH نسبتاً بالا همیشه با turnover بالا همراه است","PTH طبیعی ضایعه آدینامیک را رد می‌کند","PTH فقط در بیماران دیالیزی ارزش تفسیری دارد","ناهمخوانی بین PTH و turnover وجود دارد؛ برخی بیماران turnover بالای پایدار دارند و برخی با وجود PTH نسبتاً بالا ضایعه آدینامیک دارند"]'::jsonb,
     4, null, null, null, null, null,
     '["PTH interpretation","post-transplant"]'::jsonb, 'medium', 2,
     $e12$پس از پیوند، ناهمخوانی بین PTH در گردش و turnover استخوان مشاهده می‌شود. بنابراین PTH به‌تنهایی برای پیش‌بینی turnover استخوان قابل‌اعتماد نیست.$e12$),

    (v_owner_id, v_topic,
     $q13$عواملی مانند هیپرپاراتیروئیدی ثانویه ____، بی‌حرکتی ____ و تأخیر یا ضعف عملکرد ____ ممکن است بر سلامت استخوان پس از پیوند اثر منفی داشته باشند.$q13$,
     'fill_blank', '[]'::jsonb, null,
     '["پایدار", "طولانی", "گرافت"]'::jsonb, null, null, null, null,
     '["risk factors"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q14$از دست رفتن قابل‌توجه استخوان می‌تواند حتی ____ ماه پس از پیوند کلیه رخ دهد.$q14$,
     'fill_blank', '[]'::jsonb, null,
     '["۳–۶"]'::jsonb, null, null, null, null,
     '["bone loss","timing"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q15$تغییرات بافتی ستیغ ایلیاک ناشی از هیپرپاراتیروئیدی ثانویه ظرف ____ ماه پس از پیوند برطرف می‌شود، اما Z-score محتوای مواد معدنی استخوان به‌ویژه در استخوان ____ پایین می‌ماند.$q15$,
     'fill_blank', '[]'::jsonb, null,
     '["۶", "کورتیکال"]'::jsonb, null, null, null, null,
     '["histology","bone mineral content"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q16$استروئیدها جذب روده‌ای کلسیم را ____، دفع ادراری کلسیم را ____، فعالیت استئوبلاستی را ____ و فعالیت استئوکلاستی را ____ می‌دهند.$q16$,
     'fill_blank', '[]'::jsonb, null,
     '["کاهش", "افزایش", "کاهش", "افزایش"]'::jsonb, null, null, null, null,
     '["corticosteroids"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q17$آزاتیوپرین اثر ____ بر remodeling اسکلتی دارد و نقش ____ به عنوان تعدیل‌کننده تشکیل و جذب استخوان ارزیابی نشده است.$q17$,
     'fill_blank', '[]'::jsonb, null,
     '["حداقلی", "مایکوفنولات موفتیل"]'::jsonb, null, null, null, null,
     '["azathioprine","mycophenolate"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q18$رشد ____ پس از پیوند ممکن است حتی در کودکانی که خیلی زود پیوند شده‌اند دیده نشود.$q18$,
     'fill_blank', '[]'::jsonb, null,
     '["جبرانی (catch-up)"]'::jsonb, null, null, null, null,
     '["catch-up growth"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q19$rhGH پس از پیوند ممکن است در ____ درمان افزایش قابل‌توجه رشد طولی ایجاد کند، اما شدت پاسخ پس از آن ممکن است ____ یابد.$q19$,
     'fill_blank', '[]'::jsonb, null,
     '["سال اول", "کاهش"]'::jsonb, null, null, null, null,
     '["rhGH"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q20$کلسی‌میمتیک‌ها در هیپرپاراتیروئیدی شدید و پایدار پس از پیوند ممکن است مطرح شوند، اما می‌توانند بیماری استخوانی با turnover ____ را حتی در بیماران با PTH سرمی ____ تشدید کنند.$q20$,
     'fill_blank', '[]'::jsonb, null,
     '["پایین", "بالا"]'::jsonb, null, null, null, null,
     '["calcimimetics"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q21$هر دارو را به اثر آن بر استخوان یا رشد پس از پیوند وصل کنید.$q21$,
     'matching', '[]'::jsonb, null, null,
     '[{"key":"1","text":"کورتیکواستروئیدها"},{"key":"2","text":"آزاتیوپرین"},{"key":"3","text":"مایکوفنولات موفتیل"},{"key":"4","text":"کلسی‌میمتیک‌ها"},{"key":"5","text":"rhGH"}]'::jsonb,
     '[{"key":"A","text":"اثر حداقلی بر remodeling اسکلتی"},{"key":"B","text":"اثر بر تشکیل و جذب استخوان ارزیابی نشده است"},{"key":"C","text":"افزایش قابل‌توجه رشد در سال اول و کاهش پاسخ پس از آن"},{"key":"D","text":"کاهش جذب روده‌ای کلسیم، مهار استئوبلاست و افزایش جذب استخوان"},{"key":"E","text":"ممکن است turnover پایین را حتی با PTH بالا تشدید کند"}]'::jsonb,
     '[{"left":"1","right":"D"},{"left":"2","right":"A"},{"left":"3","right":"B"},{"left":"4","right":"E"},{"left":"5","right":"C"}]'::jsonb,
     false,
     '["drugs","bone effects"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q22$هر رویداد پس از پیوند را به زمان‌بندی مربوط وصل کنید.$q22$,
     'matching', '[]'::jsonb, null, null,
     '[{"key":"1","text":"از دست رفتن قابل‌توجه استخوان"},{"key":"2","text":"برطرف شدن تغییرات بافتی هیپرپاراتیروئیدی در ستیغ ایلیاک"},{"key":"3","text":"بیشترین پاسخ رشدی به rhGH"}]'::jsonb,
     '[{"key":"A","text":"ظرف ۶ ماه پس از پیوند"},{"key":"B","text":"سال اول درمان"},{"key":"C","text":"حتی ۳ تا ۶ ماه پس از پیوند"}]'::jsonb,
     '[{"left":"1","right":"C"},{"left":"2","right":"A"},{"left":"3","right":"B"}]'::jsonb,
     false,
     '["timeline","post-transplant"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q23$هر سناریوی پس از پیوند را به تفسیر صحیح آن وصل کنید.$q23$,
     'matching', '[]'::jsonb, null, null,
     '[{"key":"1","text":"PTH نسبتاً بالا با ضایعه آدینامیک در بیوپسی"},{"key":"2","text":"بیوپسی طبیعی‌شده ۸ ماه پس از پیوند اما Z-score پایین محتوای مواد معدنی در کورتکس"},{"key":"3","text":"کودکی که در ۲ سالگی پیوند شده و رشد جبرانی نداشته است"},{"key":"4","text":"هیپرپاراتیروئیدی شدید پایدار که سیناکلست برای آن مطرح است"}]'::jsonb,
     '[{"key":"A","text":"بهبود بافتی سریع است، اما کاهش محتوای مواد معدنی، به‌ویژه در استخوان کورتیکال، پایدار می‌ماند"},{"key":"B","text":"خطر تشدید turnover پایین حتی با PTH بالا"},{"key":"C","text":"ناهمخوانی PTH و turnover؛ استروئید نگهدارنده ممکن است نقش علّی داشته باشد"},{"key":"D","text":"رشد جبرانی حتی با پیوند زودهنگام ممکن است رخ ندهد؛ علت چندعاملی است"}]'::jsonb,
     '[{"left":"1","right":"C"},{"left":"2","right":"A"},{"left":"3","right":"D"},{"left":"4","right":"B"}]'::jsonb,
     false,
     '["clinical scenarios","interpretation"]'::jsonb, 'hard', 3, null);
end $$;
