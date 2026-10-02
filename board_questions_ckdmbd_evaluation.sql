-- Nephron Board Questions — CKD-MBD Evaluation of Renal Bone Disease
-- question set (22 MCQ, 14 fill-in-the-blank, 4 matching). Covers European
-- guideline scope, routine vs. research biomarkers/imaging, PTH targets
-- (KDIGO, EPDWG, IPPN, the 161-child PD study), and bone imaging indications.
--
-- Part 1 repeats the same schema-upgrade statements from the earlier
-- question sets (harmless no-ops if already applied) so this file also
-- works standalone.
--
-- Part 2 inserts the 40 questions under topic "CKD / CKD-MBD / Evaluation
-- of Renal Bone Disease" for your account. Skipped automatically if that
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

-- ---------- Part 2: CKD-MBD Evaluation of Renal Bone Disease question set ----------
do $$
declare
  v_owner_id uuid;
  v_topic text := 'CKD / CKD-MBD / Evaluation of Renal Bone Disease';
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
     $q1$پسر ۸ ساله با CKD مرحله ۳ برای اولین بار به درمانگاه نفرولوژی ارجاع شده است. بر اساس راهنمای گروه‌های کاری اروپایی CKD-MBD و دیالیز، کدام مجموعه ارزیابی بالینی در شروع و فواصل منظم توصیه می‌شود؟$q1$,
     'mcq',
     '["DXA سالانه ستون فقرات و کل بدن","اندازه‌گیری قد، سرعت رشد، فشار خون و معاینه اسکلتی‌عضلانی با تمرکز بر درد استخوان، دفورمیتی و شکستگی، همراه با ارزیابی دریافت کلسیم از رژیم غذایی، مکمل‌ها و P-binderها","بیوپسی استخوان پایه برای همه بیماران CKD مرحله ۳","اندازه‌گیری cIMT و سرعت موج نبض در هر ویزیت","فقط اندازه‌گیری قد در زمان شروع دیالیز"]'::jsonb,
     1, null, null, null, null, null,
     '["European guideline","clinical evaluation"]'::jsonb, 'medium', 3,
     $e1$ارزیابی بالینی قد، سرعت رشد، فشار خون و معاینه اسکلتی‌عضلانی با تمرکز بر درد استخوان، دفورمیتی و شکستگی باید در شروع و در فواصل منظم انجام شود. دریافت کلسیم از رژیم غذایی، مکمل‌ها و P-binderها نیز باید به‌طور منظم ارزیابی شود. تصویربرداری استخوان، بیوپسی و ارزیابی قلبی‌عروقی ابزارهای تحقیقاتی‌اند.$e1$),

    (v_owner_id, v_topic,
     $q2$سه کودک با CKD مرحله ۴ در درمانگاه پیگیری می‌شوند: شیرخوار ۸ ماهه، کودک ۷ ساله و نوجوان ۱۳ ساله در جهش رشد بلوغ. بر اساس راهنمای اروپایی، کدام کودکان به ارزیابی بالینی مکرر‌تری نیاز دارند؟$q2$,
     'mcq',
     '["فقط کودک ۷ ساله","هر سه با فاصله یکسان","شیرخوار ۸ ماهه و نوجوان ۱۳ ساله","فقط نوجوان ۱۳ ساله","فقط شیرخوار ۸ ماهه"]'::jsonb,
     2, null, null, null, null, null,
     '["frequency of assessment","rapid growth"]'::jsonb, 'medium', 3,
     $e2$ارزیابی باید در دوره‌های رشد سریع، مانند شیرخوارگی و نوجوانی، مکرر‌تر انجام شود.$e2$),

    (v_owner_id, v_topic,
     $q3$فلوی نفرولوژی برای دختر ۱۰ ساله با CKD مرحله ۴ این آزمایش‌ها را درخواست کرده است: کلسیم، فسفر، PTH، 25(OH)D، آلکالن فسفاتاز، FGF23، اسکلروستین و آلکالن فسفاتاز اختصاصی استخوان. بر اساس راهنمای اروپایی، کدام عبارت صحیح است؟$q3$,
     'mcq',
     '["همه این آزمایش‌ها باید به‌طور روتین در هر ویزیت اندازه‌گیری شوند","FGF23 مهم‌ترین شاخص روتین برای تصمیم‌گیری درمانی است","فقط PTH لازم است و سایر شاخص‌ها اضافی‌اند","شاخص‌های سنتی (Ca، P، PTH، 25D و ALP) در فواصل منظم اندازه‌گیری می‌شوند و سایر بیومارکرها فقط برای اهداف تحقیقاتی‌اند","اسکلروستین جایگزین بیوپسی استخوان است"]'::jsonb,
     3, null, null, null, null, null,
     '["biomarkers","routine vs research"]'::jsonb, 'medium', 3,
     $e3$شاخص‌های بیوشیمیایی سنتی متابولیسم مواد معدنی، شامل Ca، P، PTH، 25D و ALP، باید در فواصل منظم اندازه‌گیری شوند. سایر بیومارکرها فقط برای اهداف تحقیقاتی اندازه‌گیری می‌شوند.$e3$),

    (v_owner_id, v_topic,
     $q4$رزیدنتی برای همه کودکان دیالیزی بخش، DXA سالانه، CT عروق کرونر، cIMT و سرعت موج نبض درخواست می‌کند. بر اساس راهنمای اروپایی، بهترین پاسخ کدام است؟$q4$,
     'mcq',
     '["این روش‌ها ابزارهای تحقیقاتی‌اند و برای عملکرد بالینی روتین توصیه نمی‌شوند","این روش‌ها برای همه کودکان دیالیزی الزامی‌اند","فقط CT کرونر به‌طور روتین توصیه می‌شود","DXA به‌طور روتین توصیه می‌شود، چون خطر شکستگی را دقیق پیش‌بینی می‌کند","این روش‌ها فقط در CKD مرحله ۲ کاربرد دارند"]'::jsonb,
     0, null, null, null, null, null,
     '["imaging","cardiovascular evaluation","research tools"]'::jsonb, 'medium', 3,
     $e4$تصویربرداری استخوان (DXA یا pQCT/HR-pQCT)، بیوپسی استخوان و ارزیابی قلبی‌عروقی (CT کرونر، cIMT و سرعت موج نبض) ابزارهای تحقیقاتی‌اند و در عملکرد روتین توصیه نمی‌شوند.$e4$),

    (v_owner_id, v_topic,
     $q5$آزمایشگاه برای پسر ۱۴ ساله در جهش رشد بلوغ با CKD مرحله ۳، آلکالن فسفاتاز را «بالا» گزارش کرده است، چون با محدوده مرجع بزرگسالان مقایسه شده است. کدام اقدام صحیح‌تر است؟$q5$,
     'mcq',
     '["شروع فوری درمان هیپرپاراتیروئیدی","درخواست بیوپسی استخوان","نادیده گرفتن ALP، چون در CKD ارزشی ندارد","تکرار ALP با روش بزرگسالان","تفسیر ALP با محدوده مرجع وابسته به سن و جنس، چون محدوده طبیعی ALP هم وابسته به سن و هم اختصاصی جنس است"]'::jsonb,
     4, null, null, null, null, null,
     '["alkaline phosphatase","reference ranges"]'::jsonb, 'hard', 3,
     $e5$محدوده طبیعی فسفر، کلسیم و ALP سرم وابسته به سن است و ALP علاوه بر سن به جنس هم وابسته است. مقایسه با محدوده بزرگسالان در نوجوان در حال رشد گمراه‌کننده است.$e5$),

    (v_owner_id, v_topic,
     $q6$دختر ۹ ساله با CKD مرحله ۴ بیکربنات سرم 17 mEq/L دارد. Ca، P و PTH در محدوده قابل‌قبول‌اند. کدام عبارت صحیح است؟$q6$,
     'mcq',
     '["بیکربنات در CKD-MBD اهمیتی ندارد","بیکربنات فقط در بیماران دیالیزی پایش می‌شود","بیکربنات سرم باید به‌طور منظم پایش و در محدوده طبیعی حفظ شود، چون اسیدوز بر عملکرد کلیه و سلامت اسکلت اثر زیان‌بار دارد","اسیدوز خفیف برای استخوان محافظتی است","اصلاح اسیدوز فقط در صورت شکستگی لازم است"]'::jsonb,
     2, null, null, null, null, null,
     '["bicarbonate","acidosis"]'::jsonb, 'medium', 3,
     $e6$به علت اثرات زیان‌بار اسیدوز بر عملکرد کلیه و سلامت اسکلت، بیکربنات سرم باید به‌طور منظم پایش و در محدوده طبیعی حفظ شود.$e6$),

    (v_owner_id, v_topic,
     $q7$پسر ۱۱ ساله تحت همودیالیز است. حد بالای نرمال PTH در کیت آزمایشگاه شما 65 pg/mL است. بر اساس توصیه KDIGO، محدوده هدف PTH او کدام است؟$q7$,
     'mcq',
     '["65 تا 130 pg/mL","130 تا 195 pg/mL","110 تا 195 pg/mL","130 تا 585 pg/mL","195 تا 650 pg/mL"]'::jsonb,
     3, null, null, null, null, null,
     '["KDIGO","PTH target","calculation"]'::jsonb, 'hard', 3,
     $e7$KDIGO حفظ PTH را بین ۲ تا ۹ برابر حد بالای نرمال پیشنهاد می‌کند (۲ × ۶۵ = ۱۳۰ و ۹ × ۶۵ = ۵۸۵). گزینه B (۲ تا ۳ برابر) هدف EPDWG است.$e7$),

    (v_owner_id, v_topic,
     $q8$دختر ۷ ساله تحت دیالیز صفاقی است و مرکز شما از توصیه EPDWG (2006) پیروی می‌کند. حد بالای نرمال PTH در کیت 60 pg/mL است. کدام محدوده هدف صحیح است؟$q8$,
     'mcq',
     '["120 تا 180 pg/mL","120 تا 540 pg/mL","60 تا 120 pg/mL","180 تا 300 pg/mL","زیر 60 pg/mL"]'::jsonb,
     0, null, null, null, null, null,
     '["EPDWG","PTH target","calculation"]'::jsonb, 'hard', 3,
     $e8$EPDWG در سال ۲۰۰۶ پیشنهاد کرد PTH در کودکان دیالیزی بین ۲ تا ۳ برابر حد بالای نرمال (۱۲۰ تا ۱۸۰ pg/mL) حفظ شود.$e8$),

    (v_owner_id, v_topic,
     $q9$پسر ۹ ساله‌ای که ۲ ماه است دیالیز را شروع کرده، PTH حدود 250 pg/mL دارد (در محدوده KDIGO). به علت درد استخوان بیوپسی انجام شده و ضایعه turnover بالا نشان می‌دهد. کدام توضیح با داده‌های موجود سازگارتر است؟$q9$,
     'mcq',
     '["ضایعه turnover بالا با PTH در محدوده KDIGO غیرممکن است و بیوپسی خطا دارد","ضایعات turnover بالا ممکن است در سطوح پایین‌تر PTH رخ دهند، به‌ویژه در کودکانی که تازه دیالیز را شروع کرده‌اند؛ این یکی از دلایل پیشنهاد هدف پایین‌تر توسط EPDWG بود","علت turnover بالا مقاومت اسکلتی به PTH است","این یافته فقط با PTH بالای ۵۴۰ ممکن است","این ضایعه حتماً ناشی از آلومینیوم است"]'::jsonb,
     1, null, null, null, null, null,
     '["high turnover","new to dialysis","PTH"]'::jsonb, 'hard', 3,
     $e9$پس از تدوین راهنمای KDIGO، داده‌های جدید نشان داد ضایعات turnover بالا ممکن است در سطوح پایین‌تر PTH رخ دهند، به‌ویژه در کودکانی که تازه دیالیز را شروع کرده‌اند. این داده‌ها، همراه با داده‌های IPPN، پایه پیشنهاد هدف ۲ تا ۳ برابر EPDWG بود.$e9$),

    (v_owner_id, v_topic,
     $q10$در داده‌های شبکه بین‌المللی ثبت دیالیز صفاقی کودکان (IPPN)، سطوح PTH بالاتر از محدوده بهینه با افزایش کدام مورد همراه نبود؟$q10$,
     'mcq',
     '["درد استخوان","دفورمیتی اندام","کلسیفیکاسیون خارج استخوانی","شواهد رادیولوژیک استئومالاسی یا استئوپنی","بهبود کیفیت استخوان و افزایش قد نهایی"]'::jsonb,
     4, null, null, null, null, null,
     '["IPPN","PTH","outcomes"]'::jsonb, 'hard', 2,
     $e10$در داده‌های IPPN، محدوده PTH بین ۱.۷ تا ۳ برابر حد بالای نرمال (۱۰۰ تا ۱۸۰ pg/mL) با کیفیت بهینه استخوان همراه بود. سطوح بالاتر با افزایش درد استخوان، دفورمیتی اندام، کلسیفیکاسیون خارج استخوانی و شواهد رادیولوژیک استئومالاسی یا استئوپنی همراه بودند.$e10$),

    (v_owner_id, v_topic,
     $q11$توصیه KDIGO برای هدف PTH بین ۲ تا ۹ برابر حد بالای نرمال در کودکان دیالیزی بر کدام شواهد استوار بود؟$q11$,
     'mcq',
     '["داده‌های بافت‌شناسی دهه ۱۹۹۰ که اختلال رشد شدیدتر را در PTH زیر 300 pg/mL نشان داد، و یک کارآزمایی تصادفی آینده‌نگر که اثر P-binderها و تجویز متناوب آنالوگ‌های ویتامین D را بر کنترل ضایعات هیپرپاراتیروئیدی مقایسه کرد","داده‌های IPPN درباره کیفیت بهینه استخوان","مطالعات DXA در کودکان دیالیزی","داده‌های مرگ‌ومیر قلبی‌عروقی در کودکان","مطالعه مقطعی ۱۶۱ کودک تحت دیالیز صفاقی"]'::jsonb,
     0, null, null, null, null, null,
     '["KDIGO","evidence basis"]'::jsonb, 'hard', 2,
     $e11$توصیه KDIGO بر داده‌های بافت‌شناسی دهه ۱۹۹۰ و یک کارآزمایی تصادفی آینده‌نگر مقایسه P-binderها و ویتامین D متناوب استوار بود. داده‌های IPPN و مطالعه ۱۶۱ کودک پس از آن منتشر شدند.$e11$),

    (v_owner_id, v_topic,
     $q12$چهار کودک تحت دیالیز صفاقی بررسی می‌شوند. بر اساس مطالعه مقطعی روی ۱۶۱ کودک PD، کدام بیمار به احتمال بیشتر turnover طبیعی همراه با مینرالیزاسیون طبیعی دارد؟$q12$,
     'mcq',
     '["PTH برابر 650 pg/mL و ALP کل برابر 520 IU/L","PTH برابر 450 pg/mL و ALP کل برابر 350 IU/L","PTH برابر 320 pg/mL و ALP کل برابر 300 IU/L","PTH برابر 350 pg/mL و ALP کل برابر 480 IU/L","PTH برابر 800 pg/mL و ALP کل برابر 250 IU/L"]'::jsonb,
     2, null, null, null, null, null,
     '["PTH + ALP combination","peritoneal dialysis"]'::jsonb, 'hard', 3,
     $e12$در این مطالعه، PTH زیر 400 pg/mL همراه با ALP کل زیر 400 IU/L بالاترین میزان پیش‌بینی صحیح را برای بیماران با turnover طبیعی و مینرالیزاسیون طبیعی داشت. فقط گزینه C هر دو معیار را دارد.$e12$),

    (v_owner_id, v_topic,
     $q13$در مطالعه ۱۶۱ کودک تحت دیالیز صفاقی، بیماران با نقص مینرالیزاسیون، صرف‌نظر از وضعیت turnover استخوان، چه الگوی بیوشیمیایی داشتند؟$q13$,
     'mcq',
     '["PTH پایین‌تر و کلسیم بالاتر","PTH و کلسیم طبیعی","فسفر پایین‌تر و ALP پایین‌تر","PTH بالاتر و کلسیم سرم پایین‌تر","PTH پایین‌تر و کلسیم پایین‌تر"]'::jsonb,
     3, null, null, null, null, null,
     '["defective mineralization","biochemical profile"]'::jsonb, 'hard', 2,
     $e13$در این مطالعه، سطح PTH بالاتر و کلسیم سرم پایین‌تر در بیماران با نقص مینرالیزاسیون، صرف‌نظر از turnover استخوان، دیده شد. بنابراین روند PTH و ALP با هم باید درمان را هدایت کنند و Ca و P در محدوده طبیعی حفظ شوند.$e13$),

    (v_owner_id, v_topic,
     $q14$دختر ۱۲ ساله با CKD مرحله ۳ PTH حدود ۱.۵ برابر حد بالای نرمال دارد. همکار شما معتقد است چون در دیالیز PTH بالاتر از نرمال لازم است، این سطح نیاز به اقدام ندارد. کدام عبارت با شواهد تصویربرداری استخوان سازگارتر است؟$q14$,
     'mcq',
     '["شواهد تصویربرداری به نفع کنترل دقیق PTH در CKD پیش از دیالیز است؛ تراکم حجمی مواد معدنی کورتیکال در بیماران با PTH بالا به‌طور قابل‌توجهی کمتر است و Z-score پایین BMD کورتیکال شکستگی‌های بعدی را پیش‌بینی می‌کند","PTH بالا در CKD پیش از دیالیز با افزایش BMD کورتیکال همراه است","در CKD پیش از دیالیز هدف PTH بین ۲ تا ۹ برابر حد بالای نرمال است","BMD کورتیکال ارتباطی با شکستگی ندارد","داده‌های فراوانی هدف PTH را در CKD پیش از دیالیز به‌طور قطعی مشخص کرده‌اند"]'::jsonb,
     0, null, null, null, null, null,
     '["pre-dialysis CKD","PTH control","cortical BMD"]'::jsonb, 'hard', 3,
     $e14$در CKD پیش از دیالیز، داده‌ها برای تعیین هدف بهینه PTH اندک‌اند. داده‌های تصویربرداری به نفع کنترل دقیق PTH است: Z-score پایین BMD کورتیکال شکستگی‌های بعدی را پیش‌بینی می‌کند و تراکم حجمی کورتیکال در بیماران با PTH بالا به‌طور قابل‌توجهی کمتر از بیماران با PTH طبیعی است.$e14$),

    (v_owner_id, v_topic,
     $q15$PTH پسر ۱۳ ساله دیالیزی در سه ماه گذشته حدود 200 pg/mL بوده و ناگهان 380 pg/mL گزارش شده است. سایر شاخص‌ها و وضعیت بالینی تغییری نکرده‌اند و معلوم می‌شود آزمایشگاه کیت PTH خود را عوض کرده است. بهترین اقدام کدام است؟$q15$,
     'mcq',
     '["افزایش فوری دوز ویتامین D فعال","شروع سیناکلست","توجه به اینکه روش‌های مختلف اندازه‌گیری PTH ممکن است نتایج متناقض بدهند و تفسیر روند با همان روش؛ شواهد محدودی وجود دارد که روش‌های جدیدتر ارزیابی turnover را بهتر کنند","درخواست بیوپسی فوری استخوان","پاراتیروئیدکتومی"]'::jsonb,
     2, null, null, null, null, null,
     '["PTH assays","discrepancy"]'::jsonb, 'medium', 3,
     $e15$روش‌های مختلف اندازه‌گیری PTH ممکن است نتایج متناقض بدهند و شواهد محدودی وجود دارد که روش‌های جدیدتر ارزیابی turnover را نسبت به روش‌های قدیمی بهبود دهند. تصمیم‌گیری باید بر اساس روند PTH، Ca و P در کنار هم باشد.$e15$),

    (v_owner_id, v_topic,
     $q16$چرا در بیماران CKD شدید، سطح PTH بالاتر از محدوده طبیعی برای حفظ سرعت طبیعی تشکیل استخوان لازم است؟$q16$,
     'mcq',
     '["به علت افزایش کلیرانس کلیوی PTH","به علت مقاومت اسکلتی به PTH که با پیشرفت CKD ایجاد می‌شود","چون PTH در CKD شدید اثر مهاری بر استئوبلاست دارد","به علت کاهش FGF23 در CKD شدید","چون کیت‌های PTH در CKD شدید مقادیر را کمتر نشان می‌دهند"]'::jsonb,
     1, null, null, null, null, null,
     '["PTH resistance","target above normal"]'::jsonb, 'medium', 2,
     $e16$به علت مقاومت اسکلتی به PTH که با پیشرفت CKD ایجاد می‌شود، سطوح PTH بالاتر از محدوده طبیعی برای حفظ سرعت طبیعی تشکیل استخوان در CKD شدید لازم است.$e16$),

    (v_owner_id, v_topic,
     $q17$در هیپرپاراتیروئیدی ثانویه کنترل‌نشده، کدام مکانیسم ارتباط PTH بالا را با هر دو عارضه استئیت فیبروزا و کلسیفیکاسیون عروقی بهتر توضیح می‌دهد؟$q17$,
     'mcq',
     '["PTH بالای پایدار باعث خروج کلسیم و فسفر از استخوان می‌شود و این امر به اثرات زیان‌بار بر اسکلت، قلب و عروق کمک می‌کند","PTH مستقیماً باعث رسوب اگزالات در عروق می‌شود","PTH جذب استخوان را مهار می‌کند","PTH بالا دفع فسفر را در CKD شدید افزایش می‌دهد و کلسیفیکاسیون را کم می‌کند","PTH اثری بر عروق ندارد"]'::jsonb,
     0, null, null, null, null, null,
     '["uncontrolled hyperparathyroidism","vascular calcification"]'::jsonb, 'medium', 2,
     $e17$هیپرپاراتیروئیدی ثانویه کنترل‌نشده با سطوح بالای پایدار PTH مشخص می‌شود که باعث خروج کلسیم و فسفر از استخوان می‌شود. این امر به اثرات زیان‌بار بر اسکلت (استئیت فیبروزا)، قلب و عروق (کلسیفیکاسیون عروقی) کمک می‌کند.$e17$),

    (v_owner_id, v_topic,
     $q18$پسر ۱۳ ساله تحت همودیالیز با PTH بالا از چند هفته پیش لنگش و درد ران و زانوی راست دارد. کدام اقدام تصویربرداری مناسب‌تر است؟$q18$,
     'mcq',
     '["DXA کل بدن","pQCT تیبیا","MRI به عنوان اولین اقدام روتین","سونوگرافی کیفیت استخوان","رادیوگرافی ساده برای ارزیابی لغزش اپی‌فیز پروگزیمال فمور یا نکروز آواسکولار"]'::jsonb,
     4, null, null, null, null, null,
     '["conventional radiograph","SCFE","indications"]'::jsonb, 'hard', 3,
     $e18$رادیوگرافی ساده در بیماران با تظاهرات بالینی مطرح‌کننده نکروز آواسکولار یا لغزش اپی‌فیز پروگزیمال فمور مفید است. DXA، pQCT، MRI و سونوگرافی کیفیت استخوان در پروتکل‌های تحقیقاتی به کار می‌روند.$e18$),

    (v_owner_id, v_topic,
     $q19$برای دختر ۱۱ ساله با CKD مرحله ۴ که کاندید rhGH است، می‌خواهید سن استخوانی و قد نهایی پیش‌بینی‌شده را تعیین کنید. کدام روش صحیح است؟$q19$,
     'mcq',
     '["DXA ستون فقرات کمری","رادیوگرافی مچ دست چپ و محاسبه قد نهایی پیش‌بینی‌شده با سیستم خودکار تعیین سن استخوانی Greulich-Pyle","رادیوگرافی زانو","pQCT رادیوس","رادیوگرافی جمجمه"]'::jsonb,
     1, null, null, null, null, null,
     '["bone age","predicted adult height"]'::jsonb, 'medium', 3,
     $e19$سن اسکلتی را می‌توان با رادیوگرافی مچ دست چپ تعیین کرد و قد نهایی پیش‌بینی‌شده را با سیستم خودکار Greulich-Pyle محاسبه کرد.$e19$),

    (v_owner_id, v_topic,
     $q20$شیرخوار ۱۸ ماهه با CKD مرحله ۴ و ALP بالا دارای ژنو واروم و پهن شدن مچ‌ها است. برای ارزیابی ناحیه متافیزی فعال، کدام تصویربرداری مناسب‌تر است؟$q20$,
     'mcq',
     '["رادیوگرافی زانو","DXA کل بدن","HR-pQCT","رادیوگرافی مچ دست چپ برای سن استخوانی","بیوپسی استخوان"]'::jsonb,
     0, null, null, null, null, null,
     '["knee radiograph","infants","metaphysis"]'::jsonb, 'medium', 3,
     $e20$در شیرخواران و کودکان کم‌سن، رادیوگرافی زانو برای ارزیابی ناحیه متافیزی فعال به کار می‌رود.$e20$),

    (v_owner_id, v_topic,
     $q21$مادر نوجوان ۱۵ ساله تحت دیالیز درخواست DXA دارد تا خطر شکستگی فرزندش مشخص شود. کدام پاسخ با شواهد موجود سازگارتر است؟$q21$,
     'mcq',
     '["DXA بهترین پیش‌بینی‌کننده شکستگی در CKD کودکان است","نتایج DXA و pQCT در CKD کودکان کاملاً همخوان‌اند","DXA با داده‌های بیوشیمیایی همبستگی قوی دارد","مشخص نیست DXA خطر شکستگی را در CKD کودکان پیش‌بینی کند؛ همخوانی DXA و pQCT محدود است و در یک مطالعه ترکیب بیومارکرهای روتین پیش‌بینی‌کننده بهتری برای BMD کورتیکال در pQCT بود، در حالی که DXA با داده‌های بیوشیمیایی و pQCT همبستگی نداشت","DXA ابزار غربالگری روتین سلامت استخوان در CKD کودکان است"]'::jsonb,
     3, null, null, null, null, null,
     '["DXA","pQCT","fracture prediction"]'::jsonb, 'hard', 3,
     $e21$شواهد محدودی برای همخوانی DXA و pQCT در CKD کودکان وجود دارد و مشخص نیست DXA خطر شکستگی را پیش‌بینی کند. ترکیب بیومارکرهای روتین پیش‌بینی‌کننده بهتری برای BMD کورتیکال بود. این روش‌ها برای غربالگری روتین یا پیش‌بینی خطر شکستگی توصیه نمی‌شوند.$e21$),

    (v_owner_id, v_topic,
     $q22$بر اساس راهنماها، کدام مورد جزو عوامل تعیین‌کننده تواتر پایش شاخص‌های CKD-MBD نیست؟$q22$,
     'mcq',
     '["مرحله CKD","سرعت پیشرفت CKD","سطح سرمی FGF23","شدت اختلالات و علائم و نشانه‌های بالینی","داروهای همزمان"]'::jsonb,
     2, null, null, null, null, null,
     '["monitoring frequency","determinants"]'::jsonb, 'medium', 2,
     $e22$پایش باید بر اساس مرحله CKD، سرعت پیشرفت، شدت اختلالات، علائم و نشانه‌های بالینی و داروهای همزمان باشد. FGF23 فقط برای اهداف تحقیقاتی اندازه‌گیری می‌شود.$e22$),

    (v_owner_id, v_topic,
     $q23$راهنمای گروه‌های کاری اروپایی CKD-MBD و دیالیز برای ارزیابی استخوان در کودکان CKD مراحل ____ تا ____ تدوین شده است.$q23$,
     'fill_blank', '[]'::jsonb, null,
     '["۲", "۵"]'::jsonb, null, null, null, null,
     '["European guideline","scope"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q24$معاینه اسکلتی‌عضلانی در CKD کودکان باید بر ____، ____ و ____ تمرکز کند.$q24$,
     'fill_blank', '[]'::jsonb, null,
     '["درد استخوان", "دفورمیتی", "شکستگی"]'::jsonb, null, null, null, null,
     '["clinical evaluation"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q25$شاخص‌های بیوشیمیایی سنتی که به‌طور روتین اندازه‌گیری می‌شوند شامل Ca، P، PTH، ____ و ____ هستند.$q25$,
     'fill_blank', '[]'::jsonb, null,
     '["25-D", "آلکالن فسفاتاز (ALP)"]'::jsonb, null, null, null, null,
     '["routine biomarkers"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q26$ارزیابی‌های قلبی‌عروقی که ابزار تحقیقاتی محسوب می‌شوند شامل CT عروق ____، ضخامت انتیما–مدیای کاروتید و ____ هستند.$q26$,
     'fill_blank', '[]'::jsonb, null,
     '["کرونر", "سرعت موج نبض (PWV)"]'::jsonb, null, null, null, null,
     '["cardiovascular evaluation","research tools"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q27$محدوده طبیعی P، Ca و ALP سرم وابسته به ____ است و ALP علاوه بر آن وابسته به ____ نیز هست.$q27$,
     'fill_blank', '[]'::jsonb, null,
     '["سن", "جنس"]'::jsonb, null, null, null, null,
     '["reference ranges"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q28$KDIGO پیشنهاد می‌کند PTH در کودکان دیالیزی بین ____ تا ____ برابر حد بالای نرمال (حدود ۱۲۰ تا ۵۴۰ pg/mL) حفظ شود.$q28$,
     'fill_blank', '[]'::jsonb, null,
     '["۲", "۹"]'::jsonb, null, null, null, null,
     '["KDIGO"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q29$داده‌های بافت‌شناسی دهه ۱۹۹۰ اختلال رشد شدیدتری را در بیماران با PTH کمتر از ____ pg/mL نشان دادند.$q29$,
     'fill_blank', '[]'::jsonb, null,
     '["۳۰۰"]'::jsonb, null, null, null, null,
     '["KDIGO","growth retardation"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q30$در داده‌های IPPN، محدوده PTH بین ____ تا ____ برابر حد بالای نرمال (۱۰۰ تا ۱۸۰ pg/mL) با کیفیت بهینه استخوان همراه بود.$q30$,
     'fill_blank', '[]'::jsonb, null,
     '["۱.۷", "۳"]'::jsonb, null, null, null, null,
     '["IPPN"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q31$EPDWG در سال ____ پیشنهاد کرد PTH در کودکان دیالیزی بین ____ تا ____ برابر حد بالای نرمال حفظ شود.$q31$,
     'fill_blank', '[]'::jsonb, null,
     '["۲۰۰۶", "۲", "۳"]'::jsonb, null, null, null, null,
     '["EPDWG"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q32$در کودکان تحت PD، PTH کمتر از ____ pg/mL همراه با ALP کل کمتر از ____ IU/L بالاترین میزان پیش‌بینی صحیح turnover و مینرالیزاسیون طبیعی را داشت.$q32$,
     'fill_blank', '[]'::jsonb, null,
     '["۴۰۰", "۴۰۰"]'::jsonb, null, null, null, null,
     '["PTH + ALP combination"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q33$PTH، P و FGF23 مدت‌ها پیش از CKD مرحله ۵ افزایش می‌یابند و همزمان تشکیل استخوان در CKD مراحل ____ و ____ افزایش می‌یابد.$q33$,
     'fill_blank', '[]'::jsonb, null,
     '["۳", "۴"]'::jsonb, null, null, null, null,
     '["pre-dialysis CKD","bone formation"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q34$رادیوگرافی ساده باید در کودکان با ____، شک به شکستگی ____ و بیماری‌های ژنتیک با درگیری اختصاصی استخوان انجام شود.$q34$,
     'fill_blank', '[]'::jsonb, null,
     '["درد استخوان", "بدون تروما (آتروماتیک)"]'::jsonb, null, null, null, null,
     '["conventional radiograph","indications"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q35$سن اسکلتی با رادیوگرافی ____ تعیین می‌شود و قد نهایی پیش‌بینی‌شده با سیستم خودکار ____ محاسبه می‌شود.$q35$,
     'fill_blank', '[]'::jsonb, null,
     '["مچ دست چپ", "Greulich-Pyle"]'::jsonb, null, null, null, null,
     '["bone age"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q36$در شیرخواران و کودکان کم‌سن، رادیوگرافی ____ برای ارزیابی ناحیه ____ فعال استفاده می‌شود.$q36$,
     'fill_blank', '[]'::jsonb, null,
     '["زانو", "متافیزی"]'::jsonb, null, null, null, null,
     '["infants","knee radiograph"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q37$هر منبع یا مطالعه را به هدف یا یافته PTH مربوط وصل کنید.$q37$,
     'matching', '[]'::jsonb, null, null,
     '[{"key":"1","text":"KDIGO"},{"key":"2","text":"EPDWG (2006)"},{"key":"3","text":"داده‌های IPPN"},{"key":"4","text":"مطالعه مقطعی ۱۶۱ کودک PD"},{"key":"5","text":"داده‌های بافت‌شناسی دهه ۱۹۹۰"}]'::jsonb,
     '[{"key":"A","text":"۲ تا ۳ برابر حد بالای نرمال (۱۲۰ تا ۱۸۰ pg/mL)"},{"key":"B","text":"PTH زیر ۴۰۰ همراه با ALP کل زیر ۴۰۰، بهترین پیش‌بینی turnover و مینرالیزاسیون طبیعی"},{"key":"C","text":"۲ تا ۹ برابر حد بالای نرمال (۱۲۰ تا ۵۴۰ pg/mL)"},{"key":"D","text":"اختلال رشد شدیدتر با PTH زیر ۳۰۰ pg/mL"},{"key":"E","text":"۱.۷ تا ۳ برابر حد بالای نرمال (۱۰۰ تا ۱۸۰ pg/mL) همراه با کیفیت بهینه استخوان"}]'::jsonb,
     '[{"left":"1","right":"C"},{"left":"2","right":"A"},{"left":"3","right":"E"},{"left":"4","right":"B"},{"left":"5","right":"D"}]'::jsonb,
     false,
     '["PTH targets","sources"]'::jsonb, 'hard', 2, null),

    (v_owner_id, v_topic,
     $q38$بر اساس راهنمای اروپایی، هر ارزیابی را مشخص کنید: روتین بالینی یا ابزار تحقیقاتی.$q38$,
     'matching', '[]'::jsonb, null, null,
     '[{"key":"1","text":"قد و سرعت رشد"},{"key":"2","text":"Ca، P، PTH، 25D و ALP"},{"key":"3","text":"بیکربنات سرم"},{"key":"4","text":"FGF23"},{"key":"5","text":"DXA"},{"key":"6","text":"pQCT / HR-pQCT"},{"key":"7","text":"بیوپسی استخوان"},{"key":"8","text":"cIMT و سرعت موج نبض"},{"key":"9","text":"ارزیابی دریافت کلسیم از رژیم، مکمل‌ها و P-binder"}]'::jsonb,
     '[{"key":"X","text":"ارزیابی روتین بالینی"},{"key":"Y","text":"ابزار تحقیقاتی؛ در عملکرد روتین توصیه نمی‌شود"}]'::jsonb,
     '[{"left":"1","right":"X"},{"left":"2","right":"X"},{"left":"3","right":"X"},{"left":"4","right":"Y"},{"left":"5","right":"Y"},{"left":"6","right":"Y"},{"left":"7","right":"Y"},{"left":"8","right":"Y"},{"left":"9","right":"X"}]'::jsonb,
     true,
     '["routine vs research","European guideline"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q39$هر سناریوی بالینی را به تصویربرداری مناسب وصل کنید.$q39$,
     'matching', '[]'::jsonb, null, null,
     '[{"key":"1","text":"تعیین سن اسکلتی پیش از شروع rhGH"},{"key":"2","text":"شیرخوار با شک به ریکتز فعال"},{"key":"3","text":"نوجوان دیالیزی با لنگش و درد ران"},{"key":"4","text":"ارزیابی کلسیفیکاسیون خارج اسکلتی در یک کودک با درد استخوان"},{"key":"5","text":"غربالگری روتین خطر شکستگی در همه کودکان دیالیزی"}]'::jsonb,
     '[{"key":"A","text":"رادیوگرافی زانو برای ارزیابی ناحیه متافیزی فعال"},{"key":"B","text":"رادیوگرافی مچ دست چپ با سیستم Greulich-Pyle"},{"key":"C","text":"توصیه نمی‌شود؛ DXA و pQCT ابزار غربالگری روتین نیستند"},{"key":"D","text":"رادیوگرافی ساده هیپ برای لغزش اپی‌فیز پروگزیمال فمور یا نکروز آواسکولار"},{"key":"E","text":"رادیوگرافی ساده"}]'::jsonb,
     '[{"left":"1","right":"B"},{"left":"2","right":"A"},{"left":"3","right":"D"},{"left":"4","right":"E"},{"left":"5","right":"C"}]'::jsonb,
     false,
     '["imaging","clinical scenarios"]'::jsonb, 'medium', 3, null),

    (v_owner_id, v_topic,
     $q40$هر یافته را به تفسیر صحیح آن وصل کنید.$q40$,
     'matching', '[]'::jsonb, null, null,
     '[{"key":"1","text":"Z-score پایین BMD کورتیکال"},{"key":"2","text":"PTH بالا در CKD پیش از دیالیز"},{"key":"3","text":"PTH بالاتر و کلسیم پایین‌تر در کودک PD"},{"key":"4","text":"PTH بالاتر از ۳ برابر حد بالای نرمال در داده‌های IPPN"},{"key":"5","text":"تغییر ناگهانی PTH پس از تعویض کیت آزمایشگاه"}]'::jsonb,
     '[{"key":"A","text":"همراه با نقص مینرالیزاسیون صرف‌نظر از turnover"},{"key":"B","text":"پیش‌بینی‌کننده شکستگی‌های بعدی"},{"key":"C","text":"نتایج متناقض روش‌های مختلف اندازه‌گیری PTH"},{"key":"D","text":"تراکم حجمی کمتر مواد معدنی کورتیکال"},{"key":"E","text":"افزایش درد استخوان، دفورمیتی، کلسیفیکاسیون خارج استخوانی و استئومالاسی یا استئوپنی رادیولوژیک"}]'::jsonb,
     '[{"left":"1","right":"B"},{"left":"2","right":"D"},{"left":"3","right":"A"},{"left":"4","right":"E"},{"left":"5","right":"C"}]'::jsonb,
     false,
     '["findings","interpretation"]'::jsonb, 'hard', 3, null);
end $$;
