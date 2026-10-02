-- Nephron Board Questions — CKD-MBD Normal Bone Development question set
-- (11 MCQ, 9 fill-in-the-blank, 3 matching).
--
-- Part 1 repeats the same schema-upgrade statements from the earlier
-- question sets (harmless no-ops if already applied) so this file also
-- works standalone.
--
-- Part 2 inserts the 23 questions under topic "CKD / CKD-MBD / Normal Bone
-- Development" for your account. Skipped automatically if that topic
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

-- ---------- Part 2: CKD-MBD Normal Bone Development question set ----------
do $$
declare
  v_owner_id uuid;
  v_topic text := 'CKD / CKD-MBD / Normal Bone Development';
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
     $q1$نوزادی با فونتانل قدامی بسیار بزرگ، تأخیر در استخوانی شدن جمجمه و هیپوپلازی دوطرفه کلاویکول ارجاع شده است. طول اندام‌ها و ستون فقرات در رادیوگرافی طبیعی است. کدام فرایند تکاملی به احتمال بیشتر مختل شده است؟$q1$,
     'mcq',
     '["جایگزینی الگوی غضروفی با استخوان کلسیفیه در صفحه رشد","تشکیل سومیت‌ها از مزودرم پاراگزیال","تکثیر و هیپرتروفی کندروسیت‌ها","استخوان‌سازی داخل غشایی از سلول‌های مزانشیمی مشتق از ستیغ عصبی","اپوزیسیون پریوستئال در دیافیز استخوان‌های بلند"]'::jsonb,
     3, null, null, null, null, null,
     '["intramembranous ossification","neural crest","skull","clavicle"]'::jsonb, 'hard', 3,
     $e1$استخوان‌سازی داخل غشایی برای الگوگیری و استخوانی شدن جمجمه و کلاویکول حیاتی است. در این فرایند سلول‌های مزانشیمی مشتق از ستیغ عصبی تکثیر و به استئوبلاست تمایز می‌یابند. بیشتر اسکلت، شامل مهره‌ها و استخوان‌های بلند اندام، با استخوان‌سازی داخل غضروفی ساخته می‌شود و در این بیمار طبیعی است.$e1$),

    (v_owner_id, v_topic,
     $q2$خانمی باردار در هفته ۱۴ پس از لقاح به‌طور گذرا در معرض دارویی با اثر مهاری بر متابولیسم استخوان قرار گرفته است. والدین نگران‌اند که شکل استخوان‌های جنین تغییر کند. بر اساس روند طبیعی تکامل اسکلت، کدام پاسخ دقیق‌تر است؟$q2$,
     'mcq',
     '["الگوگیری اسکلت تا هفته ۹ پس از لقاح کامل شده و شکل پایه خارجی استخوان‌ها تعیین شده است؛ پس از آن ماتریکس فقط مینرالیزه می‌شود و رشد می‌کند","الگوگیری اسکلت تا هفته ۲۰ ادامه دارد، پس دفورمیتی شکلی محتمل است","سومیت‌ها در هفته ۱۲–۱۴ شکل می‌گیرند و این مواجهه بیشترین خطر را دارد","شکل پایه استخوان‌ها تا پایان دوران نوزادی تغییر می‌کند","استخوان‌سازی داخل غضروفی پس از هفته ۹ آغاز می‌شود"]'::jsonb,
     0, null, null, null, null, null,
     '["skeletal patterning","embryology","timing"]'::jsonb, 'hard', 3,
     $e2$سومیت‌ها در هفته ۳–۴ شکل می‌گیرند. الگوگیری اسکلت و شکل پایه همه استخوان‌ها تا هفته ۹ پس از لقاح کامل می‌شود. پس از آن ماتریکس اسکلتی مینرالیزه می‌شود و رشد می‌کند، اما شکل خارجی پایه آن تغییر نمی‌کند. این مواجهه بیشتر بر مینرالیزاسیون و رشد اثر دارد تا بر الگوی شکلی.$e2$),

    (v_owner_id, v_topic,
     $q3$در پسر ۱۲ ساله با CKD مرحله ۴ و هیپرپاراتیروئیدی ثانویه شدید، انتظار دارید تغییرات ناشی از تحریک هورمونی زودتر و شدیدتر در کدام ناحیه ظاهر شود؟$q3$,
     'mcq',
     '["کورتکس میانه دیافیز فمور","استخوان اسفنجی (ترابکولار) جسم مهره‌ها و متافیزها","پوسته کورتیکال خارجی مهره‌ها","استخوان‌های جمجمه","تفاوتی بین نواحی وجود ندارد"]'::jsonb,
     1, null, null, null, null, null,
     '["cancellous bone","metabolic activity","hyperparathyroidism"]'::jsonb, 'hard', 3,
     $e3$استخوان اسفنجی در انتهای استخوان‌های بلند، نزدیک مفاصل و داخل مهره‌ها قرار دارد و از استخوان کورتیکال فعال‌تر است. این بخش در پاسخ به محرک‌های هورمونی یون‌های معدنی را از گردش خون می‌گیرد یا به آن آزاد می‌کند. حدود ۲۰٪ توده استخوانی بزرگسالان استخوان اسفنجی است.$e3$),

    (v_owner_id, v_topic,
     $q4$در دختر ۸ ساله با CKD مرحله ۳، pQCT نشان می‌دهد طول استخوان‌ها متناسب با سن قد است، اما قطر خارجی دیافیز تیبیا کمتر از انتظار است. کدام جزء رشد استخوان در این بیمار بیشتر آسیب دیده است؟$q4$,
     'mcq',
     '["تکثیر کندروسیت‌ها در غضروف اپی‌فیزی","انتقال استئوبلاستی کندروسیت‌ها در صفحه رشد","افزایش ضخامت ترابکول‌ها","اپوزیسیون بافت روی سطح خارجی توسط سلول‌های استئوژنیک پریوستئوم","استخوان‌سازی داخل غشایی"]'::jsonb,
     3, null, null, null, null, null,
     '["bone growth","periosteum","bone width"]'::jsonb, 'medium', 3,
     $e4$افزایش طول استخوان با رشد کندروسیت‌ها و سپس انتقال استئوبلاستی و استخوانی شدن آن‌ها در غضروف اپی‌فیزی انجام می‌شود. پهن شدن استخوان نیازمند اپوزیسیون بافت روی سطح خارجی توسط سلول‌های استئوژنیک پریوستئوم است.$e4$),

    (v_owner_id, v_topic,
     $q5$کدام عبارت تفاوت فیزیولوژی استخوان در کودک ۱۰ ساله و بزرگسال ۴۰ ساله را درست‌تر بیان می‌کند؟$q5$,
     'mcq',
     '["در کودکان، تشکیل استخوان پریوستئال کاملاً با جذب جفت شده و تعادل خالص صفر است","در بزرگسالان، اپوزیسیون پریوستئال همواره بیشتر از جذب است","در کودکان، اپوزیسیون پریوستئال بیشتر از جذب استخوان است (modeling)، در حالی که در بزرگسالان دوره‌های چرخه‌ای تشکیل پریوستئال با جذب جفت می‌شوند (remodeling)","remodeling فقط در دوران جنینی رخ می‌دهد","پس از تولد، تشکیل استخوان پریوستئال متوقف می‌شود"]'::jsonb,
     2, null, null, null, null, null,
     '["modeling","remodeling","children vs adults"]'::jsonb, 'hard', 2,
     $e5$پس از تولد، تشکیل استخوان پریوستئال و افزایش طول اندوستئال ادامه دارد. در بزرگسالی دوره‌های تشکیل پریوستئال با دوره‌های جذب جفت می‌شوند (remodeling)، اما در کودکان اپوزیسیون پریوستئال از جذب بیشتر است (modeling).$e5$),

    (v_owner_id, v_topic,
     $q6$نوزادی در هفته ۲۶ بارداری متولد شده است. کدام تغییر طبیعی ساختار استخوان که در نیمه دوم بارداری رخ می‌دهد، به‌طور بالقوه در این نوزاد ناتمام مانده است؟$q6$,
     'mcq',
     '["تشکیل سومیت‌ها از مزودرم پاراگزیال","کامل شدن الگوگیری شکل پایه استخوان‌ها","شروع استخوان‌سازی داخل غشایی جمجمه","تبدیل کامل استخوان اسفنجی به کورتیکال","افزایش حدود ۳۰٪ ضخامت ترابکول‌ها و دو برابر شدن ضخامت کورتکس در میانه دیافیز"]'::jsonb,
     4, null, null, null, null, null,
     '["fetal bone modeling","prematurity"]'::jsonb, 'hard', 3,
     $e6$در جریان modeling، ساختار داخلی استخوان تغییر می‌کند. ضخامت ترابکول‌ها در نیمه دوم بارداری حدود ۳۰٪ افزایش می‌یابد و ضخامت کورتکس در میانه دیافیز دو برابر می‌شود. سومیت‌ها در هفته ۳–۴ و الگوگیری تا هفته ۹ کامل شده‌اند.$e6$),

    (v_owner_id, v_topic,
     $q7$نوجوانی با CKD پیشرفته و بیماری استخوانی با تشکیل پایین (low formation) با چاقی شکمی و مقاومت به انسولین مراجعه کرده است. فلو به نقش اندوکرین استخوان اشاره می‌کند. کدام عبارت درباره استئوکلسین نادرست است؟$q7$,
     'mcq',
     '["به مقدار زیاد توسط استئوبلاست‌های بالغ ترشح می‌شود","پروتئین غیرکلاژنی و تعیین‌کننده مهم تشکیل استخوان است","حساسیت به انسولین را بهبود می‌بخشد و از استئاتوز کبدی پیشگیری می‌کند","توده چربی را افزایش و مصرف انرژی را کاهش می‌دهد","ژن آن BGLAP است"]'::jsonb,
     3, null, null, null, null, null,
     '["osteocalcin","endocrine bone","energy metabolism"]'::jsonb, 'medium', 2,
     $e7$استئوکلسین (OCN، با ژن BGLAP) از استئوبلاست‌های بالغ ترشح می‌شود و تعیین‌کننده مهم تشکیل استخوان است. این پروتئین مصرف انرژی را افزایش و توده چربی را کاهش می‌دهد، حساسیت به انسولین را بهتر می‌کند و از استئاتوز کبدی پیشگیری می‌کند.$e7$),

    (v_owner_id, v_topic,
     $q8$در یک مطالعه ایمونوهیستوشیمی بیوپسی استخوان کودکان CKD، محقق می‌خواهد محل بیان FGF23 و اسکلروستین را پیش‌بینی کند. کدام الگو با داده‌های موجود سازگار است؟$q8$,
     'mcq',
     '["هر دو در استئوبلاست‌های بالغ بیان می‌شوند","FGF23 تقریباً منحصراً در استئوسیت‌های اولیه و اسکلروستین در بالغ‌ترین استئوسیت‌ها","FGF23 در بالغ‌ترین استئوسیت‌ها و اسکلروستین در استئوسیت‌های اولیه","هر دو در استئوکلاست‌ها بیان می‌شوند","FGF23 در کندروسیت‌های هیپرتروفیک و اسکلروستین در پریوستئوم"]'::jsonb,
     1, null, null, null, null, null,
     '["osteocyte maturation","FGF23","sclerostin"]'::jsonb, 'hard', 2,
     $e8$مرحله بلوغ استئوسیت در عملکرد آن تعیین‌کننده است. FGF23 تقریباً فقط در استئوسیت‌های اولیه بیان می‌شود، در حالی که اسکلروستین، مهارکننده مسیر Wnt، به بالغ‌ترین استئوسیت‌ها محدود است.$e8$),

    (v_owner_id, v_topic,
     $q9$کودکی با CKD مرحله ۵ هیپرفسفاتمی و هیپرپاراتیروئیدی ثانویه دارد و تحت درمان با کلسیتریول است. از دیدگاه تنظیم بیان FGF23 در استئوسیت، کدام عبارت درست است؟$q9$,
     'mcq',
     '["PTH بیان FGF23 را در استئوسیت مهار می‌کند","کلسیتریول بیان FGF23 را کاهش می‌دهد","تنظیم بیان FGF23 کاملاً شناخته شده و فقط وابسته به فسفر است","فسفر، PTH و 1,25(OH)2D همگی بیان FGF23 را تحریک می‌کنند؛ پس هر سه عامل در این بیمار در یک جهت عمل می‌کنند","FGF23 در این بیمار از توبول پروگزیمال ترشح می‌شود"]'::jsonb,
     3, null, null, null, null, null,
     '["FGF23 regulation","osteocyte"]'::jsonb, 'medium', 3,
     $e9$عوامل تنظیم‌کننده عملکرد استئوسیت به‌خوبی شناخته نشده‌اند. با این حال یون‌های معدنی در گردش مثل فسفر، و همچنین PTH و 1,25(OH)2D، بیان FGF23 را تحریک می‌کنند. FGF23 عملکرد اندوکرین استئوسیت است.$e9$),

    (v_owner_id, v_topic,
     $q10$در بحث درباره اثر یک داروی ضدجذب استخوان در کودکان، فلو مفهوم coupling را توضیح می‌دهد. کدام عبارت این مفهوم را درست‌تر توصیف می‌کند؟$q10$,
     'mcq',
     '["حلقه بازخورد تنگاتنگ تشکیل و جذب استخوان که از تعامل استئوبلاست و استئوکلاست شکل می‌گیرد و عملکرد هر دو توسط استئوسیت‌های جاگرفته در استخوان مینرالیزه تنظیم می‌شود","اتصال کلاژن نوع I به هیدروکسی‌آپاتیت","جفت شدن رشد طولی و عرضی استخوان","تبدیل کندروسیت به استئوبلاست در صفحه رشد","تنظیم مستقیم استئوکلاست‌ها فقط توسط PTH در گردش"]'::jsonb,
     0, null, null, null, null, null,
     '["coupling","osteocyte","bone cells"]'::jsonb, 'medium', 2,
     $e10$استئوبلاست‌ها ماتریکس استخوان را می‌سازند و استئوکلاست‌ها استخوان بالغ و مینرالیزه را تخریب می‌کنند. عملکرد هر دو توسط استئوسیت‌ها تنظیم می‌شود و این سیگنال‌های هماهنگ‌کننده حلقه بازخورد تنگاتنگی به نام coupling می‌سازند.$e10$),

    (v_owner_id, v_topic,
     $q11$کدام عبارت درباره استخوان‌سازی داخل غضروفی (بر اساس متن و Fig. 2) صحیح است؟$q11$,
     'mcq',
     '["فقط در جمجمه و کلاویکول رخ می‌دهد","استئوبلاست‌ها منحصراً از ستیغ عصبی منشأ می‌گیرند","عروق تغذیه‌کننده پس از کامل شدن استخوان بالغ وارد می‌شوند","ماتریکس غضروفی با ماتریکس غنی از کلاژن نوع II جایگزین می‌شود","استئوبلاست‌های مشتق از کندروسیت‌ها و از سلول‌های مزانشیمی bone collar، ماتریکس غضروفی را با ماتریکس غنی از کلاژن نوع I جایگزین می‌کنند که هسته تجمع هیدروکسی‌آپاتیت است"]'::jsonb,
     4, null, null, null, null, null,
     '["endochondral ossification","Fig. 2","type I collagen"]'::jsonb, 'medium', 2,
     $e11$در استخوان‌سازی داخل غضروفی، استئوبلاست‌های مشتق از کندروسیت‌ها و سلول‌های مزانشیمی bone collar ماتریکس غنی از کلاژن نوع I می‌سازند که محل تجمع کلسیم و فسفر به شکل هیدروکسی‌آپاتیت است. در Fig. 2، تشکیل bone collar و ورود عروق در مرحله B رخ می‌دهد.$e11$),

    (v_owner_id, v_topic,
     $q12$استخوان اسفنجی حدود ____ درصد توده کل استخوان بزرگسالان را تشکیل می‌دهد و از نظر متابولیک ____ از استخوان کورتیکال است.$q12$,
     'fill_blank', '[]'::jsonb, null,
     '["۲۰", "فعال‌تر"]'::jsonb, null, null, null, null,
     '["cancellous bone"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q13$در هفته‌های ____ تکامل جنینی، سومیت‌ها از مزودرم ____ شکل می‌گیرند و ساختار محوری بدن را پایه‌گذاری می‌کنند.$q13$,
     'fill_blank', '[]'::jsonb, null,
     '["۳–۴", "پاراگزیال"]'::jsonb, null, null, null, null,
     '["embryology","somites"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q14$الگوگیری اسکلت و شکل پایه همه استخوان‌ها تا هفته ____ پس از لقاح کامل می‌شود.$q14$,
     'fill_blank', '[]'::jsonb, null,
     '["۹"]'::jsonb, null, null, null, null,
     '["skeletal patterning"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q15$استخوان‌سازی داخل غشایی برای ____ و ____ حیاتی است و سلول‌های مزانشیمی آن از ____ مشتق می‌شوند.$q15$,
     'fill_blank', '[]'::jsonb, null,
     '["جمجمه", "کلاویکول", "ستیغ عصبی (neural crest)"]'::jsonb, null, null, null, null,
     '["intramembranous ossification"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q16$در نیمه دوم بارداری، ضخامت ترابکول‌ها حدود ____ درصد افزایش می‌یابد و ضخامت کورتکس در میانه دیافیز ____ می‌شود.$q16$,
     'fill_blank', '[]'::jsonb, null,
     '["۳۰", "دو برابر"]'::jsonb, null, null, null, null,
     '["fetal bone modeling"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q17$پهن شدن استخوان نیازمند اپوزیسیون بافت روی سطح خارجی توسط سلول‌های استئوژنیک ____ است.$q17$,
     'fill_blank', '[]'::jsonb, null,
     '["پریوستئوم"]'::jsonb, null, null, null, null,
     '["bone width"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q18$پروتئین غیرکلاژنی ____ (با ژن ____) به مقدار زیاد توسط استئوبلاست‌های بالغ ترشح می‌شود.$q18$,
     'fill_blank', '[]'::jsonb, null,
     '["استئوکلسین (OCN)", "BGLAP"]'::jsonb, null, null, null, null,
     '["osteocalcin"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q19$اسکلروستین مهارکننده مسیر پیام‌رسانی ____ است و به ____ استئوسیت‌ها محدود است.$q19$,
     'fill_blank', '[]'::jsonb, null,
     '["Wnt", "بالغ‌ترین"]'::jsonb, null, null, null, null,
     '["sclerostin","Wnt"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q20$بر اساس Fig. 2، استخوان بلند بالغ از ساختار خارجی متراکم (استخوان ____) و ساختار داخلی اسفنجی از ____ و صفحات تشکیل شده است.$q20$,
     'fill_blank', '[]'::jsonb, null,
     '["کورتیکال", "میله‌ها (rods)"]'::jsonb, null, null, null, null,
     '["Fig. 2","mature bone"]'::jsonb, 'easy', 2, null),

    (v_owner_id, v_topic,
     $q21$هر اصطلاح را به تعریف صحیح آن وصل کنید.$q21$,
     'matching', '[]'::jsonb, null, null,
     '[{"key":"1","text":"Modeling"},{"key":"2","text":"Remodeling"},{"key":"3","text":"Coupling"},{"key":"4","text":"استخوان‌سازی داخل غضروفی"},{"key":"5","text":"استخوان‌سازی داخل غشایی"}]'::jsonb,
     '[{"key":"A","text":"جایگزینی الگوی غضروفی اولیه با استخوان کلسیفیه؛ مسئول ساخت مهره‌ها و استخوان‌های بلند"},{"key":"B","text":"تمایز مستقیم سلول‌های مزانشیمی ستیغ عصبی به استئوبلاست؛ مسئول جمجمه و کلاویکول"},{"key":"C","text":"حلقه بازخورد تنگاتنگ تشکیل و جذب استخوان با هماهنگی استئوسیت‌ها"},{"key":"D","text":"دوره‌های چرخه‌ای تشکیل پریوستئال جفت‌شده با جذب، در بزرگسالان"},{"key":"E","text":"تغییر ساختار داخلی استخوان؛ در کودکان اپوزیسیون پریوستئال بیشتر از جذب است"}]'::jsonb,
     '[{"left":"1","right":"E"},{"left":"2","right":"D"},{"left":"3","right":"C"},{"left":"4","right":"A"},{"left":"5","right":"B"}]'::jsonb,
     false,
     '["definitions","bone biology"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q22$هر سلول را به محصول یا عملکرد اصلی آن وصل کنید.$q22$,
     'matching', '[]'::jsonb, null, null,
     '[{"key":"1","text":"استئوبلاست بالغ"},{"key":"2","text":"استئوسیت اولیه"},{"key":"3","text":"بالغ‌ترین استئوسیت"},{"key":"4","text":"استئوکلاست"},{"key":"5","text":"سلول استئوژنیک پریوستئوم"}]'::jsonb,
     '[{"key":"A","text":"تخریب استخوان بالغ و مینرالیزه"},{"key":"B","text":"ترشح FGF23"},{"key":"C","text":"ترشح استئوکلسین به مقدار زیاد"},{"key":"D","text":"پهن شدن استخوان با اپوزیسیون روی سطح خارجی"},{"key":"E","text":"بیان اسکلروستین"}]'::jsonb,
     '[{"left":"1","right":"C"},{"left":"2","right":"B"},{"left":"3","right":"E"},{"left":"4","right":"A"},{"left":"5","right":"D"}]'::jsonb,
     false,
     '["bone cells","secreted products"]'::jsonb, 'medium', 2, null),

    (v_owner_id, v_topic,
     $q23$هر مرحله در Fig. 2 (استخوان‌سازی داخل غضروفی) را به رویداد اصلی آن وصل کنید.$q23$,
     'matching', '[]'::jsonb, null, null,
     '[{"key":"1","text":"مرحله A"},{"key":"2","text":"مرحله B"},{"key":"3","text":"مرحله C"},{"key":"4","text":"مرحله D"}]'::jsonb,
     '[{"key":"A","text":"بلوغ مراکز استخوان‌سازی؛ رشد طولی در انتهاها و رشد پریوستئال (عرضی)"},{"key":"B","text":"تکثیر کندروسیت‌ها و ایجاد الگوی ماتریکسی"},{"key":"C","text":"استخوان بالغ با کورتکس متراکم خارجی و استخوان ترابکولار داخلی"},{"key":"D","text":"تراکم و هیپرتروفی کندروسیت‌ها، تشکیل bone collar و ورود عروق تغذیه‌کننده"}]'::jsonb,
     '[{"left":"1","right":"B"},{"left":"2","right":"D"},{"left":"3","right":"A"},{"left":"4","right":"C"}]'::jsonb,
     false,
     '["Fig. 2","endochondral stages"]'::jsonb, 'medium', 2, null);
end $$;
