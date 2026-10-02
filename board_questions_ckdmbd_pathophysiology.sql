-- Nephron Board Questions — CKD-MBD Pathophysiology question set
-- (10 MCQ, 9 fill-in-the-blank, 3 matching).
--
-- Part 1 repeats the same schema-upgrade statements from the Epidemiology
-- question set (harmless no-ops if already applied) so this file also works
-- standalone.
--
-- Part 2 inserts the 22 questions under topic "CKD / CKD-MBD /
-- Pathophysiology" for your account. Skipped automatically if that topic
-- already has questions, so re-running this file is a no-op (delete the
-- topic's existing rows first if you want to reload it with edits).

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

-- ---------- Part 2: CKD-MBD Pathophysiology question set ----------
do $$
declare
  v_owner_id uuid;
  v_topic text := 'CKD / CKD-MBD / Pathophysiology';
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
     $q1$پسر ۹ ساله‌ای با CKD مرحله ۲ ناشی از ریفلاکس نفروپاتی پیگیری می‌شود. کلسیم و PTH سرم نرمال‌اند و فسفر سرم در حد پایین نرمال است. اگر در این مرحله یک آزمایش جامع هورمونی انجام شود، محتمل‌ترین الگو کدام است؟$q1$,
     'mcq',
     '["FGF23 نرمال، 1,25D نرمال، PTH بالا","FGF23 بالا، 1,25D پایین، PTH نرمال","FGF23 بالا، 1,25D بالا، PTH پایین","FGF23 نرمال، 1,25D پایین، PTH بالا","FGF23 پایین، 1,25D نرمال، PTH نرمال"]'::jsonb,
     1, null, null, null, null, null,
     '["FGF23","early CKD","sequence of events"]'::jsonb, 'hard', 3,
     $e1$FGF23 در CKD بسیار زودرس بالا می‌رود و با مهار 1α-هیدروکسیلاز، 1,25D را حتی در مراحل اولیه کاهش می‌دهد. هیپرپاراتیروئیدی ثانویه بعداً و در پی افت 1,25D و کلسیم یونیزه ایجاد می‌شود. کاهش فسفر سرم در CKD بسیار زودرس همزمان با افزایش FGF23 دیده شده است.$e1$),

    (v_owner_id, v_topic,
     $q2$رزیدنتی در ژورنال کلاب می‌گوید: «افزایش FGF23 در CKD اولیه پاسخی به بار فسفاتی بالاست؛ پس محدودیت فسفر رژیمی در CKD مرحله ۲ آن را برمی‌گرداند.» کدام مورد بر اساس داده‌های موجود، جزو علل اصلی افزایش زودرس FGF23 نیست؟$q2$,
     'mcq',
     '["کاهش کلیرانس کلیوی FGF23","کاهش زودرس Klotho کلیوی","تغییرات بیولوژی استخوان که بیان اسکلتی FGF23 را تحریک می‌کند","افزایش بار فسفات","التهاب"]'::jsonb,
     3, null, null, null, null, null,
     '["FGF23","Klotho","CKiD","phosphate load"]'::jsonb, 'hard', 2,
     $e2$داده‌های CKiD نشان می‌دهند افزایش بار فسفات محرک مهم افزایش اولیه FGF23 نیست؛ حتی کاهش فسفر سرم در CKD بسیار زودرس دیده می‌شود. هیپرفسفاتمی فقط در CKD پیشرفته در افزایش FGF23 نقش دارد. التهاب در همه مراحل FGF23 را بالا می‌برد.$e2$),

    (v_owner_id, v_topic,
     $q3$دو کودک با eGFR تقریباً یکسان (حدود 40 mL/min/1.73m²) بررسی می‌شوند. کودک اول دیسپلازی کلیه (CAKUT) دارد، هموگلوبین نرمال است و CRP منفی است. کودک دوم گلومرولونفریت مزمن با CRP بالا و آنمی با فقر آهن عملکردی دارد و اریتروپویتین دریافت می‌کند. کدام عبارت صحیح‌تر است؟$q3$,
     'mcq',
     '["چون GFR برابر است، سطح FGF23 دو کودک باید مشابه باشد","کودک اول به علت ماهیت مادرزادی بیماری FGF23 بالاتری دارد","کودک دوم FGF23 بالاتری خواهد داشت؛ بیماری گلومرولی، التهاب، کمبود آهن عملکردی و اریتروپویتین همگی FGF23 را افزایش می‌دهند","اریتروپویتین با مهار FGF23 اثر سایر عوامل را خنثی می‌کند","فقط کمبود آهن مطلق، و نه عملکردی، FGF23 را بالا می‌برد"]'::jsonb,
     2, null, null, null, null, null,
     '["FGF23","glomerular disease","CAKUT","iron","erythropoietin"]'::jsonb, 'hard', 3,
     $e3$FGF23 در بیماری‌های گلومرولی بیشتر از CAKUT است. التهاب، کمبود آهن مطلق و عملکردی (در مدل‌های موشی) و اریتروپویتین همگی تولید FGF23 را افزایش می‌دهند و این عوامل در همه مراحل CKD مؤثرند.$e3$),

    (v_owner_id, v_topic,
     $q4$دختر ۷ ساله با CKD مرحله ۳ (پیش از دیالیز) سطح 25(OH)D برابر 11 ng/mL دارد و PTH در دو نوبت اخیر رو به افزایش بوده، اما هنوز از محدوده هدف بالاتر نرفته است. کلسیم و فسفر نرمال‌اند. کدام اقدام بر اساس شواهد کارآزمایی تصادفی در کودکان، شروع هیپرپاراتیروئیدی ثانویه را به تأخیر می‌اندازد؟$q4$,
     'mcq',
     '["شروع کلسیتریول","شروع سیناکلست","شروع P-binder کلسیمی","محدودیت شدید فسفر رژیمی","درمان با ارگوکلسیفرول"]'::jsonb,
     4, null, null, null, null, null,
     '["25D deficiency","ergocalciferol","secondary hyperparathyroidism"]'::jsonb, 'medium', 3,
     $e4$کمبود 25D در ایجاد هیپرپاراتیروئیدی ثانویه نقش دارد. یک کارآزمایی تصادفی کنترل‌شده با دارونما در کودکان CKD پیش از دیالیز نشان داد ارگوکلسیفرول شروع هیپرپاراتیروئیدی ثانویه را به تأخیر می‌اندازد.$e4$),

    (v_owner_id, v_topic,
     $q5$پسر ۱۵ ساله با CKD مرحله ۵ به علت PTH بالا با دوز رو به افزایش آلفاکلسیدول درمان شده است. PTH کاهش یافته، اما FGF23 نسبت به قبل افزایش واضح دارد. بهترین تفسیر کدام است؟$q5$,
     'mcq',
     '["آنالوگ‌های فعال ویتامین D در CKD پیشرفته خود باعث افزایش بیشتر FGF23 می‌شوند","افزایش FGF23 نشانه مقاومت استخوان به PTH است و ارتباطی با درمان ندارد","کاهش PTH مستقیماً ترشح FGF23 را تحریک می‌کند","این یافته خطای آزمایشگاهی است، چون ویتامین D فعال FGF23 را کم می‌کند","افزایش FGF23 فقط ناشی از کاهش کلیرانس کلیوی است"]'::jsonb,
     0, null, null, null, null, null,
     '["active vitamin D","FGF23","therapy effects"]'::jsonb, 'hard', 3,
     $e5$در مراحل پیشرفته CKD، درمان با آنالوگ‌های فعال ویتامین D به افزایش بیشتر FGF23 کمک می‌کند. در شکل ۱ هم «درمان‌هایی که FGF23 را به شکل متفاوت تحت تأثیر قرار می‌دهند» جزو عوامل تشدیدکننده آمده‌اند.$e5$),

    (v_owner_id, v_topic,
     $q6$دختر ۱۲ ساله با CKD مرحله ۵ پیش از دیالیز، کلسیم توتال 7.9 mg/dL و فسفر 7.2 mg/dL دارد. کدام عبارت مکانیسم این دو یافته را بهتر توضیح می‌دهد؟$q6$,
     'mcq',
     '["هیپوکلسمی ناشی از دفع ادراری کلسیم و هیپرفسفاتمی ناشی از افزایش جذب روده‌ای فسفر است","هر دو یافته مستقیماً ناشی از افزایش FGF23 هستند","هیپوکلسمی ناشی از مقاومت به PTH است و فسفر نقشی ندارد","هیپوکلسمی ناشی از کاهش جذب روده‌ای کلسیم به علت کلسیتریول بسیار پایین، و هیپرفسفاتمی ناشی از کاهش دفع فسفر به علت کاهش شدید توده کلیه است؛ حدود ۵۰–۶۰٪ بیماران CKD 4–5 هیپوکلسمی پیدا می‌کنند","هیپوکلسمی در کمتر از ۱۰٪ بیماران CKD 4–5 رخ می‌دهد و باید به دنبال علت دیگری بود"]'::jsonb,
     3, null, null, null, null, null,
     '["hypocalcemia","hyperphosphatemia","late CKD"]'::jsonb, 'medium', 2,
     $e6$حدود ۵۰–۶۰٪ بیماران CKD مرحله ۴–۵ به دنبال کاهش جذب روده‌ای کلسیم ناشی از کلسیتریول بسیار پایین دچار هیپوکلسمی می‌شوند. کاهش دفع فسفر به علت کاهش شدید توده کلیه به هیپرفسفاتمی می‌انجامد.$e6$),

    (v_owner_id, v_topic,
     $q7$در یک کودک دیالیزی با آنمی مقاوم به درمان، فلو می‌خواهد ارتباط FGF23 و خون‌سازی را در گزارش مورد توضیح دهد. کدام عبارت صحیح است؟$q7$,
     'mcq',
     '["FGF23 خون‌سازی را تحریک می‌کند و سطح بالای آن از آنمی محافظت می‌کند","اریتروپویتین تولید FGF23 را تحریک می‌کند و در مقابل، FGF23 ممکن است خون‌سازی را سرکوب کند","اریتروپویتین تولید FGF23 را مهار می‌کند","وضعیت آهن تأثیری بر FGF23 ندارد","ارتباط FGF23 و خون‌سازی فقط در CKD مرحله ۵ وجود دارد"]'::jsonb,
     1, null, null, null, null, null,
     '["FGF23","erythropoiesis","anemia"]'::jsonb, 'medium', 2,
     $e7$رابطه دوطرفه است: اریتروپویتین تولید FGF23 را افزایش می‌دهد و FGF23 ممکن است خون‌سازی را سرکوب کند. کمبود آهن مطلق و عملکردی نیز بیان استخوانی FGF23 را بالا می‌برد. این عوامل غیرمعدنی در همه مراحل CKD مؤثرند.$e7$),

    (v_owner_id, v_topic,
     $q8$پسر ۱۶ ساله تحت همودیالیز، PTH حدود ۳ برابر حد بالای نرمال دارد، اما شواهد بالینی و آزمایشگاهی به نفع turnover بالای استخوان نیست. کدام مکانیسم پاتوفیزیولوژیک این ناهمخوانی را بهتر توضیح می‌دهد؟$q8$,
     'mcq',
     '["افزایش حساسیت گیرنده حس‌گر کلسیم (CaSR)","کمبود FGF23","افزایش Klotho کلیوی","سرکوب کامل غدد پاراتیروئید","مقاومت فزاینده اسکلت به اثرات PTH"]'::jsonb,
     4, null, null, null, null, null,
     '["PTH resistance","hormonal resistance","bone turnover"]'::jsonb, 'hard', 3,
     $e8$با پیشرفت CKD، مقاومت اسکلت به PTH افزایش می‌یابد. در شکل ۱ هم مقاومت هورمونی (VDR، PTH و CaSR) جزو اختلالات بیولوژیک آمده است. به همین دلیل سطح بالاتری از PTH برای حفظ turnover طبیعی لازم است.$e8$),

    (v_owner_id, v_topic,
     $q9$نوجوان ۱۷ ساله دیالیزی با کلسیفیکاسیون عروقی پیشرونده، به علت ترومبوز مکرر دسترسی عروقی وارفارین، به علت قد کوتاه rhGH، و به علت بیماری زمینه‌ای کورتیکواستروئید دریافت می‌کند. بر اساس مدل پاتوفیزیولوژیک CKD-MBD، این داروها در کدام گروه از عوامل تشدیدکننده قرار می‌گیرند؟$q9$,
     'mcq',
     '["محیط اورمیک (Uremic milieu)","عوامل خطر Framingham","درمان‌ها (Therapies)","عوامل ذاتی (Intrinsic factors)","اختلالات بیولوژیک"]'::jsonb,
     2, null, null, null, null, null,
     '["Fig. 1","therapies","vascular calcification"]'::jsonb, 'medium', 2,
     $e9$در شکل ۱، وارفارین، rhGH و کورتیکواستروئیدها همراه با درمان‌هایی که FGF23 و بیولوژی استئوبلاست و استئوکلاست را متفاوت تحت تأثیر قرار می‌دهند، در گروه Therapies آمده‌اند. درمان‌های CKD-MBD علاوه بر هموستاز یون‌های معدنی، بر ارتباط استئوبلاست، استئوکلاست و استئوسیت و بر بیولوژی سلول عضله صاف عروق نیز اثر دارند.$e9$),

    (v_owner_id, v_topic,
     $q10$در یک کودک تحت دیالیز صفاقی با کلسیفیکاسیون عروقی، کدام یافته در شکل ۱ جزو «محیط اورمیک» طبقه‌بندی شده است؟$q10$,
     'mcq',
     '["کاهش Fetuin A","استرس اکسیداتیو","دیس‌لیپیدمی","اسیدوز","اختلال محور GH/IGF1"]'::jsonb,
     0, null, null, null, null, null,
     '["Fig. 1","uremic milieu","fetuin A"]'::jsonb, 'medium', 2,
     $e10$محیط اورمیک در شکل ۱ شامل توکسین‌های اورمیک، هیپرهموسیستئینمی، محصولات نهایی گلیکاسیون پیشرفته و کاهش Fetuin A است. استرس اکسیداتیو و اسیدوز جزو عوامل ذاتی، دیس‌لیپیدمی جزو عوامل Framingham، و اختلال GH/IGF1 جزو اختلالات بیولوژیک‌اند.$e10$),

    (v_owner_id, v_topic,
     $q11$استخوان عمدتاً از کلسیم و فسفر به شکل ____ تشکیل شده است.$q11$,
     'fill_blank', '[]'::jsonb, null,
     '["هیدروکسی‌آپاتیت (hydroxyapatite)"]'::jsonb, null, null, null, null,
     '["bone composition"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q12$افزایش FGF23 با مهار فعالیت آنزیم کلیوی ____، سطح 1,25D را حتی در مراحل اولیه CKD کاهش می‌دهد.$q12$,
     'fill_blank', '[]'::jsonb, null,
     '["1α-هیدروکسیلاز"]'::jsonb, null, null, null, null,
     '["FGF23","vitamin D"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q13$____ کوفاکتور حیاتی FGF23 در بیشتر بافت‌هاست و سطح کلیوی آن در CKD زودرس کاهش می‌یابد.$q13$,
     'fill_blank', '[]'::jsonb, null,
     '["Klotho"]'::jsonb, null, null, null, null,
     '["Klotho"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q14$FGF23 از سلول‌های ____، PTH از غدد پاراتیروئید و 1,25D از سلول‌های ____ کلیه منشأ می‌گیرند.$q14$,
     'fill_blank', '[]'::jsonb, null,
     '["استخوان", "توبول پروگزیمال"]'::jsonb, null, null, null, null,
     '["hormone sources"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q15$حدود ____ درصد بیماران CKD مرحله ۴ و ۵ به علت کاهش جذب روده‌ای کلسیم دچار هیپوکلسمی می‌شوند.$q15$,
     'fill_blank', '[]'::jsonb, null,
     '["۵۰–۶۰"]'::jsonb, null, null, null, null,
     '["hypocalcemia","late CKD"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q16$در یک کارآزمایی تصادفی کنترل‌شده با دارونما در کودکان CKD پیش از دیالیز، درمان با ____ شروع هیپرپاراتیروئیدی ثانویه را به تأخیر انداخت.$q16$,
     'fill_blank', '[]'::jsonb, null,
     '["ارگوکلسیفرول"]'::jsonb, null, null, null, null,
     '["ergocalciferol","RCT"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q17$سطح FGF23 در بیماران با ____ بالاتر از بیماران با CAKUT است.$q17$,
     'fill_blank', '[]'::jsonb, null,
     '["بیماری‌های گلومرولی"]'::jsonb, null, null, null, null,
     '["FGF23","etiology of CKD"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q18$علاوه بر RANK/RANKL و BMP، مسیرهای ____ و ____ از مسیرهای پیام‌رسانی مهم در بیولوژی استخوان و عروق هستند که در CKD دچار اختلال می‌شوند.$q18$,
     'fill_blank', '[]'::jsonb, null,
     '["RUNX", "WNT"]'::jsonb, null, null, null, null,
     '["signaling pathways"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q19$در شکل ۱، پیامدهای استخوانی CKD-MBD شامل اختلال turnover و مینرالیزاسیون، خطر شکستگی و درد استخوان، و اختلال رشد و ____ است و پیامدهای عروقی شامل اختلال ____ و سفتی شریانی، کلسیفیکاسیون عروقی و افزایش حوادث قلبی‌عروقی است.$q19$,
     'fill_blank', '[]'::jsonb, null,
     '["bowing (خمیدگی اندام)", "cIMT (ضخامت انتیما–مدیای کاروتید)"]'::jsonb, null, null, null, null,
     '["Fig. 1","outcomes"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q20$هر عامل را به گروه مربوط در شکل ۱ (مدل پاتوفیزیولوژی CKD-MBD کودکان) وصل کنید.$q20$,
     'matching', '[]'::jsonb, null, null,
     '[{"key":"1","text":"کاهش Fetuin A"},{"key":"2","text":"اسیدوز"},{"key":"3","text":"وارفارین"},{"key":"4","text":"مقاومت CaSR"},{"key":"5","text":"دیس‌لیپیدمی"},{"key":"6","text":"پرخوری (Over-nutrition)"},{"key":"7","text":"استرس اکسیداتیو"},{"key":"8","text":"هیپرهموسیستئینمی"},{"key":"9","text":"کورتیکواستروئیدها"},{"key":"10","text":"اختلال محور GH/IGF1"}]'::jsonb,
     '[{"key":"A","text":"عوامل ذاتی (Intrinsic factors)"},{"key":"B","text":"اختلالات بیولوژیک"},{"key":"C","text":"درمان‌ها"},{"key":"D","text":"محیط اورمیک"},{"key":"E","text":"عوامل خطر Framingham"},{"key":"F","text":"تغذیه"}]'::jsonb,
     '[{"left":"1","right":"D"},{"left":"2","right":"A"},{"left":"3","right":"C"},{"left":"4","right":"B"},{"left":"5","right":"E"},{"left":"6","right":"F"},{"left":"7","right":"A"},{"left":"8","right":"D"},{"left":"9","right":"C"},{"left":"10","right":"B"}]'::jsonb,
     true,
     '["Fig. 1","classification"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q21$هر هورمون یا عامل را به عبارت صحیح درباره آن وصل کنید.$q21$,
     'matching', '[]'::jsonb, null, null,
     '[{"key":"1","text":"FGF23"},{"key":"2","text":"PTH"},{"key":"3","text":"1,25D"},{"key":"4","text":"Klotho"},{"key":"5","text":"25D"}]'::jsonb,
     '[{"key":"A","text":"از توبول پروگزیمال منشأ می‌گیرد و کاهش آن جذب روده‌ای کلسیم را کم می‌کند"},{"key":"B","text":"از سلول‌های استخوانی منشأ می‌گیرد و 1α-هیدروکسیلاز را مهار می‌کند"},{"key":"C","text":"کوفاکتور FGF23 که سطح کلیوی آن در CKD زودرس کاهش می‌یابد"},{"key":"D","text":"کمبود آن شایع است و جبرانش با ارگوکلسیفرول هیپرپاراتیروئیدی ثانویه را به تأخیر می‌اندازد"},{"key":"E","text":"در پاسخ به 1,25D پایین و کلسیم یونیزه پایین ترشح می‌شود"}]'::jsonb,
     '[{"left":"1","right":"B"},{"left":"2","right":"E"},{"left":"3","right":"A"},{"left":"4","right":"C"},{"left":"5","right":"D"}]'::jsonb,
     false,
     '["hormones","sources","actions"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q22$نقش هر عامل را در افزایش FGF23 مشخص کنید.$q22$,
     'matching', '[]'::jsonb, null, null,
     '[{"key":"1","text":"بار فسفات در CKD اولیه"},{"key":"2","text":"هیپرفسفاتمی در CKD پیشرفته"},{"key":"3","text":"آنالوگ فعال ویتامین D در CKD پیشرفته"},{"key":"4","text":"کمبود آهن عملکردی"},{"key":"5","text":"التهاب"},{"key":"6","text":"کاهش کلیرانس کلیوی FGF23"},{"key":"7","text":"اریتروپویتین"}]'::jsonb,
     '[{"key":"X","text":"عامل افزایش FGF23"},{"key":"Y","text":"محرک مهم افزایش اولیه FGF23 نیست"}]'::jsonb,
     '[{"left":"1","right":"Y"},{"left":"2","right":"X"},{"left":"3","right":"X"},{"left":"4","right":"X"},{"left":"5","right":"X"},{"left":"6","right":"X"},{"left":"7","right":"X"}]'::jsonb,
     true,
     '["FGF23","determinants"]'::jsonb, 'hard', 3, null);
end $$;
