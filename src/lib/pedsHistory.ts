// Structured pediatric history (the step-by-step «شرح حال اطفال» wizard).
// Fields that already have their own patients column (name, sex, dob, cc,
// hpi, vitals, exam…) stay there; everything new lives in one jsonb column,
// patients.peds_history, shaped as PedsHistory below.

import type { Patient } from '../types/domain'
import { formatAge } from './patientAge'

/** Tri-state finding: tap once = present, twice = absent, three times = cleared. */
export type Tri = 'yes' | 'no'
export type TriMap = Record<string, Tri>

export type ScreeningResult = 'unknown' | 'normal' | 'abnormal' | 'notDone'

export interface PedsHistory {
  informant?: string
  historyDate?: string
  ward?: string
  room?: string
  birthOrder?: string
  siblings?: string
  consanguinity?: 'none' | 'first' | 'distant' | 'unknown'
  motherAge?: string
  fatherAge?: string

  prenatal?: TriMap
  prenatalNotes?: string
  gaWeeks?: string
  birthWeight?: string
  birthLength?: string
  birthHc?: string
  delivery?: 'nvd' | 'elective-cs' | 'emergency-cs' | 'instrumental'
  apgar1?: string
  apgar5?: string
  neonatal?: TriMap
  nicuDays?: string
  neonatalNotes?: string

  feedingType?: 'breast' | 'formula' | 'mixed' | 'table'
  cfStartMonth?: string
  cfType?: string
  supplements?: TriMap
  dietNotes?: string

  milestones?: TriMap
  regression?: 'yes' | 'no'
  school?: string
  devNotes?: string

  vaccines?: TriMap
  vaccineCardSeen?: 'yes' | 'no'
  vaccineNotes?: string
  screening?: Record<string, ScreeningResult>

  allergies?: TriMap
  pmhFlags?: TriMap
  admissionsHx?: string
  surgicalHx?: string
  surgeries?: Surgery[]
  infections?: TriMap
  infectionNotes?: string
  familyFlags?: TriMap
  caregiver?: string
  exposures?: string
  daycare?: string
  sleep?: string
  headss?: string
  /** keys are `${systemId}-${itemId}` */
  ros?: TriMap
  rosNotes?: string
  rosSysNotes?: Record<string, string>
  /** exam text per system without its own patients column */
  exam?: Record<string, string>
  /** quick picks, keyed `${systemId}.${pickId}` -> option label */
  examPick?: Record<string, string>
  problemList?: string
  labNotes?: string
  imagingNotes?: string
  otherTests?: string
  hc?: string

  completedSteps?: string[]
  updatedAt?: string
}

export interface Surgery {
  id: string
  name: string
  date?: string
  notes?: string
}

export interface Option {
  id: string
  label: string
}

export const STEPS: Array<{ id: string; label: string; en: string }> = [
  { id: 'basic', label: 'اطلاعات پایه', en: 'Basic info' },
  { id: 'cc', label: 'شکایت اصلی', en: 'Chief complaint' },
  { id: 'birth', label: 'بارداری و تولد', en: 'Pregnancy & birth' },
  { id: 'feeding', label: 'تغذیه', en: 'Feeding' },
  { id: 'dev', label: 'رشد و تکامل', en: 'Development' },
  { id: 'vaccine', label: 'واکسن و غربالگری', en: 'Vaccines & screening' },
  { id: 'meds', label: 'دارو و آلرژی', en: 'Drugs & allergy' },
  { id: 'pmh', label: 'سوابق پزشکی', en: 'Past history' },
  { id: 'family', label: 'خانواده و محیط', en: 'Family & social' },
  { id: 'ros', label: 'مرور سیستم‌ها', en: 'Review of systems' },
  { id: 'exam', label: 'معاینه فیزیکی', en: 'Physical exam' },
  { id: 'para', label: 'پاراکلینیک', en: 'Paraclinical' },
  { id: 'summary', label: 'تشخیص و درمان', en: 'Diagnosis & plan' },
]

export const PRENATAL: Option[] = [
  { id: 'gdm', label: 'دیابت بارداری (GDM)' },
  { id: 'preeclampsia', label: 'پره‌اکلامپسی / فشارخون' },
  { id: 'infection', label: 'عفونت یا تب مادر' },
  { id: 'prom', label: 'پارگی زودرس کیسه آب (PROM)' },
  { id: 'bleeding', label: 'خونریزی' },
  { id: 'abortion', label: 'تهدید به سقط' },
  { id: 'fluid', label: 'پلی / الیگوهیدرآمنیوس' },
  { id: 'rh', label: 'ناسازگاری Rh' },
  { id: 'substances', label: 'مصرف دارو، سیگار یا مواد' },
  { id: 'iugr', label: 'محدودیت رشد جنین (IUGR)' },
  { id: 'antenatalHn', label: 'هیدرونفروز / آنومالی کلیه در سونوی جنینی' },
  { id: 'nephrotoxic', label: 'مصرف ACEi / ARB / NSAID توسط مادر' },
]

export const NEONATAL: Option[] = [
  { id: 'nicu', label: 'بستری در NICU' },
  { id: 'resus', label: 'نیاز به احیا' },
  { id: 'vent', label: 'اکسیژن / ونتیلاتور' },
  { id: 'jaundice', label: 'زردی و فتوتراپی' },
  { id: 'exchange', label: 'تعویض خون' },
  { id: 'sepsis', label: 'عفونت / سپسیس' },
  { id: 'rds', label: 'دیسترس تنفسی' },
  { id: 'hypoglycemia', label: 'هیپوگلیسمی' },
  { id: 'seizure', label: 'تشنج نوزادی' },
  { id: 'feeding', label: 'مشکل در تغذیه' },
  { id: 'uvc', label: 'کاتتر نافی (UAC / UVC)' },
  { id: 'lateVoid', label: 'تأخیر اولین ادرار (> ۲۴ ساعت)' },
  { id: 'aminoglycoside', label: 'داروی نفروتوکسیک (آمینوگلیکوزید، ایندومتاسین)' },
]

export const SUPPLEMENTS: Option[] = [
  { id: 'vitD', label: 'قطره A+D / ویتامین D' },
  { id: 'iron', label: 'قطره آهن' },
  { id: 'mv', label: 'مولتی‌ویتامین' },
  { id: 'zinc', label: 'زینک' },
]

export interface Milestone extends Option {
  /** typical age in months (CDC / AAP) */
  month: number
}

export const MILESTONE_GROUPS: Array<{ title: string; items: Milestone[] }> = [
  {
    title: 'حرکتی درشت',
    items: [
      { id: 'g-head', label: 'گردن گرفتن', month: 3 },
      { id: 'g-roll', label: 'غلت زدن', month: 5 },
      { id: 'g-sit', label: 'نشستن بدون کمک', month: 6 },
      { id: 'g-crawl', label: 'چهاردست‌وپا رفتن', month: 9 },
      { id: 'g-pull', label: 'ایستادن با گرفتن', month: 9 },
      { id: 'g-walk', label: 'راه رفتن مستقل', month: 12 },
      { id: 'g-run', label: 'دویدن', month: 18 },
      { id: 'g-stairs', label: 'بالا رفتن از پله', month: 24 },
      { id: 'g-jump', label: 'پریدن با دو پا', month: 30 },
      { id: 'g-tricycle', label: 'سه‌چرخه‌سواری', month: 36 },
      { id: 'g-hop', label: 'لی‌لی کردن', month: 60 },
    ],
  },
  {
    title: 'حرکتی ظریف',
    items: [
      { id: 'f-hands', label: 'باز شدن مشت‌ها', month: 3 },
      { id: 'f-reach', label: 'دراز کردن دست و گرفتن شیء', month: 4 },
      { id: 'f-transfer', label: 'انتقال شیء بین دو دست', month: 6 },
      { id: 'f-pincer', label: 'گرفتن انبرکی (Pincer)', month: 9 },
      { id: 'f-scribble', label: 'خط‌خطی کردن', month: 15 },
      { id: 'f-tower', label: 'برج ۴ مکعبی', month: 18 },
      { id: 'f-circle', label: 'کپی دایره', month: 36 },
      { id: 'f-cross', label: 'کپی صلیب / مربع', month: 48 },
    ],
  },
  {
    title: 'زبان و تکلم',
    items: [
      { id: 'l-coo', label: 'غان و غون (Cooing)', month: 2 },
      { id: 'l-laugh', label: 'خندیدن با صدا', month: 4 },
      { id: 'l-name', label: 'واکنش به صدا زدن نام', month: 7 },
      { id: 'l-babble', label: 'بابا / ماما بی‌معنی (Babbling)', month: 7 },
      { id: 'l-word', label: 'اولین کلمه معنادار', month: 12 },
      { id: 'l-words', label: 'چند کلمه', month: 15 },
      { id: 'l-2word', label: 'جمله دو کلمه‌ای', month: 24 },
      { id: 'l-3word', label: 'جمله سه کلمه‌ای', month: 36 },
      { id: 'l-story', label: 'تعریف داستان کوتاه', month: 48 },
    ],
  },
  {
    title: 'اجتماعی و شناختی',
    items: [
      { id: 's-smile', label: 'لبخند اجتماعی', month: 2 },
      { id: 's-eye', label: 'تماس چشمی', month: 2 },
      { id: 's-stranger', label: 'اضطراب از غریبه', month: 9 },
      { id: 's-bye', label: 'بای‌بای و دست زدن', month: 10 },
      { id: 's-point', label: 'اشاره برای نشان دادن (Pointing)', month: 12 },
      { id: 's-imitate', label: 'بازی تقلیدی', month: 18 },
      { id: 's-parallel', label: 'بازی موازی', month: 24 },
      { id: 's-daycontrol', label: 'کنترل ادرار در روز', month: 30 },
      { id: 's-pretend', label: 'بازی تخیلی', month: 36 },
      { id: 's-group', label: 'بازی گروهی و رعایت نوبت', month: 48 },
      { id: 's-nightdry', label: 'خشک ماندن شبانه', month: 60 },
    ],
  },
]

export const ALL_MILESTONES: Milestone[] = MILESTONE_GROUPS.flatMap((g) => g.items)

/** «Delay» only when marked "no" and the child is clearly past the usual age. */
export function milestoneDelayed(m: Milestone, ageMonths: number | null, state: Tri | undefined): boolean {
  if (state !== 'no' || ageMonths == null) return false
  return ageMonths >= Math.ceil(m.month * 1.5)
}

export interface Vaccine extends Option {
  month: number
}

// Iran national schedule (برنامه کشوری)
export const VACCINES: Vaccine[] = [
  { id: 'v0', label: 'بدو تولد: BCG، هپاتیت B، فلج اطفال', month: 0 },
  { id: 'v2', label: '۲ ماهگی: پنتاوالان، فلج اطفال', month: 2 },
  { id: 'v4', label: '۴ ماهگی: پنتاوالان، فلج اطفال خوراکی و تزریقی', month: 4 },
  { id: 'v6', label: '۶ ماهگی: پنتاوالان، فلج اطفال', month: 6 },
  { id: 'v12', label: '۱۲ ماهگی: MMR', month: 12 },
  { id: 'v18', label: '۱۸ ماهگی: MMR، سه‌گانه، فلج اطفال', month: 18 },
  { id: 'v72', label: '۶ سالگی: سه‌گانه، فلج اطفال', month: 72 },
]

export const SCREENING: Option[] = [
  { id: 'ch', label: 'کم‌کاری تیروئید (CH)' },
  { id: 'pku', label: 'فنیل‌کتونوری (PKU)' },
  { id: 'g6pd', label: 'کمبود G6PD (فاویسم)' },
  { id: 'hearing', label: 'شنوایی (OAE / AABR)' },
  { id: 'redReflex', label: 'رفلکس قرمز / بینایی' },
  { id: 'ddh', label: 'سونوگرافی لگن (DDH)' },
]

export const SCREENING_RESULTS: Array<{ id: ScreeningResult; label: string }> = [
  { id: 'unknown', label: 'نامشخص' },
  { id: 'normal', label: 'طبیعی' },
  { id: 'abnormal', label: 'غیرطبیعی' },
  { id: 'notDone', label: 'انجام نشده' },
]

export const ALLERGIES: Option[] = [
  { id: 'drug', label: 'دارو' },
  { id: 'food', label: 'غذا' },
  { id: 'insect', label: 'حشرات' },
  { id: 'env', label: 'عوامل محیطی' },
  { id: 'seasonal', label: 'فصلی' },
  { id: 'latex', label: 'لاتکس' },
]

export const PMH: Option[] = [
  { id: 'kidney', label: 'بیماری کلیوی' },
  { id: 'uti', label: 'عفونت ادراری مکرر' },
  { id: 'vur', label: 'ریفلاکس (VUR) / هیدرونفروز' },
  { id: 'aki', label: 'AKI قبلی' },
  { id: 'nephrotic', label: 'سندرم نفروتیک' },
  { id: 'stones', label: 'سنگ کلیه' },
  { id: 'htn', label: 'فشار خون بالا' },
  { id: 'asthma', label: 'آسم / خس‌خس مکرر' },
  { id: 'febrileSeizure', label: 'تشنج ناشی از تب' },
  { id: 'epilepsy', label: 'صرع' },
  { id: 'pneumonia', label: 'پنومونی' },
  { id: 'otitis', label: 'اوتیت مکرر' },
  { id: 'chd', label: 'بیماری قلبی مادرزادی' },
  { id: 'ida', label: 'آنمی فقر آهن' },
  { id: 'thal', label: 'تالاسمی' },
  { id: 'hypothyroid', label: 'کم‌کاری تیروئید' },
  { id: 't1dm', label: 'دیابت نوع ۱' },
  { id: 'eczema', label: 'اگزما / آلرژی غذایی' },
  { id: 'gerd', label: 'ریفلاکس معده (GERD)' },
  { id: 'transfusion', label: 'تزریق خون' },
]

export const CHILDHOOD_INFECTIONS: Option[] = [
  { id: 'measles', label: 'سرخک' },
  { id: 'rubella', label: 'سرخچه' },
  { id: 'mumps', label: 'اوریون' },
  { id: 'pertussis', label: 'سیاه سرفه' },
  { id: 'varicella', label: 'آبله مرغان' },
  { id: 'rheumatic', label: 'تب روماتیسمی' },
  { id: 'scarlet', label: 'مخملک' },
  { id: 'polio', label: 'فلج اطفال' },
  { id: 'strep', label: 'فارنژیت / زرد زخم استرپتوکوکی (اخیر)' },
  { id: 'hepatitis', label: 'هپاتیت' },
]

export const FAMILY: Option[] = [
  { id: 'ckd', label: 'بیماری مزمن کلیه (CKD)' },
  { id: 'dialysis', label: 'دیالیز / پیوند کلیه' },
  { id: 'cysts', label: 'کلیه پلی‌کیستیک' },
  { id: 'hematuria', label: 'هماچوری' },
  { id: 'stones', label: 'سنگ کلیه' },
  { id: 'deafness', label: 'ناشنوایی (مادرزادی / Alport)' },
  { id: 'genetic', label: 'بیماری ژنتیکی / متابولیک' },
  { id: 'thal', label: 'تالاسمی' },
  { id: 'g6pd', label: 'کمبود G6PD' },
  { id: 'chd', label: 'بیماری قلبی مادرزادی' },
  { id: 'seizure', label: 'تشنج / صرع' },
  { id: 'asthma', label: 'آسم و آلرژی' },
  { id: 'dm', label: 'دیابت' },
  { id: 'thyroid', label: 'بیماری تیروئید' },
  { id: 'htn', label: 'فشار خون بالا' },
  { id: 'devDelay', label: 'تأخیر تکامل / اوتیسم' },
  { id: 'sids', label: 'مرگ ناگهانی شیرخوار' },
  { id: 'siblingDeath', label: 'فوت خواهر / برادر' },
  { id: 'tb', label: 'سل' },
  { id: 'cancer', label: 'سرطان' },
]

export interface RosSystem {
  id: string
  title: string
  en: string
  groups: Array<{ title?: string; sex?: 'Male' | 'Female'; items: Option[] }>
}

const o = (id: string, label: string): Option => ({ id, label })

export const ROS_SYSTEMS: RosSystem[] = [
  {
    id: 'gen',
    title: 'عمومی',
    en: 'General',
    groups: [{ items: [o('fever', 'تب'), o('lethargy', 'بی‌حالی / خواب‌آلودگی'), o('irritable', 'بی‌قراری / گریه زیاد'), o('anorexia', 'کاهش اشتها / بد خوردن'), o('weightLoss', 'کاهش وزن / وزن‌نگرفتن'), o('nightSweats', 'تعریق شبانه'), o('activity', 'کاهش فعالیت و بازی')] }],
  },
  {
    id: 'skin',
    title: 'پوست',
    en: 'Skin',
    groups: [{ items: [o('rash', 'راش'), o('jaundice', 'زردی'), o('pallor', 'رنگ‌پریدگی'), o('eczema', 'اگزما'), o('bruise', 'کبودی'), o('petechiae', 'پتشی / پورپورا'), o('nevus', 'خال یا لکه مادرزادی'), o('itch', 'خارش'), o('cyanosis', 'سیانوز')] }],
  },
  {
    id: 'heent',
    title: 'سر، چشم، گوش، بینی، گلو',
    en: 'HEENT',
    groups: [
      { title: 'چشم', items: [o('redEye', 'قرمزی / ترشح چشم'), o('strabismus', 'انحراف چشم (استرابیسم)'), o('vision', 'مشکل بینایی'), o('tearing', 'اشک‌ریزش مداوم'), o('periorbital', 'پف دور چشم')] },
      { title: 'گوش', items: [o('earPain', 'کشیدن گوش / گوش‌درد'), o('earDischarge', 'ترشح گوش'), o('hearing', 'کاهش شنوایی / عدم پاسخ به صدا'), o('otitis', 'اوتیت مکرر')] },
      { title: 'بینی و حلق', items: [o('rhinorrhea', 'آبریزش / گرفتگی بینی'), o('snoring', 'خرخر و تنفس دهانی'), o('soreThroat', 'گلودرد'), o('epistaxis', 'خونریزی بینی'), o('teeth', 'دندان‌درآوردن / پوسیدگی')] },
    ],
  },
  {
    id: 'resp',
    title: 'تنفسی',
    en: 'Respiratory',
    groups: [{ items: [o('cough', 'سرفه'), o('wheeze', 'خس‌خس'), o('stridor', 'استریدور'), o('tachypnea', 'تنفس تند'), o('retraction', 'توکشیدگی قفسه سینه'), o('apnea', 'آپنه / وقفه تنفسی'), o('nightCough', 'سرفه شبانه'), o('orthopnea', 'تنگی نفس در حالت خوابیده'), o('tbContact', 'تماس با فرد مبتلا به سل')] }],
  },
  {
    id: 'cvs',
    title: 'قلبی و عروقی',
    en: 'Cardiovascular',
    groups: [{ items: [o('cyanosisCry', 'کبودی لب هنگام گریه/شیر خوردن'), o('sweatFeed', 'تعریق هنگام شیر خوردن'), o('fatigueFeed', 'خستگی زودرس هنگام تغذیه'), o('murmur', 'سوفل شناخته‌شده'), o('syncope', 'غش / سنکوپ'), o('palpitation', 'تپش قلب'), o('edema', 'ادم'), o('htnKnown', 'فشار خون بالای شناخته‌شده')] }],
  },
  {
    id: 'gi',
    title: 'گوارش',
    en: 'Gastrointestinal',
    groups: [{ items: [o('vomit', 'استفراغ'), o('bilious', 'استفراغ صفراوی / جهنده'), o('reflux', 'برگشت شیر (ریفلاکس)'), o('diarrhea', 'اسهال'), o('bloodyDiarrhea', 'اسهال خونی'), o('constipation', 'یبوست'), o('abdPain', 'درد شکم'), o('distension', 'نفخ / دیستنشن'), o('bloodStool', 'خون در مدفوع'), o('paleStool', 'مدفوع کم‌رنگ'), o('jaundice', 'زردی')] }],
  },
  {
    id: 'gu',
    title: 'ادراری - تناسلی',
    en: 'Genitourinary',
    groups: [
      {
        title: 'ادراری',
        items: [
          o('fewerDiapers', 'کاهش دفعات خیس کردن پوشک / کاهش ادرار'),
          o('polyuria', 'پرادراری / پرنوشی'),
          o('dysuria', 'سوزش ادرار'),
          o('frequency', 'تکرر ادرار'),
          o('urgency', 'فوریت / بی‌اختیاری روزانه'),
          o('enuresis', 'شب‌ادراری'),
          o('hematuria', 'خون در ادرار'),
          o('teaColored', 'ادرار چای‌رنگ / کولایی'),
          o('foamy', 'ادرار کف‌آلود'),
          o('smelly', 'ادرار بدبو'),
          o('weakStream', 'جریان ادرار ضعیف'),
          o('flankPain', 'درد پهلو / کولیک کلیوی'),
          o('stonePassage', 'دفع سنگ / شن'),
          o('holding', 'نگه داشتن ادرار / یبوست همزمان'),
        ],
      },
      { title: 'پسران', sex: 'Male', items: [o('scrotal', 'تورم / درد کیسه بیضه'), o('undescended', 'بیضه نزول‌نکرده'), o('penile', 'مشکل آلت یا ختنه')] },
      { title: 'دختران', sex: 'Female', items: [o('vaginal', 'ترشح یا خارش تناسلی'), o('labial', 'چسبندگی لابیا'), o('menses', 'قاعدگی (نوجوان)'), o('puberty', 'بلوغ زودرس / دیررس')] },
    ],
  },
  {
    id: 'msk',
    title: 'اسکلتی عضلانی',
    en: 'Musculoskeletal',
    groups: [{ items: [o('limp', 'لنگیدن'), o('joint', 'تورم یا درد مفصل'), o('rom', 'محدودیت حرکت اندام'), o('bonePain', 'درد استخوان (شبانه)'), o('weakness', 'ضعف عضلانی'), o('gait', 'اختلال راه رفتن'), o('deformity', 'دفورمیتی (ژنو والگوم/واروم، ریکتز)'), o('cramps', 'کرامپ / تتانی')] }],
  },
  {
    id: 'neuro',
    title: 'عصبی',
    en: 'Neurological',
    groups: [{ items: [o('seizure', 'تشنج'), o('febrileSeizure', 'تشنج همراه تب'), o('headache', 'سردرد'), o('blurred', 'تاری دید'), o('hypotonia', 'شل بودن (هیپوتونی)'), o('regression', 'پسرفت تکاملی'), o('movements', 'حرکات غیرارادی'), o('loc', 'کاهش سطح هوشیاری')] }],
  },
  {
    id: 'behav',
    title: 'رفتار و خواب',
    en: 'Behavior & Sleep',
    groups: [{ items: [o('sleep', 'اختلال خواب'), o('adhd', 'بیش‌فعالی / کم‌توجهی'), o('behavior', 'تغییر رفتار'), o('school', 'افت تحصیلی'), o('anxiety', 'اضطراب / ترس'), o('aggression', 'پرخاشگری')] }],
  },
  {
    id: 'heme',
    title: 'خونی',
    en: 'Hematologic',
    groups: [{ items: [o('pallor', 'رنگ‌پریدگی'), o('bleeding', 'کبودی یا خونریزی آسان'), o('transfusion', 'سابقه تزریق خون'), o('lad', 'لنفادنوپاتی'), o('pica', 'پیکا')] }],
  },
  {
    id: 'endo',
    title: 'غدد و رشد',
    en: 'Endocrine & Growth',
    groups: [{ items: [o('polydipsia', 'پرنوشی / پرادراری'), o('shortStature', 'نگرانی از کوتاهی قد'), o('obesity', 'چاقی'), o('precocious', 'بلوغ زودرس'), o('delayedPuberty', 'تأخیر بلوغ'), o('saltCraving', 'ولع نمک / دهیدراتاسیون مکرر')] }],
  },
]

export function rosItems(sys: RosSystem, sex?: string | null): Option[] {
  const sx = (sex ?? '').trim().toLowerCase()
  return sys.groups
    .filter((g) => !g.sex || !sx || sx.startsWith(g.sex[0].toLowerCase()))
    .flatMap((g) => g.items)
}

/** @deprecated first-version flat ROS list; kept so older saved answers still read. */
export const ROS: Option[] = [
  { id: 'edema', label: 'ادم' },
  { id: 'grossHematuria', label: 'هماچوری ماکروسکوپیک' },
  { id: 'foamy', label: 'ادرار کف‌آلود' },
  { id: 'oliguria', label: 'کاهش حجم ادرار' },
  { id: 'polyuria', label: 'پرادراری / پرنوشی' },
  { id: 'dysuria', label: 'سوزش / تکرر ادرار' },
  { id: 'enuresis', label: 'شب‌ادراری' },
  { id: 'flankPain', label: 'درد پهلو / شکم' },
  { id: 'fever', label: 'تب' },
  { id: 'headache', label: 'سردرد / تاری دید' },
  { id: 'gi', label: 'استفراغ / اسهال' },
  { id: 'rash', label: 'راش / درد مفاصل' },
  { id: 'ftt', label: 'کاهش وزن / FTT' },
  { id: 'bone', label: 'درد یا دفورمیتی استخوان' },
  { id: 'pallor', label: 'رنگ‌پریدگی / خستگی' },
]

export const HPI_PROMPTS = ['شروع', 'محل', 'مدت', 'کیفیت', 'شدت', 'انتشار', 'عوامل تشدید', 'عوامل تسکین', 'علائم همراه', 'سیر']

export const CONSANGUINITY: Array<{ id: NonNullable<PedsHistory['consanguinity']>; label: string }> = [
  { id: 'none', label: 'غیرمنسوب' },
  { id: 'first', label: 'فامیل درجه یک' },
  { id: 'distant', label: 'فامیل دور' },
  { id: 'unknown', label: 'نامشخص' },
]

export const DELIVERY: Array<{ id: NonNullable<PedsHistory['delivery']>; label: string }> = [
  { id: 'nvd', label: 'طبیعی (NVD)' },
  { id: 'elective-cs', label: 'سزارین انتخابی' },
  { id: 'emergency-cs', label: 'سزارین اورژانسی' },
  { id: 'instrumental', label: 'ابزاری (واکیوم/فورسپس)' },
]

export const FEEDING: Array<{ id: NonNullable<PedsHistory['feedingType']>; label: string }> = [
  { id: 'breast', label: 'شیر مادر' },
  { id: 'formula', label: 'شیرخشک' },
  { id: 'mixed', label: 'ترکیبی' },
  { id: 'table', label: 'غذای سفره' },
]

/** Cycles none → yes → no → none. */
export function cycleTri(map: TriMap | undefined, id: string): TriMap {
  const next = { ...(map ?? {}) }
  const cur = next[id]
  if (!cur) next[id] = 'yes'
  else if (cur === 'yes') next[id] = 'no'
  else delete next[id]
  return next
}

/** Age in whole months from DOB if present, else from the decimal-year age field. */
export function ageInMonths(p: Pick<Patient, 'dob' | 'age'>): number | null {
  if (p.dob) {
    const d = new Date(p.dob)
    if (!Number.isNaN(d.getTime())) {
      const now = new Date()
      let m = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
      if (now.getDate() < d.getDate()) m -= 1
      return Math.max(0, m)
    }
  }
  if (p.age != null) return Math.round(p.age * 12)
  return null
}

export function ageFromDob(dob: string): number | null {
  const m = ageInMonths({ dob, age: null })
  return m == null ? null : Math.round((m / 12) * 1000) / 1000
}

function triList(map: TriMap | undefined, opts: Option[], state: Tri): string[] {
  if (!map) return []
  return opts.filter((o) => map[o.id] === state).map((o) => o.label)
}

function line(label: string, value: string | null | undefined): string | null {
  const v = (value ?? '').toString().trim()
  return v ? `${label}: ${v}` : null
}

function triLine(label: string, map: TriMap | undefined, opts: Option[]): string | null {
  const yes = triList(map, opts, 'yes')
  const no = triList(map, opts, 'no')
  if (!yes.length && !no.length) return null
  const parts = []
  if (yes.length) parts.push(`دارد: ${yes.join('، ')}`)
  if (no.length) parts.push(`ندارد: ${no.join('، ')}`)
  return `${label} — ${parts.join(' | ')}`
}

/** Plain-text history in the usual order, for copying into a note or the assistant. */
export function buildHistorySummary(p: Patient, h: PedsHistory): string {
  const ageM = ageInMonths(p)
  const out: Array<string | null> = []
  const head = [p.name, formatAge(p.age), p.sex].filter(Boolean).join(' · ')
  out.push(head)
  out.push(line('شرح‌حال‌دهنده', h.informant))
  out.push(
    line(
      'خانواده',
      [
        h.birthOrder && `فرزند ${h.birthOrder}`,
        h.siblings && `از ${h.siblings} فرزند`,
        h.consanguinity && CONSANGUINITY.find((c) => c.id === h.consanguinity)?.label,
      ]
        .filter(Boolean)
        .join('، ')
    )
  )
  out.push('', line('CC', p.chiefComplaint), line('PI', p.hpi))
  out.push(triLine('Prenatal', h.prenatal, PRENATAL), line('توضیحات بارداری', h.prenatalNotes))
  out.push(
    line(
      'Birth',
      [
        h.gaWeeks && `GA ${h.gaWeeks}w`,
        h.birthWeight && `BW ${h.birthWeight}g`,
        h.delivery && DELIVERY.find((d) => d.id === h.delivery)?.label,
        (h.apgar1 || h.apgar5) && `Apgar ${h.apgar1 ?? '?'}/${h.apgar5 ?? '?'}`,
      ]
        .filter(Boolean)
        .join('، ')
    )
  )
  out.push(triLine('Neonatal', h.neonatal, NEONATAL), line('NICU (روز)', h.nicuDays), line('توضیحات نوزادی', h.neonatalNotes))
  out.push(
    line('Feeding', [h.feedingType && FEEDING.find((f) => f.id === h.feedingType)?.label, h.cfStartMonth && `غذای کمکی از ${h.cfStartMonth} ماهگی`].filter(Boolean).join('، ')),
    triLine('مکمل‌ها', h.supplements, SUPPLEMENTS),
    line('رژیم', h.dietNotes)
  )
  const delayed = ALL_MILESTONES.filter((m) => milestoneDelayed(m, ageM, h.milestones?.[m.id])).map((m) => m.label)
  out.push(
    line('Development', delayed.length ? `تأخیر: ${delayed.join('، ')}` : h.milestones && Object.keys(h.milestones).length ? 'بدون تأخیر ثبت‌شده' : ''),
    h.regression === 'yes' ? 'پسرفت تکاملی: دارد' : null,
    line('تحصیلی', h.school),
    line('توضیحات تکامل', h.devNotes)
  )
  out.push(triLine('Vaccination', h.vaccines, VACCINES), line('واکسن‌های دیگر', h.vaccineNotes))
  const scr = SCREENING.filter((s) => h.screening?.[s.id] && h.screening[s.id] !== 'unknown').map(
    (s) => `${s.label}: ${SCREENING_RESULTS.find((r) => r.id === h.screening?.[s.id])?.label}`
  )
  out.push(scr.length ? `غربالگری — ${scr.join('، ')}` : null)
  out.push(line('Drug Hx', p.medHx), triLine('Allergy', h.allergies, ALLERGIES), line('جزئیات آلرژی', p.allergyHx))
  out.push(triLine('PMH', h.pmhFlags, PMH), line('PMH', p.pmh), line('بستری‌های قبلی', h.admissionsHx))
  const surg = (h.surgeries ?? []).filter((x) => x.name.trim()).map((x) => [x.name, x.date, x.notes].filter(Boolean).join(' — '))
  out.push(surg.length ? `Surgical — ${surg.join('؛ ')}` : line('Surgical', h.surgicalHx))
  out.push(triLine('بیماری‌های عفونی کودکی', h.infections, CHILDHOOD_INFECTIONS), line('توضیحات', h.infectionNotes))
  out.push(triLine('FH', h.familyFlags, FAMILY), line('FH', p.familyHx))
  out.push(line('مراقب / خانواده', h.caregiver), line('محیط', h.exposures), line('مهد / مدرسه', h.daycare), line('خواب', h.sleep), line('HEADSS', h.headss))
  for (const sys of ROS_SYSTEMS) {
    const items = sys.groups.flatMap((g) => g.items).map((it) => ({ id: `${sys.id}-${it.id}`, label: it.label }))
    out.push(triLine(`ROS ${sys.en}`, h.ros, items), line(`ROS ${sys.en}`, h.rosSysNotes?.[sys.id]))
  }
  out.push(triLine('ROS', h.ros, ROS), line('ROS', h.rosNotes))
  out.push(
    line(
      'Vitals',
      [
        p.vsTemp != null && `T ${p.vsTemp}`,
        p.vsHR != null && `HR ${p.vsHR}`,
        p.vsRR != null && `RR ${p.vsRR}`,
        p.vsBP && `BP ${p.vsBP}`,
        p.vsSpo2 != null && `SpO2 ${p.vsSpo2}%`,
        p.weight != null && `Wt ${p.weight}kg`,
        p.height != null && `Ht ${p.height}cm`,
        h.hc && `HC ${h.hc}cm`,
      ]
        .filter(Boolean)
        .join(', ')
    )
  )
  const exam = [
    ['General', p.exGeneral],
    ['HEENT', p.exHeent],
    ['CVS', p.exCVS],
    ['Resp', p.exResp],
    ['Abd', p.exAbd],
    ['GU', p.exGU],
    ['Ext', p.exExtrem],
    ['Skin', p.exSkin],
    ['Neuro', p.exNeuro],
    ['Edema', p.exEdema],
    ['Hydration', p.exHydration],
  ]
    .filter(([, v]) => v && String(v).trim())
    .map(([k, v]) => `${k}: ${v}`)
  for (const [k, v] of Object.entries(h.exam ?? {})) if (v && v.trim()) exam.push(`${k}: ${v}`)
  for (const [k, v] of Object.entries(h.examPick ?? {})) if (v) exam.push(`${k}: ${v}`)
  out.push(exam.length ? `PE — ${exam.join('؛ ')}` : null)
  out.push(line('Problem list', h.problemList), line('Labs', h.labNotes), line('Imaging', h.imagingNotes), line('Other tests', h.otherTests))
  out.push(line('Impression', p.diagnosis), line('Underlying', p.underlyingDisease), line('Key points', p.keyPoints))
  return out
    .filter((l) => l !== null)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
