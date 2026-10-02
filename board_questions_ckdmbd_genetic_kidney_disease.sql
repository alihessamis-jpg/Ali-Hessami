-- Nephron Board Questions — CKD-MBD Genetic Kidney Disease & Bone question
-- set (13 MCQ, 9 fill-in-the-blank, 3 matching). Covers the interaction
-- between primary kidney disease and renal bone disease: ADPKD, primary
-- hyperoxaluria, cystinosis, and other genetic syndromes (nephronophthisis/
-- ciliopathies, Pierson syndrome).
--
-- Part 1 repeats the same schema-upgrade statements from the earlier
-- question sets (harmless no-ops if already applied) so this file also
-- works standalone.
--
-- Part 2 inserts the 25 questions under topic "CKD / CKD-MBD / Genetic
-- Kidney Disease & Bone" for your account. Skipped automatically if that
-- topic already has questions, so re-running this file is a no-op (delete
-- the topic's existing rows first if you want to reload it with edits).

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

-- ---------- Part 2: CKD-MBD Genetic Kidney Disease & Bone question set ----------
do $$
declare
  v_owner_id uuid;
  v_topic text := 'CKD / CKD-MBD / Genetic Kidney Disease & Bone';
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
     $q1$دو کودک ۱۰ ساله با CKD مرحله ۴ و eGFR تقریباً برابر، PTH، کلسیم، فسفر و 25D مشابه و در محدوده هدف دارند. کودک اول دیسپلازی کلیه دارد و کودک دوم سیستینوز. کودک دوم شکستگی‌های مکرر و استئوپنی شدیدتری دارد. بهترین توضیح کدام است؟$q1$,
     'mcq',
     '["خطای آزمایشگاهی در اندازه‌گیری PTH کودک دوم","در زیرگروهی از کودکان CKD، بخشی از بیماری استخوانی ناشی از جهش‌های اختصاصی و مستقل از شدت نارسایی کلیه و CKD-MBD است","بیماری استخوانی همیشه متناسب با GFR است و تفاوت تصادفی است","دیسپلازی کلیه اثر محافظتی مستقیم بر استخوان دارد","شدت بیماری استخوانی فقط به سطح PTH بستگی دارد"]'::jsonb,
     1, null, null, null, null, null,
     '["genetic bone disease","general principle"]'::jsonb, 'hard', 3,
     $e1$بیماری‌های ارثی نادر کلیه نشان داده‌اند که بخشی از بیماری استخوانی ممکن است ناشی از جهش‌های اختصاصی و مستقل از شدت نارسایی کلیه و CKD-MBD باشد. بیماری اسکلتی تشدیدشده در سیلیوپاتی‌های اولیه و بیماری‌های ذخیره‌ای شایع است.$e1$),

    (v_owner_id, v_topic,
     $q2$دختر ۱۷ ساله با ADPKD و eGFR حدود 60 در پیگیری، فسفر سرم 2.3 mg/dL، آلکالن فسفاتاز پایین و FGF23 بالا دارد. PTH در حد طبیعی است. کدام تفسیر صحیح‌تر است؟$q2$,
     'mcq',
     '["این الگو نشانه هیپرپاراتیروئیدی اولیه است و باید اسکن پاراتیروئید انجام شود","این الگو به نفع turnover بالای استخوان است","این الگو با یافته‌های مشخصه ADPKD سازگار است: turnover پایین استخوان، آلکالن فسفاتاز پایین، FGF23 بالا و هیپوفسفاتمی قابل‌توجه","هیپوفسفاتمی در این مرحله نشان‌دهنده سندرم فانکونی است","FGF23 بالا در ADPKD فقط پس از رسیدن به ESKD دیده می‌شود"]'::jsonb,
     2, null, null, null, null, null,
     '["ADPKD","FGF23","hypophosphatemia","low turnover"]'::jsonb, 'hard', 3,
     $e2$بالغین مبتلا به ADPKD به‌طور مشخص turnover پایین استخوان، آلکالن فسفاتاز پایین، FGF23 بالا و هیپوفسفاتمی قابل‌توجه دارند. این الگو با CKD معمول که در آن فسفر رو به افزایش است متفاوت است.$e2$),

    (v_owner_id, v_topic,
     $q3$در موش‌هایی که ژن PKD1 یا PKD2 به‌طور شرطی در استئوبلاست‌ها حذف شده است، کدام فنوتیپ استخوانی گزارش شده است؟$q3$,
     'mcq',
     '["استئوپنی با turnover پایین","استئیت فیبروزا با turnover بالا","افزایش حجم ترابکولار","استئوپتروز با تراکم بسیار بالا","فنوتیپ استخوانی طبیعی"]'::jsonb,
     0, null, null, null, null, null,
     '["ADPKD","PKD1","PKD2","animal model"]'::jsonb, 'medium', 2,
     $e3$حذف شرطی PKD1 یا PKD2 در استئوبلاست‌ها در موش به استئوپنی با turnover پایین منجر می‌شود. این یافته نقش مستقیم این ژن‌ها در استخوان را مطرح می‌کند.$e3$),

    (v_owner_id, v_topic,
     $q4$پسر ۹ ساله تحت همودیالیز با PTH کنترل‌شده، سه شکستگی با ترومای خفیف، دفورمیتی اندام و درد شدید استخوانی دارد. بیوپسی استخوان کریستال‌های دوشکستی همراه با واکنش گرانولوماتوز را نشان می‌دهد. محتمل‌ترین تشخیص و محل رسوب کدام است؟$q4$,
     'mcq',
     '["سیستینوز؛ کریستال سیستین درون ماتریکس استخوانی","مسمومیت با آلومینیوم؛ رسوب در جبهه مینرالیزاسیون","آمیلوئیدوز مرتبط با دیالیز؛ رسوب در غضروف مفصلی","هیپراگزالوری اولیه؛ رسوب اگزالات کلسیم (whewellite) در فضای مغز استخوان و نه در ماتریکس استخوانی","هیپراگزالوری اولیه؛ رسوب اگزالات کلسیم منحصراً در ماتریکس استخوان"]'::jsonb,
     3, null, null, null, null, null,
     '["primary hyperoxaluria","bone biopsy","whewellite"]'::jsonb, 'hard', 3,
     $e4$در هیپراگزالوری اولیه، رسوبات اگزالات کلسیم (whewellite) در فضای مغز استخوان تجمع می‌یابند، نه در خود ماتریکس استخوانی، و واکنش گرانولوماتوز آن‌ها را همراهی می‌کند. تظاهرات شامل شکستگی‌های مکرر با ترومای خفیف، دفورمیتی و درد شدید استخوانی است.$e4$),

    (v_owner_id, v_topic,
     $q5$دختر ۸ ساله با هیپراگزالوری اولیه نوع ۱ و ESKD در انتظار پیوند کبد و کلیه است. همودیالیز روزانه شدید برای او آغاز شده، اما درد استخوانی و شکستگی‌ها بدتر شده‌اند. کدام توضیح صحیح است؟$q5$,
     'mcq',
     '["دیالیز شدید اگزالات را کامل برداشت می‌کند و بدتر شدن علائم ناشی از هیپرپاراتیروئیدی است","حتی رژیم‌های همودیالیز شدید اگزالات بسیار کمتری از تولید درون‌زاد برداشت می‌کنند و غلظت اگزالات در گردش در همه این بیماران از حداکثر حلالیت بیشتر است، پس رسوب ادامه می‌یابد","استخوان ظرفیت ذخیره اگزالات ندارد و علائم ناشی از اسیدوز است","دیالیز صفاقی همیشه اگزالات را بیشتر از تولید آن برداشت می‌کند","بدتر شدن علائم ناشی از رسوب اگزالات در ماتریکس استخوانی پس از شروع دیالیز است"]'::jsonb,
     1, null, null, null, null, null,
     '["primary hyperoxaluria","dialysis","oxalate removal"]'::jsonb, 'hard', 3,
     $e5$بیماری استخوانی بالینی در بیماران دیالیزی بدتر می‌شود. حتی رژیم‌های همودیالیز شدید اگزالات بسیار کمتری از مقدار تولید درون‌زاد برداشت می‌کنند و غلظت اگزالات در گردش در همه بیماران تحت دیالیز نگهدارنده شدید از حداکثر غلظت محلول بالاتر است.$e5$),

    (v_owner_id, v_topic,
     $q6$کدام عبارت درباره درگیری استخوان در هیپراگزالوری اولیه نادرست است؟$q6$,
     'mcq',
     '["بیماری اتوزومال مغلوب با اثر زیان‌بار مستقیم بر استخوان است","استخوان می‌تواند مقادیر عظیمی از اگزالات ذخیره کند","استخوان در مجموع شکننده‌تر از حالت طبیعی است","رسوب اگزالات با واکنش گرانولوماتوز همراه است","با شروع دیالیز، بیماری استخوانی بالینی معمولاً بهبود می‌یابد"]'::jsonb,
     4, null, null, null, null, null,
     '["primary hyperoxaluria","bone quality"]'::jsonb, 'medium', 2,
     $e6$بیماری استخوانی بالینی در بیماران تحت دیالیز بدتر می‌شود، چون برداشت اگزالات با دیالیز از تولید درون‌زاد بسیار کمتر است. سایر گزینه‌ها صحیح‌اند.$e6$),

    (v_owner_id, v_topic,
     $q7$پسر ۲ ساله با پلی‌اوری، تأخیر رشد، اسیدوز متابولیک و هیپوفسفاتمی شدید ارجاع شده است. eGFR او تقریباً طبیعی است و رادیوگرافی مچ دست شواهد ریکتز نشان می‌دهد. در این مرحله، مهم‌ترین مکانیسم بیماری استخوانی او کدام است؟$q7$,
     'mcq',
     '["هیپرپاراتیروئیدی ثانویه ناشی از اورمی","رسوب اگزالات در مغز استخوان","توبولوپاتی پروگزیمال کامل (سندرم فانکونی) همراه با اسیدوز و هیپوفسفاتمی عمیق","سمیت سیستئامین با دوز بالا","کاهش حجم استخوان ناشی از کورتیکواستروئید"]'::jsonb,
     2, null, null, null, null, null,
     '["cystinosis","Fanconi syndrome","rickets","early childhood"]'::jsonb, 'hard', 3,
     $e7$بیماران سیستینوز در اوایل کودکی دچار توبولوپاتی پروگزیمال کامل با اسیدوز و هیپوفسفاتمی عمیق (سندرم فانکونی) می‌شوند و ۹۵٪ کوتاهی قد، استئوپنی و ریکتز دارند. بیماری استخوانی اورمیک ناشی از هیپرپاراتیروئیدی ثانویه بعداً، در اواخر دهه اول یا در دهه دوم، اضافه می‌شود.$e7$),

    (v_owner_id, v_topic,
     $q8$دختر ۱۵ ساله با سیستینوز نفروپاتیک که به ESKD رسیده، شکستگی‌های متعدد دارد. کدام عامل جزو مکانیسم‌های شکنندگی استخوان در این بیمار مطرح نیست؟$q8$,
     'mcq',
     '["دفع کلیوی فسفر ناشی از سندرم فانکونی","بیماری استخوانی اورمیک ناشی از هیپرپاراتیروئیدی ثانویه","کمبود سیستینوزین در سلول‌های استخوانی که مستقل از نارسایی کلیه باعث از دست رفتن استخوان می‌شود","اثرات سیستئامین بر عملکرد سلول‌های استخوانی","رسوب اگزالات کلسیم در فضای مغز استخوان"]'::jsonb,
     4, null, null, null, null, null,
     '["cystinosis","multifactorial bone disease"]'::jsonb, 'hard', 3,
     $e8$در سیستینوز، بیماری اولیه و درمان آن با دفع کلیوی فسفر و پیشرفت بیماری کلیوی تعامل دارند و کیفیت استخوان را بسیار شکننده می‌کنند. کمبود سیستینوزین در سلول‌های استخوانی در شرایط in vitro مستقل از نارسایی کلیه باعث از دست رفتن استخوان می‌شود. رسوب اگزالات در مغز استخوان ویژه هیپراگزالوری اولیه است.$e8$),

    (v_owner_id, v_topic,
     $q9$در یک جلسه آموزشی درباره اثر سیستئامین بر استخوان، کدام عبارت بر اساس داده‌های in vitro صحیح است؟$q9$,
     'mcq',
     '["سیستئامین در همه دوزها تمایز استئوبلاست را مهار می‌کند","سیستئامین هیچ اثری بر سلول‌های استخوانی ندارد","دوز پایین سیستئامین اثر ضدجذب دارد و تمایز استئوبلاستی و مینرالیزاسیون را تحریک می‌کند، در حالی که دوز بالا تمایز استئوبلاست را مهار می‌کند","دوز بالای سیستئامین تمایز استئوبلاست و مینرالیزاسیون را تحریک می‌کند","دوز پایین سیستئامین فعالیت استئوکلاست را افزایش می‌دهد"]'::jsonb,
     2, null, null, null, null, null,
     '["cysteamine","osteoblast","dose-dependent effect"]'::jsonb, 'hard', 2,
     $e9$سیستئامین بقای بیمار و کلیه را افزایش و عوارض سیستمیک را کاهش می‌دهد، اما بر عملکرد سلول‌های استخوانی هم اثر دارد. دوزهای پایین اثر ضدجذب دارند و تمایز استئوبلاستی و مینرالیزاسیون را تحریک می‌کنند؛ دوزهای بالا در شرایط in vitro تمایز استئوبلاست را مهار می‌کنند.$e9$),

    (v_owner_id, v_topic,
     $q10$کدام عبارت درباره سیستینوز صحیح است؟$q10$,
     'mcq',
     '["بیماری ذخیره‌ای لیزوزومی اتوزومال مغلوب ناشی از کمبود پروتئین انتقال‌دهنده لیزوزومی سیستین (سیستینوزین) است که به تجمع سیستمیک کریستال‌های سیستین منجر می‌شود","بیماری اتوزومال غالب ناشی از جهش PKD1 است","ESKD در آن ناشی از گلومرولونفریت پرولیفراتیو است","کمتر از ۲۰٪ کودکان کوتاهی قد و ریکتز دارند","سندرم فانکونی فقط در دهه دوم زندگی ظاهر می‌شود"]'::jsonb,
     0, null, null, null, null, null,
     '["cystinosis","pathogenesis","cystinosin"]'::jsonb, 'medium', 2,
     $e10$سیستینوز بیماری ذخیره‌ای لیزوزومی اتوزومال مغلوب با کمبود سیستینوزین است. سندرم فانکونی در اوایل کودکی رخ می‌دهد، ۹۵٪ کودکان کوتاهی قد، استئوپنی و ریکتز دارند، و نفریت بینابینی مزمن پیشرونده به ESKD منجر می‌شود.$e10$),

    (v_owner_id, v_topic,
     $q11$پسر ۱۲ ساله با نفرونوفتیز و ESKD، بیماری استخوانی شدیدتری از آنچه بر اساس PTH، کلسیم و فسفر کنترل‌شده‌اش انتظار می‌رود دارد. بررسی ژنتیک جهش در NPHP6 را نشان می‌دهد. کدام توضیح محتمل‌تر است؟$q11$,
     'mcq',
     '["نفرونوفتیز به علت رسوب کریستال در مغز استخوان باعث بیماری استخوانی می‌شود","جهش NPHP6 از طریق کمبود لامینین β2 در استخوان عمل می‌کند","نقش سیلیای اولیه در این بیماری مطرح می‌کند که بیماران با جهش NPHP6، MKS1 یا MKS3 ممکن است پاتولوژی استخوانی مستقل از نارسایی کلیه داشته باشند","بیماری استخوانی حتماً ناشی از درمان بیش از حد با کلسیتریول است","جهش NPHP6 بر استخوان اثری ندارد و باید به دنبال هیپراگزالوری بود"]'::jsonb,
     2, null, null, null, null, null,
     '["nephronophthisis","ciliopathy","NPHP6","MKS"]'::jsonb, 'hard', 3,
     $e11$داده‌ها درباره سایر بیماری‌های ژنتیک محدود است، اما نقش سیلیای اولیه در بیماری‌هایی مثل نفرونوفتیز مطرح می‌کند که بیماران با جهش NPHP6، MKS1 یا MKS3 ممکن است پاتولوژی استخوانی مستقل از نارسایی کلیه داشته باشند. بیماری اسکلتی تشدیدشده در سیلیوپاتی‌های اولیه شایع است.$e11$),

    (v_owner_id, v_topic,
     $q12$شیرخواری با سندرم نفروتیک مادرزادی و میکروکوری به ESKD رسیده و تحت دیالیز صفاقی است. با وجود کنترل مناسب شاخص‌های CKD-MBD، بیماری اسکلتی او شدید است. کدام توضیح محتمل‌تر است؟$q12$,
     'mcq',
     '["کمبود سیستینوزین در سلول‌های استخوانی","حذف PKD1 در استئوبلاست‌ها","رسوب اگزالات در مغز استخوان","نبود لامینین β2 در استخوان، که بیماری اسکلتی را در سندرم پیرسون تشدید می‌کند","مسمومیت با آلومینیوم ناشی از محلول دیالیز صفاقی"]'::jsonb,
     3, null, null, null, null, null,
     '["Pierson syndrome","laminin beta 2"]'::jsonb, 'hard', 3,
     $e12$نبود لامینین β2 در استخوان ممکن است بیماری اسکلتی را در سندرم پیرسون تشدید کند. سندرم نفروتیک مادرزادی همراه با میکروکوری الگوی بالینی کلاسیک سندرم پیرسون است.$e12$),

    (v_owner_id, v_topic,
     $q13$بیماری اسکلتی تشدیدشده، فراتر از آنچه CKD-MBD توجیه می‌کند، به‌طور شایع در کدام دو گروه از بیماری‌های زمینه‌ای کلیه گزارش شده است؟$q13$,
     'mcq',
     '["گلومرولونفریت‌ها و واسکولیت‌ها","CAKUT و ریفلاکس نفروپاتی","سندرم همولیتیک اورمیک و نفریت لوپوسی","نفروپاتی ایسکمیک و نفروپاتی دیابتی","سیلیوپاتی‌های اولیه و بیماری‌های ذخیره‌ای"]'::jsonb,
     4, null, null, null, null, null,
     '["ciliopathy","storage disease","skeletal disease"]'::jsonb, 'medium', 2,
     $e13$بیماری اسکلتی تشدیدشده در بیماران با سیلیوپاتی‌های اولیه و بیماری‌های ذخیره‌ای زمینه‌ای شایع است. پژوهش درباره تعامل ژنتیک و بیماری استخوانی در همه کودکان با بیماری کلیه ادامه دارد.$e13$),

    (v_owner_id, v_topic,
     $q14$بیماری اسکلتی تشدیدشده در بیماران با ____ اولیه و بیماری‌های ____ زمینه‌ای شایع است.$q14$,
     'fill_blank', '[]'::jsonb, null,
     '["سیلیوپاتی‌های", "ذخیره‌ای"]'::jsonb, null, null, null, null,
     '["genetic bone disease"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q15$بالغین مبتلا به ADPKD به‌طور مشخص turnover ____ استخوان، آلکالن فسفاتاز ____، FGF23 ____ و ____ قابل‌توجه دارند.$q15$,
     'fill_blank', '[]'::jsonb, null,
     '["پایین", "پایین", "بالا", "هیپوفسفاتمی"]'::jsonb, null, null, null, null,
     '["ADPKD"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q16$در هیپراگزالوری اولیه، رسوبات اگزالات کلسیم به شکل ____ در فضای ____ تجمع می‌یابند و با واکنش ____ همراه‌اند.$q16$,
     'fill_blank', '[]'::jsonb, null,
     '["whewellite", "مغز استخوان", "گرانولوماتوز"]'::jsonb, null, null, null, null,
     '["primary hyperoxaluria","whewellite"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q17$هیپراگزالوری اولیه یک نقص ____ با اثر زیان‌بار ____ بر استخوان است.$q17$,
     'fill_blank', '[]'::jsonb, null,
     '["اتوزومال مغلوب", "مستقیم"]'::jsonb, null, null, null, null,
     '["primary hyperoxaluria","inheritance"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q18$سیستینوز ناشی از کمبود پروتئین انتقال‌دهنده لیزوزومی سیستین به نام ____ است.$q18$,
     'fill_blank', '[]'::jsonb, null,
     '["سیستینوزین"]'::jsonb, null, null, null, null,
     '["cystinosis","cystinosin"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q19$در سیستینوز، ____ درصد کودکان کوتاهی قد، استئوپنی و ریکتز دارند.$q19$,
     'fill_blank', '[]'::jsonb, null,
     '["۹۵"]'::jsonb, null, null, null, null,
     '["cystinosis","growth","rickets"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q20$در سیستینوز، نفریت ____ مزمن پیشرونده به ESKD منجر می‌شود و بیماری استخوانی اورمیک ناشی از هیپرپاراتیروئیدی ثانویه در اواخر دهه ____ یا در دهه ____ زندگی اضافه می‌شود.$q20$,
     'fill_blank', '[]'::jsonb, null,
     '["بینابینی", "اول", "دوم"]'::jsonb, null, null, null, null,
     '["cystinosis","ESKD","secondary hyperparathyroidism"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q21$بیماران با جهش در ژن‌های ____، ____ یا ____ ممکن است پاتولوژی استخوانی مستقل از نارسایی کلیه داشته باشند.$q21$,
     'fill_blank', '[]'::jsonb, null,
     '["NPHP6", "MKS1", "MKS3"]'::jsonb, null, null, null, null,
     '["nephronophthisis","genes"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q22$بیماری اسکلتی در سندرم پیرسون ممکن است با نبود ____ در استخوان تشدید شود.$q22$,
     'fill_blank', '[]'::jsonb, null,
     '["لامینین β2"]'::jsonb, null, null, null, null,
     '["Pierson syndrome"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q23$هر بیماری را به ویژگی استخوانی مشخصه آن وصل کنید.$q23$,
     'matching', '[]'::jsonb, null, null,
     '[{"key":"1","text":"ADPKD"},{"key":"2","text":"هیپراگزالوری اولیه"},{"key":"3","text":"سیستینوز"},{"key":"4","text":"نفرونوفتیز (NPHP6، MKS1، MKS3)"},{"key":"5","text":"سندرم پیرسون"}]'::jsonb,
     '[{"key":"A","text":"رسوب whewellite در فضای مغز استخوان همراه با واکنش گرانولوماتوز"},{"key":"B","text":"turnover پایین، آلکالن فسفاتاز پایین، FGF23 بالا و هیپوفسفاتمی"},{"key":"C","text":"تشدید بیماری اسکلتی به علت نبود لامینین β2 در استخوان"},{"key":"D","text":"سندرم فانکونی در اوایل کودکی، ریکتز در ۹۵٪، و از دست رفتن استخوان ناشی از کمبود سیستینوزین در سلول‌های استخوانی"},{"key":"E","text":"پاتولوژی استخوانی مستقل از نارسایی کلیه مرتبط با سیلیای اولیه"}]'::jsonb,
     '[{"left":"1","right":"B"},{"left":"2","right":"A"},{"left":"3","right":"D"},{"left":"4","right":"E"},{"left":"5","right":"C"}]'::jsonb,
     false,
     '["genetic diseases","bone phenotype"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q24$هر ژن یا پروتئین را به بیماری مربوط وصل کنید.$q24$,
     'matching', '[]'::jsonb, null, null,
     '[{"key":"1","text":"PKD1 / PKD2"},{"key":"2","text":"سیستینوزین"},{"key":"3","text":"لامینین β2"},{"key":"4","text":"NPHP6"},{"key":"5","text":"MKS3"}]'::jsonb,
     '[{"key":"A","text":"سندرم پیرسون"},{"key":"B","text":"ADPKD"},{"key":"C","text":"سیستینوز"},{"key":"D","text":"سیلیوپاتی (نفرونوفتیز و طیف مرتبط)"}]'::jsonb,
     '[{"left":"1","right":"B"},{"left":"2","right":"C"},{"left":"3","right":"A"},{"left":"4","right":"D"},{"left":"5","right":"D"}]'::jsonb,
     true,
     '["genes","proteins"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q25$در سیستینوز، هر عامل را به اثر آن بر استخوان وصل کنید.$q25$,
     'matching', '[]'::jsonb, null, null,
     '[{"key":"1","text":"سیستئامین با دوز پایین"},{"key":"2","text":"سیستئامین با دوز بالا (in vitro)"},{"key":"3","text":"سندرم فانکونی در اوایل کودکی"},{"key":"4","text":"پیشرفت به ESKD در اواخر دهه اول یا دهه دوم"},{"key":"5","text":"کمبود سیستینوزین در سلول‌های استخوانی"}]'::jsonb,
     '[{"key":"A","text":"مهار تمایز استئوبلاست"},{"key":"B","text":"اثر ضدجذب و تحریک تمایز استئوبلاستی و مینرالیزاسیون"},{"key":"C","text":"فنوتیپ از دست رفتن استخوان، مستقل از نارسایی کلیه"},{"key":"D","text":"ریکتز ناشی از اسیدوز و هیپوفسفاتمی عمیق"},{"key":"E","text":"اضافه شدن بیماری استخوانی اورمیک ناشی از هیپرپاراتیروئیدی ثانویه"}]'::jsonb,
     '[{"left":"1","right":"B"},{"left":"2","right":"A"},{"left":"3","right":"D"},{"left":"4","right":"E"},{"left":"5","right":"C"}]'::jsonb,
     false,
     '["cystinosis","cysteamine","timeline"]'::jsonb, 'hard', 3, null);
end $$;
