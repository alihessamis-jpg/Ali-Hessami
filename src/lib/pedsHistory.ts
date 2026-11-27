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
  surgicalHx?: string
  familyFlags?: TriMap
  ros?: TriMap
  rosNotes?: string
  hc?: string

  completedSteps?: string[]
  updatedAt?: string
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
  { id: 'family', label: 'سابقه خانوادگی', en: 'Family history' },
  { id: 'ros', label: 'مرور سیستم‌ها', en: 'Review of systems' },
  { id: 'vitals', label: 'علائم حیاتی', en: 'Vitals & measurements' },
  { id: 'exam', label: 'معاینه', en: 'Physical exam' },
  { id: 'summary', label: 'جمع‌بندی', en: 'Summary & diagnosis' },
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
  { id: 'uti', label: 'عفونت ادراری قبلی (UTI)' },
  { id: 'vur', label: 'ریفلاکس / هیدرونفروز' },
  { id: 'aki', label: 'AKI قبلی' },
  { id: 'nephrotic', label: 'سندرم نفروتیک' },
  { id: 'stones', label: 'سنگ کلیه' },
  { id: 'htn', label: 'فشار خون بالا' },
  { id: 'admissions', label: 'بستری قبلی' },
  { id: 'surgery', label: 'جراحی' },
  { id: 'transfusion', label: 'تزریق خون' },
  { id: 'seizure', label: 'تشنج' },
  { id: 'asthma', label: 'آسم / آلرژی' },
  { id: 'cardiac', label: 'بیماری قلبی' },
]

export const FAMILY: Option[] = [
  { id: 'ckd', label: 'بیماری مزمن کلیه (CKD)' },
  { id: 'dialysis', label: 'دیالیز / پیوند کلیه' },
  { id: 'stones', label: 'سنگ کلیه' },
  { id: 'cysts', label: 'کلیه پلی‌کیستیک' },
  { id: 'hematuria', label: 'هماچوری' },
  { id: 'deafness', label: 'ناشنوایی (Alport)' },
  { id: 'htn', label: 'فشار خون بالا' },
  { id: 'dm', label: 'دیابت' },
  { id: 'suddenDeath', label: 'مرگ زودرس / ناگهانی' },
  { id: 'siblingDeath', label: 'فوت خواهر / برادر' },
]

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
  out.push(triLine('PMH', h.pmhFlags, PMH), line('PMH', p.pmh), line('Surgical', h.surgicalHx))
  out.push(triLine('FH', h.familyFlags, FAMILY), line('FH', p.familyHx))
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
  out.push(exam.length ? `PE — ${exam.join('؛ ')}` : null)
  out.push(line('Impression', p.diagnosis), line('Underlying', p.underlyingDisease), line('Key points', p.keyPoints))
  return out
    .filter((l) => l !== null)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
