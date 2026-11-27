// Physical exam for the pediatric history wizard (step 11): system list with
// standard "normal" text, quick picks and short nephrology-minded teaching
// notes, plus age-based HR / RR reference ranges (PALS).
import type { PatientScalarKey } from '../types/domain'

export interface ExamPick {
  id: string
  label: string
  options: string[]
  /** index of the normal option */
  normal: number
}

export interface ExamSystem {
  id: string
  title: string
  en: string
  /** writes to this patients column instead of peds_history.exam */
  col?: PatientScalarKey
  normal: string
  placeholder: string
  picks?: ExamPick[]
  teach?: string[]
  /** only shown up to this age (months); shown when age is unknown */
  maxAgeMonths?: number
}

export const EXAM_GENERAL: ExamSystem = {
  id: 'general',
  title: 'وضعیت عمومی',
  en: 'General Appearance',
  col: 'exGeneral',
  normal: 'Alert, active and interactive, not ill- or toxic-appearing, well hydrated, no respiratory distress',
  placeholder: 'هوشیاری و فعالیت، تعامل با والدین، بی‌قراری یا خواب‌آلودگی، دیسترس تنفسی، علائم دهیدراتاسیون (اشک، مخاط، چشم فرورفته)، ظاهر بدحال/Toxic…',
  teach: [
    'ظاهر toxic + هیپوتانسیون: به سپسیس، HUS با درگیری چندارگانی یا بحران آدیسونی فکر کنید.',
    'تنفس عمیق کوسمال: اسیدوز متابولیک (CKD، RTA، DKA).',
    'رنگ‌پریدگی + خستگی در CKD: آنمی و اورمی را بسنجید.',
  ],
}

export const EXAM_SYSTEMS: ExamSystem[] = [
  {
    id: 'skin',
    title: 'پوست',
    en: 'Skin',
    col: 'exSkin',
    normal: 'Warm and pink, no pallor, jaundice or cyanosis, no rash or petechiae, normal turgor, CRT < 2 s',
    placeholder: 'زردی، رنگ‌پریدگی، سیانوز، راش، پتشی، لکه مغولی، همانژیوم، لکه شیرقهوه، تورگور، Capillary refill…',
    teach: [
      'پورپورای قابل لمس در اندام تحتانی و باسن: HSP (IgA vasculitis) — ادرار را چک کنید.',
      'پتشی + آنمی + AKI: HUS / TTP.',
      'لکه شیرقهوه (NF1): تنگی شریان کلیوی و فشار خون.',
      'لکه Ash-leaf (TSC): آنژیومیولیپوم و کیست کلیه.',
      'راش مالار / دیسکوئید: لوپوس (LN).',
    ],
  },
  {
    id: 'head',
    title: 'سر و فونتانل',
    en: 'Head & Fontanelles',
    normal: 'Normocephalic, anterior fontanelle open, flat and soft, sutures normal',
    placeholder: 'شکل جمجمه، فونتانل قدامی و خلفی (اندازه و وضعیت)، سوچورها، کرانیوسینوستوز، کفالوهماتوم، پلاژیوسفالی…',
    picks: [{ id: 'af', label: 'فونتانل قدامی', options: ['صاف (نرمال)', 'برجسته', 'فرورفته', 'بسته'], normal: 0 }],
    teach: ['فونتانل فرورفته: دهیدراتاسیون.', 'فونتانل برجسته + فشار خون بالا: انسفالوپاتی هیپرتانسیو یا افزایش ICP.', 'فونتانل باز و پهن دیررس: ریکتز (CKD-MBD، ریکتز هیپوفسفاتمیک).'],
    maxAgeMonths: 36,
  },
  {
    id: 'eyes',
    title: 'چشم',
    en: 'Eyes',
    normal: 'Red reflex present bilaterally, no periorbital edema, conjunctivae pink, sclerae anicteric',
    placeholder: 'رفلکس قرمز (رتینوبلاستوما، کاتاراکت مادرزادی)، استرابیسم (Hirschberg / Cover test)، ترشح، ملتحمه، اسکلرا، ادم دور چشم…',
    picks: [{ id: 'redReflex', label: 'رفلکس قرمز', options: ['دوطرفه موجود', 'غیرطبیعی / سفید', 'بررسی نشد'], normal: 0 }],
    teach: [
      'ادم دور چشم صبحگاهی: اولین نشانه سندرم نفروتیک.',
      'لنتیکونوس قدامی / لکه‌های رتین: Alport.',
      'کاتاراکت مادرزادی + RTA پروگزیمال: سندرم Lowe.',
      'آنیریدی: WAGR (تومور ویلمز).',
      'کراتوپاتی نواری / رسوب کریستال قرنیه: هیپرکلسمی، سیستینوز.',
    ],
  },
  {
    id: 'ears',
    title: 'گوش',
    en: 'Ears',
    normal: 'External ears normally formed and placed, no preauricular pits or tags, tympanic membranes normal',
    placeholder: 'ساختمان خارجی، حدت شنوایی، ترشح، پرده گوش، وبر و رینه، اتوسکوپی، تندرنس تراگوس و ماستوئید…',
    teach: ['Pit یا Tag پره‌آوریکولار، گوش بدشکل: سندرم BOR و آنومالی کلیه — سونوی کلیه.', 'کاهش شنوایی حسی‌عصبی: Alport، dRTA (ATP6V1B1).', 'گوش پایین‌قرار: Potter (الیگوهیدرآمنیوس).'],
  },
  {
    id: 'mouth',
    title: 'دهان و حلق',
    en: 'Mouth & Throat',
    normal: 'Moist mucosa, no pharyngeal erythema or exudate, tonsils normal, palate intact',
    placeholder: 'مخاط (رطوبت)، دندان‌ها، برفک، لوزه‌ها (هایپرتروفی، اگزودا)، شکاف کام، کام…',
    teach: ['مخاط خشک: دهیدراتاسیون — prerenal AKI.', 'فارنژیت یا زرد زخم ۱–۳ هفته قبل: PSGN.', 'زخم‌های دهانی: لوپوس، بهجت.'],
  },
  {
    id: 'neck',
    title: 'گردن',
    en: 'Neck',
    normal: 'Supple, no lymphadenopathy, no thyromegaly, JVP not raised',
    placeholder: 'غدد لنفاوی، توده، انحراف نای، تیروئید، JVP…',
    teach: ['JVP بالا: افزایش حجم (AKI الیگوریک، نفریت).', 'Webbed neck: ترنر (کلیه نعل اسبی).'],
  },
  {
    id: 'lymph',
    title: 'غدد لنفاوی',
    en: 'Lymph Nodes',
    normal: 'No significant cervical, axillary, inguinal or supraclavicular lymphadenopathy',
    placeholder: 'سرویکال، آگزیلاری، اینگوینال، سوپراکلاویکولار، ساب‌مندیبولار، اپی‌تروکلئار (سایز، قوام، تحرک، تندرنس)',
    teach: ['لنفادنوپاتی ژنرالیزه + نفروتیک: به لنفوم و ثانویه بودن NS فکر کنید.'],
  },
  {
    id: 'chest',
    title: 'قفسه سینه و ریه',
    en: 'Chest & Lungs',
    col: 'exResp',
    normal: 'Symmetric expansion, no retractions, vesicular breath sounds bilaterally, no crackles or wheeze',
    placeholder: 'مشاهده: تعداد تنفس، رتراکشن، ناله (Grunting)، پرش پره بینی\nسمع: ویزینگ، کراکل، استریدور، کاهش صدا',
    teach: ['کراکل پایه‌ها + ادم: Fluid overload.', 'کاهش صدا در قاعده: افیوژن پلور (نفروتیک).', 'هموپتیزی + هماچوری: سندرم پولمونری-رنال (GPA، Anti-GBM).'],
  },
  {
    id: 'heart',
    title: 'قلب',
    en: 'Heart',
    col: 'exCVS',
    normal: 'S1 S2 normal, no murmur, gallop or rub, femoral pulses palpable and equal, CRT < 2 s',
    placeholder: 'S1 و S2، سوفل (معصوم یا پاتولوژیک)، نبض‌های فمورال، Capillary refill…',
    teach: ['نبض فمورال ضعیف / تأخیری: کوآرکتاسیون — فشار خون ۴ اندام.', 'Rub: پریکاردیت اورمیک.', 'گالوپ S3: Overload / نارسایی قلب.'],
  },
  {
    id: 'abdomen',
    title: 'شکم',
    en: 'Abdomen',
    col: 'exAbd',
    normal: 'Soft, non-tender, non-distended, no organomegaly, no palpable kidney, mass or bladder, no ascites, no bruit',
    placeholder: 'دیستنشن، بندناف، فتق نافی یا اینگوینال، ارگانومگالی، توده، تندرنس، کلیه قابل لمس، گلوب مثانه، آسیت، بروئی…',
    teach: [
      'توده پهلو: هیدرونفروز، MCDK، ARPKD، تومور ویلمز (از لمس مکرر پرهیز کنید).',
      'گلوب مثانه در پسر: PUV.',
      'دیواره شل و چروکیده شکم: Prune-belly.',
      'بروئی شکمی: تنگی شریان کلیوی.',
      'آسیت / Shifting dullness: نفروتیک.',
    ],
  },
  {
    id: 'genitalia',
    title: 'دستگاه تناسلی',
    en: 'Genitalia',
    col: 'exGU',
    normal: 'Normal external genitalia, testes descended bilaterally, no hypospadias, no labial adhesion',
    placeholder: 'پسران: بیضه‌ها در اسکروتوم (UDT)، هایپوسپادیاس، هیدروسل، فیموز\nدختران: چسبندگی لابیا، ترشح، ابهام تناسلی\nمرحله تانر در نوجوانان',
    teach: ['هایپوسپادیاس + بیضه نزول‌نکرده: DSD، WT1 (Denys-Drash / Frasier).', 'تنگی مئاتوس / فیموز شدید: UTI مکرر.', 'هیدروسل: نفروتیک یا دیالیز صفاقی.'],
  },
  {
    id: 'edema',
    title: 'ادم',
    en: 'Edema',
    col: 'exEdema',
    normal: 'No edema',
    placeholder: 'محل (پلک، پره‌تیبیال، ساکرال، اسکروتوم/لابیا)، Pitting، درجه، آنازارک…',
    picks: [{ id: 'grade', label: 'درجه ادم', options: ['ندارد', '+1', '+2', '+3', '+4 / آنازارک'], normal: 0 }],
    teach: ['ادم ساکرال در شیرخوار خوابیده را نبینید از قلم بیفتد.', 'ادم + فشار خون بالا + هماچوری: نفریت. ادم + فشار نرمال + پروتئینوری شدید: نفروتیک.'],
  },
  {
    id: 'hydration',
    title: 'وضعیت هیدراتاسیون',
    en: 'Hydration',
    col: 'exHydration',
    normal: 'Well hydrated',
    placeholder: 'اشک، مخاط، چشم فرورفته، تورگور، CRT، نبض، ادرار اخیر…',
    picks: [{ id: 'status', label: 'دهیدراتاسیون', options: ['ندارد', 'خفیف', 'متوسط', 'شدید'], normal: 0 }],
    teach: ['دهیدراتاسیون متوسط تا شدید + الیگوری: prerenal AKI — قبل از نفروتوکسیک‌ها حجم را اصلاح کنید.'],
  },
  {
    id: 'hips',
    title: 'لگن (DDH)',
    en: 'Hips',
    normal: 'Barlow and Ortolani negative, symmetric thigh folds, full abduction',
    placeholder: 'تست‌های Barlow و Ortolani، Galeazzi، عدم قرینگی چین‌های ران، محدودیت ابداکشن…',
    picks: [{ id: 'bo', label: 'بارلو / ارتولانی', options: ['منفی', 'مثبت', 'بررسی نشد'], normal: 0 }],
    maxAgeMonths: 12,
  },
  {
    id: 'msk',
    title: 'اسکلتی عضلانی',
    en: 'Musculoskeletal',
    col: 'exExtrem',
    normal: 'Full range of motion, no joint swelling or tenderness, no deformity, normal gait',
    placeholder: 'اندام‌ها، تورم یا تندرنس مفاصل، راه رفتن، دفورمیتی، کلاویکل (نوزاد)…',
    teach: ['پهن شدن مچ، تسبیح دنده‌ای، ژنو واروم/والگوم: ریکتز (CKD-MBD، هیپوفسفاتمیک، dRTA).', 'آرتریت: HSP، لوپوس.', 'ناخن و کشکک دیسپلاستیک: Nail-patella (پروتئینوری).'],
  },
  {
    id: 'spine',
    title: 'ستون فقرات',
    en: 'Spine',
    normal: 'Straight spine, no sacral dimple, tuft, sinus or lipoma',
    placeholder: 'اسکولیوز، دیمپل ساکرال، دسته مو، سینوس، لیپوم…',
    teach: ['دیمپل / دسته مو / لیپوم ساکرال: Tethered cord و مثانه نوروژنیک — در UTI مکرر و اختلال دفع.'],
  },
  {
    id: 'neuro',
    title: 'عصبی',
    en: 'Neurological',
    col: 'exNeuro',
    normal: 'Alert, normal tone and power, DTRs 2+ and symmetric, no meningeal signs, cranial nerves intact',
    placeholder: 'سطح هوشیاری، تون عضلانی، قدرت، رفلکس‌های وتری، علائم مننژ، اعصاب کرانیال…',
    teach: ['سردرد + تشنج + تاری دید با فشار بالا: PRES / انسفالوپاتی هیپرتانسیو.', 'هیپورفلکسی و ضعف: هیپوکالمی (Bartter، Gitelman، dRTA).', 'Chvostek / Trousseau: هیپوکلسمی.'],
  },
  {
    id: 'reflexes',
    title: 'رفلکس‌های بدوی',
    en: 'Primitive Reflexes',
    normal: 'Moro, rooting, sucking, palmar and plantar grasp present and symmetric',
    placeholder: 'مورو، مکیدن، روتینگ، چنگ‌زدن کف دست و پا، بابنسکی (فیزیولوژیک)، Tonic neck…',
    maxAgeMonths: 12,
  },
  {
    id: 'dysmorphic',
    title: 'دیسمورفیسم',
    en: 'Dysmorphic Features',
    normal: 'No dysmorphic features',
    placeholder: 'شکل صورت، فاصله چشم‌ها، گوش‌ها (محل و شکل)، چین سیمین، انگشتان، فیلتروم، شریان نافی منفرد…',
    teach: [
      'سندرم‌های همراه آنومالی کلیه: Down، Turner (نعل اسبی)، Williams (RAS، هیپرکلسمی)، VACTERL، BOR، CHARGE.',
      'Potter facies: الیگوهیدرآمنیوس ناشی از آژنزی / دیسپلازی کلیه.',
      'همی‌هیپرتروفی / ماکروگلوسی: Beckwith-Wiedemann (ویلمز).',
    ],
  },
]

export function visibleExamSystems(ageMonths: number | null): ExamSystem[] {
  return EXAM_SYSTEMS.filter((s) => s.maxAgeMonths == null || ageMonths == null || ageMonths <= s.maxAgeMonths)
}

/** PALS 2020 awake heart rate and respiratory rate ranges. */
export function vitalRanges(ageMonths: number | null): { hr: [number, number]; rr: [number, number]; label: string } | null {
  if (ageMonths == null) return null
  if (ageMonths < 1) return { hr: [100, 205], rr: [30, 53], label: 'نوزاد' }
  if (ageMonths < 12) return { hr: [100, 180], rr: [30, 53], label: 'شیرخوار' }
  if (ageMonths < 36) return { hr: [98, 140], rr: [22, 37], label: 'نوپا' }
  if (ageMonths < 72) return { hr: [80, 120], rr: [20, 28], label: 'پیش‌دبستانی' }
  if (ageMonths < 144) return { hr: [75, 118], rr: [18, 25], label: 'سن مدرسه' }
  return { hr: [60, 100], rr: [12, 20], label: 'نوجوان' }
}
