// Structured, Persian «دارویاب» profiles (HistoMed-style) built ONLY from the
// Harriet Lane Handbook 23e monograph already in drug_reference. Every item
// carries the book page. Anything the book does not say is left out — no
// mechanism, off-label list or % frequencies are invented.
//
// Levels are derived from the book's own wording:
//   contraindications: "contraindicated" → absolute; "avoid / use with caution" → relative
//   interactions: "avoid" → avoid (red); "increase / decrease levels" → monitor (amber)
//   adverse effects: grouped as the book groups them ("major" / "may also occur" /
//   "have been reported"); `serious` marks life-threatening events (Nephron's flag,
//   shown as such in the UI).
//
// Pilot set: tacrolimus, cyclosporine, mycophenolate, prednisone.

export interface ProfileItem {
  text: string
  /** extra line under the item */
  note?: string
  page: string
}

export interface ProfileIndication extends ProfileItem {
  who?: string
}

export interface ProfileContra extends ProfileItem {
  level: 'absolute' | 'relative'
}

export interface ProfileAdverse extends ProfileItem {
  group: 'major' | 'other' | 'reported'
  serious?: boolean
}

export interface ProfileInteraction extends ProfileItem {
  /** the interacting drugs, in English as in the book */
  agents: string
  effect: 'increase' | 'decrease' | 'other'
  level: 'avoid' | 'monitor'
}

export interface DrugProfile {
  sourceKey: string
  nameFa: string
  nameEn: string
  classFa: string
  summary: string
  /** "Dose by BSA/weight", tags shown in the header */
  tags?: string[]
  indications: ProfileIndication[]
  contraindications: ProfileContra[]
  adverse: ProfileAdverse[]
  interactions: ProfileInteraction[]
  monitoring: ProfileItem[]
  administration: ProfileItem[]
}

export const DRUG_PROFILES: Record<string, DrugProfile> = {
  'hl23:tacrolimus': {
    sourceKey: 'hl23:tacrolimus',
    nameFa: 'تاکرولیموس',
    nameEn: 'Tacrolimus',
    classFa: 'سرکوب‌کننده ایمنی (مهارکننده کلسینورین)',
    summary:
      'سرکوب‌کننده ایمنی برای پیشگیری از رد پیوند کلیه، کبد و قلب (سیستمیک) و درمان خط دوم درماتیت آتوپیک (موضعی). دوز بر اساس سطح Trough تیتر می‌شود؛ مهم‌ترین مسائل: نفروتوکسیسیته، تداخلات CYP 3A4 و طولانی شدن QT.',
    tags: ['پایش سطح Trough', 'CYP 3A4 / P-gp'],
    indications: [
      { text: 'پیوند کلیه — پیشگیری از رد پیوند', who: 'شیرخوار، کودک و نوجوان؛ بزرگسال', note: 'PO: 0.2–0.3 mg/kg/24 hr ÷ Q12 hr؛ IV: 0.06 mg/kg/24 hr انفوزیون مداوم', page: '1153' },
      { text: 'پیوند کبد', who: 'شیرخوار، کودک و نوجوان؛ بزرگسال', note: 'PO: 0.15–0.2 mg/kg/24 hr ÷ Q12 hr', page: '1153' },
      { text: 'پیوند قلب', who: 'شیرخوار، کودک و نوجوان؛ بزرگسال', note: 'PO: 0.1–0.3 mg/kg/24 hr ÷ Q12 hr؛ با القای تخلیه‌کننده سلول دوز اولیه کمتر', page: '1153' },
      { text: 'پیوند مغز استخوان (BMT)', note: 'دوز و سطح مشابه پیوند کبد، از ۱ روز قبل از BMT استفاده شده است', page: '1153' },
      { text: 'درماتیت آتوپیک (پماد موضعی)', who: '≥۲ سال: 0.03%؛ ≥۱۶ سال: 0.03% یا 0.1%', note: 'خط دوم، کوتاه‌مدت و متناوب؛ اگر پس از ۶ هفته بهبود نیافت تشخیص بازبینی شود', page: '1153' },
    ],
    contraindications: [
      { level: 'absolute', text: 'فرم وریدی در حساسیت به polyoxyl 60 hydrogenated castor oil (Cremophor)', page: '1153' },
      { level: 'absolute', text: 'پماد موضعی: کودکان زیر ۲ سال، بیماران دچار نقص ایمنی، پانسمان بسته (Occlusive)', page: '1154' },
      { level: 'relative', text: 'QT طولانی', note: 'در بیماران با QT طولانی از مصرف پرهیز شود', page: '1153' },
      { level: 'relative', text: 'نارسایی کلیه یا کبد', note: 'کاهش دوز لازم است', page: '1154' },
      { level: 'relative', text: 'بیماری پوستی با نقص سد پوستی (پماد)', note: 'خطر جذب سیستمیک', page: '1154' },
    ],
    adverse: [
      { group: 'major', text: 'اختلال عملکرد کلیه (نفروتوکسیسیته)', note: 'با داروهای نفروتوکسیک دیگر و مهارکننده‌های CYP 3A بیشتر می‌شود', page: '1154' },
      { group: 'major', text: 'هیپرتانسیون', page: '1154' },
      { group: 'major', text: 'ترمور، سردرد، بی‌خوابی', page: '1154' },
      { group: 'major', text: 'اسهال، یبوست، تهوع', page: '1154' },
      { group: 'other', text: 'هیپوکالمی، هیپومنیزیمی', page: '1154' },
      { group: 'other', text: 'هیپرگلیسمی', page: '1154' },
      { group: 'other', text: 'عفونت‌ها', page: '1154' },
      { group: 'other', text: 'لنفوم', serious: true, page: '1154' },
      { group: 'other', text: 'گیجی، افسردگی، نوروپاتی اپتیک', page: '1154' },
      { group: 'other', text: 'افزایش آنزیم‌های کبدی، اختلالات انعقادی', page: '1154' },
      { group: 'reported', text: 'HUS، TTP و آنمی همولیتیک', serious: true, page: '1154' },
      { group: 'reported', text: 'آگرانولوسیتوز', serious: true, page: '1154' },
      { group: 'reported', text: 'سوراخ شدن دستگاه گوارش', serious: true, page: '1154' },
      { group: 'other', text: 'پماد: سوزش و خارش پوست، علائم شبه‌آنفلوانزا، عفونت پوستی؛ هشدار FDA درباره خطر احتمالی سرطان', page: '1154' },
    ],
    interactions: [
      {
        effect: 'increase',
        level: 'monitor',
        agents: 'Calcium channel blockers, azoles (ketoconazole, itraconazole, fluconazole, clotrimazole, posaconazole), macrolides (erythromycin, clarithromycin), cimetidine, cyclosporine, danazol, methylprednisolone, grapefruit juice, Seville oranges',
        text: 'افزایش سطح تاکرولیموس',
        note: 'اسهال شدید هم سطح را بالا می‌برد. پایش Trough.',
        page: '1154',
      },
      {
        effect: 'decrease',
        level: 'monitor',
        agents: 'Carbamazepine, phenobarbital, phenytoin, rifampin, rifabutin, caspofungin, sirolimus',
        text: 'کاهش سطح تاکرولیموس',
        note: 'پایش Trough؛ خطر رد پیوند.',
        page: '1154',
      },
      { effect: 'other', level: 'avoid', agents: 'Live attenuated vaccines', text: 'واکسن‌های زنده ضعیف‌شده', note: 'از تجویز پرهیز شود.', page: '1154' },
      { effect: 'other', level: 'monitor', agents: 'Sirolimus', text: 'افزایش خطر ترومبوز شریان کبدی', page: '1154' },
      { effect: 'other', level: 'monitor', agents: 'Nephrotoxic drugs', text: 'افزایش نفروتوکسیسیته', page: '1154' },
      { effect: 'other', level: 'monitor', agents: 'Other CYP 3A inhibitors/substrates', text: 'احتمال طولانی شدن QT', page: '1154' },
    ],
    monitoring: [
      { text: 'سطح Trough (درست قبل از دوز، در حالت پایدار)؛ حالت پایدار معمولاً پس از ۲–۵ روز', page: '1154' },
      { text: 'پیوند کلیه: Trough خون کامل 7–20 ng/mL در ۳ ماه اول و 5–15 ng/mL پس از ۳ ماه', page: '1154' },
      { text: 'پیوند کبد: 5–20 ng/mL در ماه ۱ تا ۱۲', page: '1154' },
      { text: 'تفسیر سطح به پروتکل و روش اندازه‌گیری (ELISA / MEIA / HPLC) بستگی دارد', page: '1154' },
      { text: 'متابولیزرهای سریع CYP 3A5 ممکن است ۱.۵ تا ۲ برابر دوز اولیه لازم داشته باشند (حداکثر 0.3 mg/kg/24 hr)', page: '1154' },
      { text: 'کودکان ممکن است دوز mg/kg بالاتری از بزرگسالان لازم داشته باشند', page: '1153' },
    ],
    administration: [
      { text: 'شروع معمولاً ۶ ساعت یا بیشتر پس از پیوند؛ راه خوراکی ارجح است', page: '1154' },
      { text: 'خوراکی با معده خالی (۱ ساعت قبل یا ۲ ساعت بعد از غذا)', page: '1154' },
      { text: 'فرم‌های پیوسته‌رهش با هم قابل جایگزینی نیستند؛ تبدیل به Astagraf XL یک‌به‌یک (mg به mg)؛ به Envarsus XR با ۸۰٪ دوز فرم فوری', page: '1154' },
      { text: 'انفوزیون وریدی با غلظت 0.004–0.02 mg/mL در NS یا D5W', page: '1154' },
    ],
  },

  'hl23:cyclosporine-cyclosporine-microemulsion-cyclosporine-modified': {
    sourceKey: 'hl23:cyclosporine-cyclosporine-microemulsion-cyclosporine-modified',
    nameFa: 'سیکلوسپورین',
    nameEn: 'Cyclosporine',
    classFa: 'سرکوب‌کننده ایمنی (مهارکننده کلسینورین)',
    summary:
      'مهارکننده کلسینورین برای پیشگیری از رد پیوند (فرم‌های Sandimmune، Neoral و Gengraf) و قطره چشمی برای خشکی چشم و کراتوکونژنکتیویت بهاره. کودکان ممکن است ۲ تا ۳ برابر دوز بزرگسالان لازم داشته باشند؛ سطح Trough پایش می‌شود.',
    tags: ['پایش سطح Trough', 'CYP 3A4 / P-gp'],
    indications: [
      {
        text: 'پیشگیری از رد پیوند',
        note: 'PO: 15 mg/kg/24 hr تک‌دوز ۴–۱۲ ساعت قبل از پیوند، همان دوز Q12–24 hr برای ۱–۲ هفته، سپس هفته‌ای ۵٪ کاهش تا 3–10 mg/kg/24 hr. IV: 5–6 mg/kg/24 hr طی ۲–۶ ساعت',
        page: '883–884',
      },
      { text: 'کراتوکونژنکتیویت سیکا (قطره چشمی)', who: 'Restasis ≥۱۶ سال؛ Cequa ≥۱۸ سال', page: '884' },
      { text: 'کراتوکونژنکتیویت بهاره شدید (قطره چشمی)', who: 'Verkazia ≥۴ سال؛ Restasis ۵–۱۴ سال (داده محدود)', page: '884' },
    ],
    contraindications: [
      { level: 'relative', text: 'مصرف همزمان داروهای نفروتوکسیک', note: 'آمفوتریسین B، آمینوگلیکوزیدها، NSAIDها، تاکرولیموس', page: '884' },
      { level: 'relative', text: 'نارسایی کلیه یا کبد', note: 'پایش بیشتر و تعدیل دوز', page: '884' },
      { level: 'relative', text: 'پسوریازیس با سابقه PUVA، متوترکسات، UVB، قطران یا پرتودرمانی', note: 'افزایش خطر بدخیمی پوست با Neoral / Gengraf', page: '884' },
    ],
    adverse: [
      { group: 'major', text: 'نفروتوکسیسیته', page: '884' },
      { group: 'major', text: 'هیپرتانسیون', page: '884' },
      { group: 'major', text: 'هیپرکالمی، هیپومنیزیمی، هیپراوریسمی', page: '884' },
      { group: 'major', text: 'هیپرتریکوز (Hirsutism)، آکنه، هیپرپلازی لثه', page: '884' },
      { group: 'major', text: 'هپاتوتوکسیسیته', page: '884' },
      { group: 'major', text: 'ترمور، سردرد، علائم گوارشی، لکوپنی، سینوزیت', page: '884' },
      { group: 'reported', text: 'انسفالوپاتی، تشنج، اختلال دید و حرکت، کاهش هوشیاری', serious: true, note: 'به‌ویژه در پیوند کبد', page: '884' },
      { group: 'reported', text: 'عفونت‌های فرصت‌طلب و فعال شدن عفونت‌های ویروسی نهفته', serious: true, page: '884' },
      { group: 'reported', text: 'نفروپاتی BK ویروس در پیوند کلیه', serious: true, page: '884' },
      { group: 'other', text: 'قطره چشمی: سوزش چشم', page: '884' },
    ],
    interactions: [
      {
        effect: 'increase',
        level: 'monitor',
        agents: 'Fluconazole, ketoconazole, itraconazole, voriconazole, erythromycin, clarithromycin, diltiazem, verapamil, nicardipine, carvedilol, corticosteroids, nefazodone, boceprevir, telaprevir',
        text: 'افزایش سطح سیکلوسپورین',
        page: '884',
      },
      {
        effect: 'decrease',
        level: 'monitor',
        agents: 'Carbamazepine, oxcarbazepine, phenobarbital, phenytoin, rifampin, nafcillin, bosentan, octreotide',
        text: 'کاهش سطح سیکلوسپورین',
        page: '884',
      },
      {
        effect: 'other',
        level: 'monitor',
        agents: 'Bosentan, dabigatran, methotrexate, repaglinide, anthracyclines (doxorubicin, mitoxantrone, daunorubicin)',
        text: 'سیکلوسپورین سطح یا سمیت این داروها را بالا می‌برد',
        page: '884',
      },
      { effect: 'other', level: 'monitor', agents: 'Nifedipine', text: 'هیپرپلازی لثه', page: '884' },
      { effect: 'other', level: 'monitor', agents: 'Amphotericin B, aminoglycosides, NSAIDs, tacrolimus', text: 'افزایش نفروتوکسیسیته', page: '884' },
    ],
    monitoring: [
      { text: 'سطح Trough (درست قبل از دوز)؛ حالت پایدار پس از ۳–۵ روز', page: '884' },
      { text: 'تفسیر به پروتکل، روش اندازه‌گیری (RIA / HPLC) و نمونه خون کامل یا سرم بستگی دارد', page: '884' },
      { text: 'پایش و تعدیل بیشتر در نارسایی کلیه و کبد و هنگام تغییر فرم دارویی', page: '884' },
      { text: 'نیمه‌عمر پلاسمایی ۶–۲۴ ساعت', page: '884' },
    ],
    administration: [
      { text: 'تبدیل Sandimmune به Neoral یک‌به‌یک توصیه شده، اما به دلیل جذب بهتر Neoral و Gengraf ممکن است دوز کمتری لازم باشد', page: '883' },
      { text: 'قطره چشمی: لنز قبل از مصرف خارج و ۱۵ دقیقه بعد گذاشته شود؛ با اشک مصنوعی ۱۵ دقیقه فاصله', page: '884' },
    ],
  },

  'hl23:mycophenolate': {
    sourceKey: 'hl23:mycophenolate',
    nameFa: 'مایکوفنولات',
    nameEn: 'Mycophenolate',
    classFa: 'سرکوب‌کننده ایمنی (ضد متابولیت)',
    summary:
      'پیش‌داروی مایکوفنولیک اسید برای پیشگیری از رد پیوند کلیه، کبد و قلب و در سندرم نفروتیک وابسته به استروئید یا با عودهای مکرر. CellCept و Myfortic میلی‌گرم به میلی‌گرم قابل جایگزینی نیستند. خطر سقط و ناهنجاری مادرزادی دارد.',
    tags: ['دوز بر اساس BSA', 'تراتوژن'],
    indications: [
      { text: 'سندرم نفروتیک با عودهای مکرر', note: '12.5–18 mg/kg/dose یا 600 mg/m²/dose PO BID (حداکثر 2000 mg/24 hr) به مدت ۱–۲ سال همراه با کاهش تدریجی پردنیزون', page: '1045' },
      { text: 'سندرم نفروتیک وابسته به استروئید', note: '12–18 mg/kg/dose یا 600 mg/m²/dose PO BID (حداکثر 2000 mg/24 hr) حداقل ۱۲ ماه', page: '1045' },
      { text: 'پیوند کلیه', who: 'شیرخوار ≥۳ ماه، کودک و نوجوان', note: 'CellCept: 600 mg/m²/dose PO/IV BID (حداکثر 2000 mg/24 hr). Myfortic (≥۵ سال): 400 mg/m²/dose BID (حداکثر 720 mg BID)', page: '1045' },
      { text: 'پیوند قلب و کبد', who: 'شیرخوار ≥۳ ماه، کودک و نوجوان', note: 'سوسپانسیون: 600 تا 900 mg/m²/dose BID (حداکثر 3000 mg/24 hr)', page: '1045' },
    ],
    contraindications: [
      { level: 'absolute', text: 'Myfortic در کمبود HGPRT (Lesch-Nyhan، Kelley-Seegmiller)', note: 'تشدید بیماری: افزایش اسید اوریک، آرتریت، توفوس، سنگ، نارسایی کلیه', page: '1046' },
      { level: 'relative', text: 'بارداری', note: 'افزایش سقط سه‌ماهه اول و ناهنجاری‌ها (گوش خارجی، شکاف کام و لب، اندام، قلب، مری)', page: '1045' },
      { level: 'relative', text: 'بیماری فعال گوارشی', page: '1046' },
      { level: 'relative', text: 'GFR کمتر از 25 mL/min/1.73m² (خارج از دوره بلافاصله پس از پیوند)', note: 'در بزرگسالان از دوز بیش از 2 g/24 hr پرهیز شود', page: '1046' },
      { level: 'relative', text: 'نوتروپنی (ANC کمتر از 1300)', note: 'دوز قطع یا کاهش یابد', page: '1046' },
      { level: 'relative', text: 'Myfortic در BSA کمتر از 1.19 m²', note: 'توصیه نمی‌شود', page: '1045' },
    ],
    adverse: [
      { group: 'major', text: 'اسهال، استفراغ', page: '1046' },
      { group: 'major', text: 'سرکوب مغز استخوان، آنمی', page: '1046' },
      { group: 'major', text: 'سردرد، هیپرتانسیون، تب', page: '1046' },
      { group: 'major', text: 'عفونت‌های فرصت‌طلب و سپسیس', serious: true, page: '1046' },
      { group: 'other', text: 'خواب‌آلودگی', page: '1046' },
      { group: 'other', text: 'لنفوم و سایر بدخیمی‌ها', serious: true, page: '1046' },
      { group: 'reported', text: 'خونریزی گوارشی', serious: true, page: '1046' },
      { group: 'reported', text: 'PML', serious: true, page: '1046' },
      { group: 'reported', text: 'آپلازی خالص گلبول قرمز (PRCA)', serious: true, page: '1046' },
      { group: 'reported', text: 'PTLD', serious: true, page: '1046' },
      { group: 'reported', text: 'هیپوگاماگلوبولینمی، سندرم التهابی حاد', page: '1046' },
    ],
    interactions: [
      { effect: 'decrease', level: 'monitor', agents: 'PPIs, antacids, cholestyramine, cyclosporine, telmisartan', text: 'کاهش سطح مایکوفنولات', page: '1046' },
      { effect: 'increase', level: 'monitor', agents: 'Acyclovir, ganciclovir, probenecid', text: 'افزایش سطح دو طرفه', note: 'رقابت در ترشح توبولی؛ سطح هر دو دارو بالا می‌رود', page: '1046' },
      { effect: 'increase', level: 'monitor', agents: 'Salicylates', text: 'افزایش سطح آزاد مایکوفنولات', page: '1046' },
      { effect: 'other', level: 'monitor', agents: 'Phenytoin, theophylline', text: 'کاهش سطح تام و افزایش سطح آزاد این داروها', page: '1046' },
      { effect: 'other', level: 'avoid', agents: 'Live and live attenuated vaccines (including influenza)', text: 'واکسن‌های زنده', note: 'پرهیز شود؛ اثر واکسن کم می‌شود.', page: '1046' },
    ],
    monitoring: [
      { text: 'CBC: در نوتروپنی (ANC کمتر از 1300) دوز قطع یا کم شود', page: '1046' },
      { text: 'در تأخیر عملکرد گرافت پس از پیوند نیازی به تعدیل دوز نیست', page: '1046' },
    ],
    administration: [
      { text: 'خوراکی با معده خالی', page: '1046' },
      { text: 'انفوزیون وریدی طی ۲ ساعت', page: '1046' },
      { text: 'سوسپانسیون از طریق NG tube حداقل 8 Fr قابل تجویز است', page: '1046' },
      { text: 'قرص پیوسته‌رهش (Myfortic) با سایر فرم‌ها mg به mg جایگزین نشود', page: '1045' },
    ],
  },

  'hl23:prednisone': {
    sourceKey: 'hl23:prednisone',
    nameFa: 'پردنیزون',
    nameEn: 'Prednisone',
    classFa: 'کورتیکواستروئید',
    summary:
      'کورتیکواستروئید خوراکی (پیش‌داروی پردنیزولون) برای سندرم نفروتیک، حملات آسم و موارد ضدالتهابی و سرکوب ایمنی. در بیماری کبدی، پردنیزولون یا متیل‌پردنیزولون ممکن است ارجح باشد.',
    tags: ['دوز بر اساس وزن ایده‌آل در چاقی (نفروتیک)'],
    indications: [
      { text: 'سندرم نفروتیک', who: 'کودک', note: 'شروع 2 mg/kg/24 hr PO (حداکثر 60 mg/24 hr) ÷ روزانه تا TID؛ در چاقی بر اساس وزن ایده‌آل. ادامه درمان فردی؛ با نفرولوژیست مشورت شود', page: '1103' },
      { text: 'حمله حاد آسم', who: 'کودک', note: '2 mg/kg/24 hr PO ÷ روزانه تا BID به مدت ۵–۷ روز (حداکثر 80 mg/24 hr)؛ دوزهای NHLBI و GINA در تب دوز', page: '1102' },
      { text: 'ضدالتهابی / سرکوب ایمنی', who: 'کودک', note: '0.5–2 mg/kg/24 hr PO ÷ روزانه تا BID', page: '1102–1103' },
    ],
    contraindications: [
      { level: 'relative', text: 'بیماری کبدی', note: 'سطح پردنیزولون بالاتر گزارش شده؛ پردنیزولون یا متیل‌پردنیزولون ممکن است ارجح باشد', page: '1103' },
      { level: 'relative', text: 'سه‌ماهه اول بارداری', note: 'رده بارداری به D تغییر می‌کند', page: '1103' },
    ],
    adverse: [
      { group: 'major', text: 'هیپرگلیسمی', page: '1103' },
      { group: 'major', text: 'تغییرات خلقی', page: '1103' },
      { group: 'major', text: 'اسهال، تهوع، نفخ شکم', page: '1103' },
      { group: 'major', text: 'خونریزی گوارشی', serious: true, page: '1103' },
      { group: 'major', text: 'سرکوب محور HPA', serious: true, page: '1103' },
      { group: 'major', text: 'تشنج', serious: true, page: '1103' },
      { group: 'other', text: 'با مصرف طولانی: استئوپنی، نمای کوشینگوئید، کاتاراکت', page: '1103' },
    ],
    interactions: [
      { effect: 'decrease', level: 'monitor', agents: 'Barbiturates, carbamazepine, phenytoin, rifampin, isoniazid', text: 'کاهش اثر پردنیزون', page: '1103' },
      { effect: 'increase', level: 'monitor', agents: 'Estrogens', text: 'افزایش اثر پردنیزون', page: '1103' },
    ],
    monitoring: [
      { text: 'برای دوز جایگزینی فیزیولوژیک، قدرت نسبی استروئیدها و دوز بر اساس BSA: فصل ۱۰ کتاب', page: '1103' },
      { text: 'اگر درمان آسم بیش از ۵–۷ روز طول کشید، کاهش تدریجی دوز ممکن است مفید باشد', page: '1102' },
    ],
    administration: [{ text: 'پردنیزون سوبسترا و القاکننده CYP 3A3/4 است', page: '1103' }],
  },
}

export function profileFor(sourceKey: string | null | undefined): DrugProfile | null {
  if (!sourceKey) return null
  return DRUG_PROFILES[sourceKey] ?? null
}
