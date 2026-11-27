// «شرح حال اطفال» — a 13-step pediatric history, one section at a time,
// with tri-state finding chips, age-aware milestones and vaccines, and a
// sticky Next / Save / Back bar. /patients/new/history starts a new
// patient (created on the first save); /patients/:id/history edits one.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { createPatient, getPatient, resolvePedsHistory, savePedsHistory, updatePatient } from '../lib/api/patients'
import { upsertGrowthMeasurement } from '../lib/api/growth'
import { bmiCalc, bsaMosteller, schwartzEGFR } from '../lib/formulas'
import { ageToYearsMonths, formatAge, yearsMonthsToAge } from '../lib/patientAge'
import { toPersianDigits, toShamsi } from '../lib/shamsi'
import {
  ALLERGIES,
  ALL_MILESTONES,
  CONSANGUINITY,
  DELIVERY,
  FAMILY,
  FEEDING,
  HPI_PROMPTS,
  MILESTONE_GROUPS,
  NEONATAL,
  PMH,
  PRENATAL,
  CHILDHOOD_INFECTIONS,
  ROS_SYSTEMS,
  rosItems,
  type Surgery,
  SCREENING,
  SCREENING_RESULTS,
  STEPS,
  SUPPLEMENTS,
  VACCINES,
  ageFromDob,
  ageInMonths,
  buildHistorySummary,
  cycleTri,
  milestoneDelayed,
  type PedsHistory,
  type ScreeningResult,
  type TriMap,
} from '../lib/pedsHistory'
import { HxArea, HxCard, HxIcon, HxInput, HxLabel, HxSegmented, TriChips, TriLegend } from '../components/history/HistoryFields'
import type { Patient, PatientCareStatus } from '../types/domain'

const NUMERIC = new Set<keyof Patient>(['height', 'weight', 'baselineCr', 'vsTemp', 'vsHR', 'vsRR', 'vsSpo2'])

const EXAM_FIELDS: Array<{ key: keyof Patient; label: string; normal: string }> = [
  { key: 'exGeneral', label: 'General appearance', normal: 'Alert, not ill-appearing, well hydrated' },
  { key: 'exHeent', label: 'HEENT', normal: 'No periorbital edema, no pallor, no icterus' },
  { key: 'exCVS', label: 'Cardiovascular', normal: 'S1S2 normal, no murmur, CRT < 2s' },
  { key: 'exResp', label: 'Respiratory', normal: 'Clear bilaterally, no distress' },
  { key: 'exAbd', label: 'Abdomen', normal: 'Soft, non-tender, no organomegaly, no ascites, no palpable kidney' },
  { key: 'exGU', label: 'Genitourinary', normal: 'Normal external genitalia, no CVA tenderness' },
  { key: 'exExtrem', label: 'Extremities', normal: 'No deformity, pulses intact' },
  { key: 'exSkin', label: 'Skin', normal: 'No rash, no purpura' },
  { key: 'exNeuro', label: 'Neuro', normal: 'Age-appropriate, no focal deficit' },
  { key: 'exEdema', label: 'Edema', normal: 'No edema' },
  { key: 'exHydration', label: 'Hydration', normal: 'Well hydrated' },
]

const CARE: Array<{ id: Exclude<PatientCareStatus, 'expired'>; label: string }> = [
  { id: 'inpatient', label: 'بستری' },
  { id: 'outpatient', label: 'سرپایی / دیالیز' },
  { id: 'discharged', label: 'ترخیص' },
]

const YES_NO: Array<{ id: 'yes' | 'no'; label: string }> = [
  { id: 'yes', label: 'بله' },
  { id: 'no', label: 'خیر' },
]

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function HistoryWizardPage() {
  const { id: routeId } = useParams<{ id: string }>()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const isNew = routeId === 'new'
  const initialWard = (params.get('ward') as PatientCareStatus | null) ?? 'inpatient'

  const [loading, setLoading] = useState(!isNew)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [original, setOriginal] = useState<Patient | null>(null)
  const [form, setForm] = useState<Patient>({ id: '', name: '', careStatus: initialWard })
  const [hx, setHx] = useState<PedsHistory>({ historyDate: today() })
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ kind: 'ok' | 'local' | 'err'; text: string } | null>(null)
  const [dirty, setDirty] = useState(false)
  const [showAllAges, setShowAllAges] = useState(false)
  const [showMissing, setShowMissing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [openRos, setOpenRos] = useState<string | null>('gen')

  const step = Math.min(Math.max(Number(params.get('step') ?? 1) || 1, 1), STEPS.length)
  const stepsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isNew || !routeId) return
    setLoading(true)
    getPatient(routeId)
      .then((p) => {
        setOriginal(p)
        setForm(p)
        setHx({ historyDate: today(), ...resolvePedsHistory(p) })
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Failed to load patient'))
      .finally(() => setLoading(false))
  }, [routeId, isNew])

  // keep the active step chip in view
  useEffect(() => {
    const el = stepsRef.current?.querySelector<HTMLElement>('[data-active="true"]')
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])

  const ageM = ageInMonths(form)

  function set<K extends keyof Patient>(key: K, raw: string) {
    const value = NUMERIC.has(key) ? (raw === '' ? null : Number(raw)) : raw
    setForm((f) => ({ ...f, [key]: value }))
    setDirty(true)
  }
  function setH<K extends keyof PedsHistory>(key: K, value: PedsHistory[K]) {
    setHx((h) => ({ ...h, [key]: value }))
    setDirty(true)
  }
  function tri(key: 'prenatal' | 'neonatal' | 'supplements' | 'milestones' | 'vaccines' | 'allergies' | 'pmhFlags' | 'familyFlags' | 'ros' | 'infections') {
    return (id: string) => setH(key, cycleTri(hx[key] as TriMap | undefined, id))
  }

  function goto(n: number) {
    const next = new URLSearchParams(params)
    next.set('step', String(n))
    setParams(next, { replace: true })
  }

  async function persist(markDone?: string): Promise<string | null> {
    setSaving(true)
    setStatus(null)
    const nextHx: PedsHistory = {
      ...hx,
      completedSteps: markDone ? Array.from(new Set([...(hx.completedSteps ?? []), markDone])) : hx.completedSteps,
    }
    setHx(nextHx)
    try {
      let saved: Patient
      const fields: Partial<Patient> = { ...form }
      delete fields.id
      delete fields.pedsHistory
      if (isNew && !original) {
        saved = await createPatient({ ...(fields as Omit<Patient, 'id'>), name: form.name.trim() || 'بیمار بدون نام', careStatus: form.careStatus })
      } else {
        saved = await updatePatient(original?.id ?? form.id, { ...fields, name: form.name.trim() || original?.name || 'بیمار بدون نام' })
      }
      const where = await savePedsHistory(saved.id, nextHx)
      const prev = original
      if (prev && ((form.height != null && form.height !== prev.height) || (form.weight != null && form.weight !== prev.weight))) {
        upsertGrowthMeasurement(saved.id, today(), {
          ...(form.height != null && form.height !== prev.height ? { heightCm: form.height } : {}),
          ...(form.weight != null && form.weight !== prev.weight ? { weightKg: form.weight } : {}),
        }).catch(() => undefined)
      }
      setOriginal(saved)
      setForm((f) => ({ ...f, id: saved.id, name: saved.name }))
      setDirty(false)
      setStatus(
        where === 'server'
          ? { kind: 'ok', text: 'ذخیره شد' }
          : { kind: 'local', text: 'ذخیره شد — بخش‌های جدید فعلاً فقط روی همین دستگاه (migration اجرا نشده)' }
      )
      if (isNew && !original) {
        navigate(`/patients/${saved.id}/history?step=${step}`, { replace: true })
      }
      return saved.id
    } catch (e) {
      setStatus({ kind: 'err', text: e instanceof Error ? e.message : 'ذخیره نشد' })
      return null
    } finally {
      setSaving(false)
    }
  }

  async function next() {
    const ok = await persist(STEPS[step - 1].id)
    if (!ok) return
    if (step < STEPS.length) goto(step + 1)
    else navigate(`/patients/${ok}`)
  }

  function exit() {
    if (dirty && !window.confirm('تغییرات ذخیره نشده‌اند. خارج می‌شوید؟')) return
    navigate(original ? `/patients/${original.id}` : '/patients')
  }

  const done = new Set(hx.completedSteps ?? [])
  const progress = Math.round((step / STEPS.length) * 100)
  const summary = useMemo(() => buildHistorySummary(form, hx), [form, hx])

  if (loading) return <div className="hx-page"><p className="hx-hint">در حال بارگذاری…</p></div>
  if (loadError) return <div className="hx-page"><p className="form-error">{loadError}</p></div>

  const ym = ageToYearsMonths(form.age)
  const sexLabel = form.sex?.trim().toLowerCase().startsWith('f') ? 'دختر' : form.sex?.trim().toLowerCase().startsWith('m') ? 'پسر' : null
  const sexValue = sexLabel === 'دختر' ? 'Female' : sexLabel === 'پسر' ? 'Male' : undefined

  const hpiText = form.hpi ?? ''
  const missingPrompts = HPI_PROMPTS.filter((p) => !hpiText.includes(p))

  const due = (m: number) => ageM == null || ageM >= m

  return (
    <div className="hx-page" dir="rtl">
      <header className="hx-top">
        <button type="button" className="hx-round" onClick={exit} aria-label="بازگشت">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
        <div className="hx-top-title">
          <h1>
            {original ? 'شرح حال' : 'شرح حال جدید'} <span className="hx-badge">اطفال</span>
          </h1>
          <p>
            مرحله {toPersianDigits(step)} از {toPersianDigits(STEPS.length)} · {STEPS[step - 1].label}
          </p>
        </div>
        <span className={dirty ? 'hx-dot dirty' : 'hx-dot'} title={dirty ? 'ذخیره نشده' : 'ذخیره شده'} />
      </header>

      <section className="hx-pcard">
        <span className="hx-tile lg">{HxIcon.child}</span>
        <div className="hx-pcard-main">
          <b>{form.name.trim() || 'بیمار بدون نام'}</b>
          <span>
            {[formatAge(form.age), sexLabel, form.diagnosis].filter(Boolean).join(' · ') || 'اطلاعات پایه را در مرحله اول وارد کنید'}
          </span>
        </div>
        <div className="hx-pcard-step">
          <b>{toPersianDigits(step)}</b>
          <span>از {toPersianDigits(STEPS.length)} مرحله</span>
        </div>
      </section>

      <div className="hx-sticky">
        <div className="hx-steps" ref={stepsRef}>
          {STEPS.map((s, i) => {
            const n = i + 1
            const active = n === step
            return (
              <button key={s.id} type="button" data-active={active} className={active ? 'on' : done.has(s.id) ? 'done' : ''} onClick={() => goto(n)}>
                <span className="num">{done.has(s.id) && !active ? '✓' : toPersianDigits(n)}</span>
                {s.label}
              </button>
            )
          })}
        </div>
        <div className="hx-progress">
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="hx-body" key={step}>
        {step === 1 && (
          <>
            <HxCard icon={HxIcon.child} title="مشخصات کودک" sub="سن دقیق از تاریخ تولد محاسبه می‌شود">
              <HxInput label="نام و نام خانوادگی" value={form.name} onChange={(v) => set('name', v)} />
              <HxInput label="کد / شماره پرونده" en="MRN" value={form.code} onChange={(v) => set('code', v)} dir="ltr" />
              <div className="hx-field">
                <HxLabel en="DOB">تاریخ تولد</HxLabel>
                <input
                  className="hx-input"
                  type="date"
                  value={form.dob ?? ''}
                  onChange={(e) => {
                    const dob = e.target.value
                    setForm((f) => ({ ...f, dob: dob || null, age: dob ? ageFromDob(dob) ?? f.age : f.age }))
                    setDirty(true)
                  }}
                />
                {form.dob && <span className="hx-hint">{toShamsi(form.dob, 'long')}</span>}
              </div>
              <div className="hx-field">
                <HxLabel>سن</HxLabel>
                <div className="hx-row2">
                  <input
                    className="hx-input"
                    inputMode="numeric"
                    placeholder="سال"
                    value={ym ? ym.years : ''}
                    onChange={(e) => {
                      const y = e.target.value
                      setForm((f) => ({ ...f, age: y === '' && !ym?.months ? null : yearsMonthsToAge(Number(y || 0), ym?.months ?? 0) }))
                      setDirty(true)
                    }}
                  />
                  <input
                    className="hx-input"
                    inputMode="numeric"
                    placeholder="ماه"
                    value={ym ? ym.months : ''}
                    onChange={(e) => {
                      const m = Math.min(11, Number(e.target.value || 0))
                      setForm((f) => ({ ...f, age: yearsMonthsToAge(ym?.years ?? 0, m) }))
                      setDirty(true)
                    }}
                  />
                </div>
              </div>
              <HxSegmented
                label="جنس"
                options={[
                  { id: 'Male', label: 'پسر' },
                  { id: 'Female', label: 'دختر' },
                ]}
                value={sexValue}
                onChange={(v) => {
                  setForm((f) => ({ ...f, sex: v ?? null }))
                  setDirty(true)
                }}
              />
              <HxInput label="شرح‌حال‌دهنده" value={hx.informant} onChange={(v) => setH('informant', v)} placeholder="مادر، پدر، مراقب، خود کودک…" />
            </HxCard>

            <HxCard icon={HxIcon.family} title="خانواده و ترتیب تولد" sub="چندمین فرزند، نسبت فامیلی والدین">
              <div className="hx-row2">
                <HxInput label="چندمین فرزند" numeric value={hx.birthOrder} onChange={(v) => setH('birthOrder', v)} placeholder="مثلاً ۲" />
                <HxInput label="تعداد فرزندان" numeric value={hx.siblings} onChange={(v) => setH('siblings', v)} />
              </div>
              <HxSegmented label="نسبت فامیلی والدین" options={CONSANGUINITY} value={hx.consanguinity} onChange={(v) => setH('consanguinity', v)} />
              <div className="hx-row2">
                <HxInput label="سن مادر" numeric value={hx.motherAge} onChange={(v) => setH('motherAge', v)} placeholder="سال" />
                <HxInput label="سن پدر" numeric value={hx.fatherAge} onChange={(v) => setH('fatherAge', v)} placeholder="سال" />
              </div>
            </HxCard>

            <HxCard icon={HxIcon.hospital} title="پذیرش" sub="تاریخ‌ها و محل بستری">
              <HxSegmented
                label="وضعیت"
                options={CARE}
                value={form.careStatus === 'expired' ? undefined : form.careStatus}
                onChange={(v) => {
                  if (!v) return
                  setForm((f) => ({ ...f, careStatus: v }))
                  setDirty(true)
                }}
              />
              <div className="hx-row2">
                <div className="hx-field">
                  <HxLabel en="DOH">تاریخ اخذ شرح حال</HxLabel>
                  <input className="hx-input" type="date" value={hx.historyDate ?? ''} onChange={(e) => setH('historyDate', e.target.value)} />
                  {hx.historyDate && <span className="hx-hint">{toShamsi(hx.historyDate)}</span>}
                </div>
                <div className="hx-field">
                  <HxLabel en="DOA">تاریخ بستری</HxLabel>
                  <input className="hx-input" type="date" value={form.doa ?? ''} onChange={(e) => { setForm((f) => ({ ...f, doa: e.target.value || null })); setDirty(true) }} />
                  {form.doa && <span className="hx-hint">{toShamsi(form.doa)}</span>}
                </div>
              </div>
              <div className="hx-row3">
                <HxInput label="بخش" value={hx.ward} onChange={(v) => setH('ward', v)} />
                <HxInput label="اتاق" value={hx.room} onChange={(v) => setH('room', v)} />
                <HxInput label="تخت" value={form.bed} onChange={(v) => set('bed', v)} />
              </div>
            </HxCard>
          </>
        )}

        {step === 2 && (
          <>
            <HxCard icon={HxIcon.steth} title="شکایت اصلی" sub="دلیل مراجعه از زبان والدین یا کودک">
              <HxArea value={form.chiefComplaint} onChange={(v) => set('chiefComplaint', v)} placeholder="مثال: تورم پلک‌ها و کاهش ادرار از ۳ روز قبل" rows={3} />
            </HxCard>
            <HxCard icon={HxIcon.note} title="شرح بیماری فعلی" sub="Present Illness">
              <HxArea
                value={form.hpi}
                onChange={(v) => set('hpi', v)}
                placeholder="شروع، محل، مدت، کیفیت، شدت، انتشار، عوامل تشدید و تسکین، علائم همراه…"
                rows={8}
                chips={
                  <>
                    <button type="button" className="hx-pill" onClick={() => setShowMissing((v) => !v)}>
                      ☰ چه چیزی کم است؟
                    </button>
                    {showMissing && (
                      <p className="hx-hint">{missingPrompts.length ? `هنوز ننوشته‌اید: ${missingPrompts.join('، ')}` : 'همه موارد پوشش داده شده‌اند ✓'}</p>
                    )}
                    <div className="hx-quick">
                      {HPI_PROMPTS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          className={hpiText.includes(p) ? 'used' : showMissing ? 'missing' : ''}
                          onClick={() => set('hpi', (hpiText ? hpiText.replace(/\s*$/, '\n') : '') + `${p}: `)}
                        >
                          + {p}
                        </button>
                      ))}
                    </div>
                  </>
                }
              />
            </HxCard>
          </>
        )}

        {step === 3 && (
          <>
            <HxCard icon={HxIcon.mother} title="دوران بارداری مادر" sub="Prenatal History">
              <TriLegend />
              <TriChips options={PRENATAL} value={hx.prenatal} onToggle={tri('prenatal')} />
              <HxArea label="توضیحات بارداری" value={hx.prenatalNotes} onChange={(v) => setH('prenatalNotes', v)} placeholder="مراقبت‌های بارداری، سونوگرافی‌ها، داروهای مصرفی مادر، گروه خونی مادر…" />
            </HxCard>
            <HxCard icon={HxIcon.baby} title="زایمان و تولد" sub="Birth History">
              <div className="hx-row2">
                <HxInput label="سن بارداری" numeric value={hx.gaWeeks} onChange={(v) => setH('gaWeeks', v)} placeholder="هفته" />
                <HxInput label="وزن تولد" numeric value={hx.birthWeight} onChange={(v) => setH('birthWeight', v)} placeholder="گرم" />
              </div>
              <div className="hx-row2">
                <HxInput label="قد تولد" numeric value={hx.birthLength} onChange={(v) => setH('birthLength', v)} placeholder="cm" />
                <HxInput label="دور سر تولد" numeric value={hx.birthHc} onChange={(v) => setH('birthHc', v)} placeholder="cm" />
              </div>
              {hx.gaWeeks && Number(hx.gaWeeks) < 37 && <p className="hx-flag">نارس — احتمال کاهش تعداد نفرون، در پیگیری فشارخون و پروتئینوری لحاظ شود.</p>}
              {hx.birthWeight && Number(hx.birthWeight) < 2500 && <p className="hx-flag">LBW — ریسک CKD و HTN در آینده.</p>}
              <HxSegmented label="نوع زایمان" options={DELIVERY} value={hx.delivery} onChange={(v) => setH('delivery', v)} />
              <div className="hx-row2">
                <HxInput label="آپگار دقیقه ۱" numeric value={hx.apgar1} onChange={(v) => setH('apgar1', v)} />
                <HxInput label="آپگار دقیقه ۵" numeric value={hx.apgar5} onChange={(v) => setH('apgar5', v)} />
              </div>
            </HxCard>
            <HxCard icon={HxIcon.nicu} title="دوره نوزادی" sub="Neonatal History">
              <TriLegend />
              <TriChips options={NEONATAL} value={hx.neonatal} onToggle={tri('neonatal')} />
              <HxInput label="مدت بستری NICU" numeric value={hx.nicuDays} onChange={(v) => setH('nicuDays', v)} placeholder="روز" />
              <HxArea label="توضیحات" value={hx.neonatalNotes} onChange={(v) => setH('neonatalNotes', v)} placeholder="علت بستری، اقدامات انجام‌شده، زمان ترخیص…" />
            </HxCard>
          </>
        )}

        {step === 4 && (
          <HxCard icon={HxIcon.bottle} title="تغذیه" sub="Feeding History">
            <HxSegmented label="نوع تغذیه فعلی" options={FEEDING} value={hx.feedingType} onChange={(v) => setH('feedingType', v)} />
            <HxInput label="سن شروع غذای کمکی" numeric value={hx.cfStartMonth} onChange={(v) => setH('cfStartMonth', v)} placeholder="ماهگی" />
            <HxInput label="نوع غذای کمکی" value={hx.cfType} onChange={(v) => setH('cfType', v)} placeholder="فرنی، سوپ، پوره…" />
            <div className="hx-field">
              <HxLabel>مکمل‌ها</HxLabel>
              <TriChips options={SUPPLEMENTS} value={hx.supplements} onToggle={tri('supplements')} />
            </div>
            <HxArea label="رژیم و اشتهای فعلی" value={hx.dietNotes} onChange={(v) => setH('dietNotes', v)} placeholder="وعده‌ها، اشتها، مصرف نمک و مایعات، شیر گاو، پیکا، عدم تحمل غذایی…" />
          </HxCard>
        )}

        {step === 5 && (
          <HxCard icon={HxIcon.growth} title="رشد و تکامل" sub="مایلستون‌های متناسب با سن کودک نمایش داده می‌شوند">
            <TriLegend yes="دارد / کسب کرده" />
            <div className="hx-filter">
              <div>
                <b>{ageM == null ? 'سن در مرحله ۱ وارد نشده' : `سن: ${formatAge(form.age) ?? ''}`}</b>
                <button
                  type="button"
                  className="hx-pill solid"
                  onClick={() => {
                    const m = { ...(hx.milestones ?? {}) }
                    for (const x of ALL_MILESTONES) if (!m[x.id] && (showAllAges || due(x.month))) m[x.id] = 'yes'
                    setH('milestones', m)
                  }}
                >
                  ✓ بقیه موارد: دارد
                </button>
              </div>
              <label className="hx-switch">
                <input type="checkbox" checked={showAllAges} onChange={(e) => setShowAllAges(e.target.checked)} />
                <span />
                همه سنین
              </label>
            </div>
            {MILESTONE_GROUPS.map((g) => {
              const items = g.items.filter((m) => showAllAges || due(m.month))
              if (!items.length) return null
              return (
                <div key={g.title} className="hx-field">
                  <HxLabel>{g.title}</HxLabel>
                  <div className="hx-list">
                    {items.map((m) => {
                      const st = hx.milestones?.[m.id]
                      const delayed = milestoneDelayed(m, ageM, st)
                      return (
                        <button key={m.id} type="button" className={['hx-li', st ?? '', delayed ? 'delay' : ''].join(' ')} onClick={() => tri('milestones')(m.id)}>
                          <span className="dot">{st === 'yes' ? '✓' : st === 'no' ? '✕' : ''}</span>
                          <span className="txt">{m.label}</span>
                          {delayed && <span className="hx-tag warn">تأخیر</span>}
                          <span className="hx-tag">{m.month < 24 ? `${toPersianDigits(m.month)} ماه` : `${toPersianDigits(+(m.month / 12).toFixed(1))} سال`}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            <HxSegmented label="پسرفت تکاملی (از دست دادن مهارت قبلی)" options={YES_NO} value={hx.regression} onChange={(v) => setH('regression', v)} />
            <HxInput label="عملکرد تحصیلی" value={hx.school} onChange={(v) => setH('school', v)} placeholder="پایه، معدل، مشکلات یادگیری یا تمرکز" />
            <HxArea label="توضیحات تکامل" value={hx.devNotes} onChange={(v) => setH('devNotes', v)} placeholder="نگرانی والدین، ارزیابی‌های قبلی (ASQ، گفتاردرمانی…)" />
            <p className="hx-hint">ⓘ سن کنار هر مورد، سن معمول کسب مهارت است (CDC / AAP). برچسب «تأخیر» فقط وقتی ظاهر می‌شود که «ندارد» زده شده و کودک از سن هشدار گذشته باشد.</p>
          </HxCard>
        )}

        {step === 6 && (
          <>
            <HxCard icon={HxIcon.syringe} title="واکسیناسیون" sub="طبق برنامه کشوری">
              <TriLegend yes="دریافت کرده" no="دریافت نکرده" />
              <div className="hx-filter">
                <div>
                  <b>نوبت‌های آینده کم‌رنگ نمایش داده می‌شوند</b>
                  <button
                    type="button"
                    className="hx-pill solid"
                    onClick={() => {
                      const v = { ...(hx.vaccines ?? {}) }
                      for (const x of VACCINES) if (!v[x.id] && due(x.month)) v[x.id] = 'yes'
                      setH('vaccines', v)
                    }}
                  >
                    ✓ نوبت‌های سررسیده: دریافت شده
                  </button>
                </div>
              </div>
              <TriChips options={VACCINES} value={hx.vaccines} onToggle={tri('vaccines')} faded={(o) => !due(VACCINES.find((v) => v.id === o.id)?.month ?? 0)} />
              <HxSegmented label="کارت واکسن رؤیت شد" options={YES_NO} value={hx.vaccineCardSeen} onChange={(v) => setH('vaccineCardSeen', v)} />
              <HxArea label="واکسن‌های خارج از برنامه و عوارض" value={hx.vaccineNotes} onChange={(v) => setH('vaccineNotes', v)} placeholder="آنفولانزا، روتاویروس، پنوموکوک، واکنش پس از واکسن… (در نفروتیک / پیوند: وضعیت واکسن‌های زنده)" />
            </HxCard>
            <HxCard icon={HxIcon.tube} title="غربالگری نوزادی" sub="Newborn Screening">
              <div className="hx-list">
                {SCREENING.map((s) => {
                  const v = hx.screening?.[s.id] ?? 'unknown'
                  return (
                    <label key={s.id} className={`hx-li sel ${v}`}>
                      <span className="txt">{s.label}</span>
                      <select value={v} onChange={(e) => setH('screening', { ...(hx.screening ?? {}), [s.id]: e.target.value as ScreeningResult })}>
                        {SCREENING_RESULTS.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )
                })}
              </div>
            </HxCard>
          </>
        )}

        {step === 7 && (
          <>
            <HxCard icon={HxIcon.pill} title="داروهای فعلی" sub="شامل مکمل‌ها و داروهای بدون نسخه">
              <HxArea value={form.medHx} onChange={(v) => set('medHx', v)} placeholder="نام دارو، دوز، دفعات، از چه زمانی… (مثلاً Prednisolone 2 mg/kg/day از ۴ هفته قبل)" rows={4} />
              {original && (
                <button type="button" className="hx-pill" onClick={() => navigate(`/patients/${original.id}?tab=medications`)}>
                  ＋ ثبت دارو در جدول داروهای پرونده
                </button>
              )}
            </HxCard>
            <HxCard icon={HxIcon.alert} title="آلرژی‌ها" sub="نوع حساسیت را مشخص کنید">
              <TriLegend />
              <TriChips options={ALLERGIES} value={hx.allergies} onToggle={tri('allergies')} />
              <HxArea label="جزئیات آلرژی" value={form.allergyHx} onChange={(v) => set('allergyHx', v)} placeholder="نام دارو/ماده، نوع واکنش (راش، آنافیلاکسی…)، زمان وقوع" />
            </HxCard>
          </>
        )}

        {step === 8 && (
          <>
            <HxCard icon={HxIcon.history} title="بیماری‌های قبلی" sub="Past Medical History">
              <TriLegend />
              <TriChips options={PMH} value={hx.pmhFlags} onToggle={tri('pmhFlags')} />
              <HxArea label="توضیحات" value={form.pmh} onChange={(v) => set('pmh', v)} placeholder="زمان تشخیص، وضعیت کنترل، درمان… (UTIهای قبلی و ارگانیسم، VCUG / DMSA قبلی)" />
              <HxArea label="سابقه بستری" value={hx.admissionsHx} onChange={(v) => setH('admissionsHx', v)} placeholder="تاریخ، علت و مدت بستری" />
              <HxArea label="سابقه دیالیز" value={form.dialysisHx} onChange={(v) => set('dialysisHx', v)} rows={2} />
              <HxArea label="سابقه پیوند" value={form.transplantHx} onChange={(v) => set('transplantHx', v)} rows={2} />
            </HxCard>
            <HxCard icon={HxIcon.hospital} title="سابقه جراحی" sub="اعمال جراحی قبلی">
              {(hx.surgeries ?? []).length === 0 && !hx.surgicalHx && <p className="hx-empty">عمل جراحی ثبت نشده</p>}
              {hx.surgicalHx && <HxArea label="یادداشت قبلی" value={hx.surgicalHx} onChange={(v) => setH('surgicalHx', v)} rows={2} />}
              {(hx.surgeries ?? []).map((sg, i) => {
                const upd = (patch: Partial<Surgery>) => setH('surgeries', (hx.surgeries ?? []).map((x) => (x.id === sg.id ? { ...x, ...patch } : x)))
                return (
                  <div key={sg.id} className="hx-subcard">
                    <div className="hx-subcard-head">
                      <b>جراحی {toPersianDigits(i + 1)}</b>
                      <button type="button" className="hx-x" aria-label="حذف" onClick={() => setH('surgeries', (hx.surgeries ?? []).filter((x) => x.id !== sg.id))}>
                        ✕
                      </button>
                    </div>
                    <HxInput label="نوع عمل" value={sg.name} onChange={(v) => upd({ name: v })} placeholder="مثلاً Pyeloplasty، Ureteral reimplantation، Orchiopexy" />
                    <HxInput label="تاریخ / سن" value={sg.date} onChange={(v) => upd({ date: v })} placeholder="۱۴۰۲ یا ۲ سالگی" />
                    <HxInput label="توضیحات" value={sg.notes} onChange={(v) => upd({ notes: v })} placeholder="بیمارستان، عوارض، عارضه بیهوشی" />
                  </div>
                )
              })}
              <button
                type="button"
                className="hx-add"
                onClick={() => setH('surgeries', [...(hx.surgeries ?? []), { id: `${Date.now()}`, name: '' }])}
              >
                ＋ افزودن عمل جراحی
              </button>
            </HxCard>
            <HxCard icon={HxIcon.child} title="بیماری‌های عفونی دوران کودکی">
              <TriChips options={CHILDHOOD_INFECTIONS} value={hx.infections} onToggle={tri('infections')} />
              <HxArea label="توضیحات" value={hx.infectionNotes} onChange={(v) => setH('infectionNotes', v)} placeholder="سن ابتلا، عوارض، درمان…" />
            </HxCard>
          </>
        )}

        {step === 9 && (
          <>
            <HxCard icon={HxIcon.family} title="سابقه خانوادگی" sub="Family History">
              <TriLegend />
              <TriChips options={FAMILY} value={hx.familyFlags} onToggle={tri('familyFlags')} />
              {hx.consanguinity === 'first' && <p className="hx-flag">والدین فامیل درجه یک — به بیماری‌های اتوزومال مغلوب (سیستینوز، NPHP، ARPKD…) فکر کنید.</p>}
              <HxArea
                label="وضعیت سلامت والدین و خواهر/برادرها"
                value={form.familyHx}
                onChange={(v) => set('familyHx', v)}
                placeholder="سن و سلامت والدین، خواهر و برادرها، فوت نوزاد یا کودک در خانواده، سقط‌های مکرر مادر… (رسم شجره‌نامه در صورت نیاز)"
                rows={4}
              />
            </HxCard>
            <HxCard icon={HxIcon.home} title="محیط زندگی و مراقبت" sub="Social History">
              <HxArea label="مراقب اصلی و وضعیت خانواده" value={hx.caregiver} onChange={(v) => setH('caregiver', v)} placeholder="زندگی با والدین؟ مراقب در طول روز، شغل والدین، وضعیت اقتصادی، بیمه…" />
              <HxArea label="محیط و مواجهه‌ها" value={hx.exposures} onChange={(v) => setH('exposures', v)} placeholder="دود سیگار در منزل، حیوانات، تماس با بیمار، سفر اخیر، آب آشامیدنی، سرب…" />
              <HxArea label="مهدکودک / مدرسه" value={hx.daycare} onChange={(v) => setH('daycare', v)} placeholder="نام، پایه، روابط با همسالان، غیبت به خاطر بیماری" />
              <HxArea label="خواب" value={hx.sleep} onChange={(v) => setH('sleep', v)} placeholder="ساعات خواب، خرخر، بیدار شدن شبانه برای ادرار، محل خواب شیرخوار" />
              {(ageM == null || ageM >= 120) && (
                <HxArea
                  label="نوجوان (HEADSS)"
                  value={hx.headss}
                  onChange={(v) => setH('headss', v)}
                  placeholder="Home، Education، Activities، Drugs، Sexuality، Suicide/Depression (ترجیحاً بدون حضور والدین) — در CKD / پیوند: پایبندی به دارو"
                  rows={4}
                />
              )}
            </HxCard>
          </>
        )}

        {step === 10 && (
          <HxCard icon={HxIcon.note} title="مرور سیستم‌ها" sub="Review of Systems">
            <TriLegend />
            <div className="hx-acc-list">
              {ROS_SYSTEMS.map((sys) => {
                const items = rosItems(sys, form.sex)
                const open = openRos === sys.id
                const yes = items.filter((it) => hx.ros?.[`${sys.id}-${it.id}`] === 'yes').length
                const no = items.filter((it) => hx.ros?.[`${sys.id}-${it.id}`] === 'no').length
                return (
                  <div key={sys.id} className={open ? 'hx-acc open' : 'hx-acc'}>
                    <button type="button" className="hx-acc-head" onClick={() => setOpenRos(open ? null : sys.id)} aria-expanded={open}>
                      <b>{sys.title}</b>
                      <small>{sys.en}</small>
                      {yes > 0 && <span className="hx-count y">{toPersianDigits(yes)}</span>}
                      {no > 0 && <span className="hx-count n">{toPersianDigits(no)}</span>}
                      <svg className="chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>
                    {open && (
                      <div className="hx-acc-body">
                        {sys.groups
                          .filter((g) => rosItems({ ...sys, groups: [g] }, form.sex).length > 0)
                          .map((g, gi) => (
                            <div key={gi} className="hx-field">
                              {g.title && <HxLabel>{g.title}</HxLabel>}
                              <TriChips
                                options={g.items.map((it) => ({ id: `${sys.id}-${it.id}`, label: it.label }))}
                                value={hx.ros}
                                onToggle={tri('ros')}
                              />
                            </div>
                          ))}
                        <div className="hx-acc-actions">
                          <button
                            type="button"
                            className="hx-pill solid"
                            onClick={() => {
                              const r = { ...(hx.ros ?? {}) }
                              for (const it of items) if (!r[`${sys.id}-${it.id}`]) r[`${sys.id}-${it.id}`] = 'no'
                              setH('ros', r)
                            }}
                          >
                            <i className="hx-neg" /> بقیه موارد: منفی
                          </button>
                          <button
                            type="button"
                            className="hx-pill ghost"
                            onClick={() => {
                              const r = { ...(hx.ros ?? {}) }
                              for (const it of sys.groups.flatMap((g) => g.items)) delete r[`${sys.id}-${it.id}`]
                              setH('ros', r)
                            }}
                          >
                            پاک کردن
                          </button>
                        </div>
                        <HxArea
                          label="توضیحات تکمیلی"
                          value={hx.rosSysNotes?.[sys.id]}
                          onChange={(v) => setH('rosSysNotes', { ...(hx.rosSysNotes ?? {}), [sys.id]: v })}
                          rows={2}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {(hx.rosNotes || Object.keys(hx.ros ?? {}).some((k) => !k.includes('-'))) && (
              <p className="hx-hint">موارد ثبت‌شده در نسخه قبلی این بخش در خلاصه شرح حال حفظ شده‌اند.</p>
            )}
          </HxCard>
        )}

        {step === 11 && (
          <>
            <HxCard icon={HxIcon.heart} title="علائم حیاتی" sub="Vital Signs">
              <div className="hx-row3">
                <HxInput label="دما" en="°C" numeric value={form.vsTemp} onChange={(v) => set('vsTemp', v)} dir="ltr" />
                <HxInput label="ضربان" en="HR" numeric value={form.vsHR} onChange={(v) => set('vsHR', v)} dir="ltr" />
                <HxInput label="تنفس" en="RR" numeric value={form.vsRR} onChange={(v) => set('vsRR', v)} dir="ltr" />
              </div>
              <div className="hx-row2">
                <HxInput label="فشار خون" en="BP" value={form.vsBP} onChange={(v) => set('vsBP', v)} placeholder="110/70" dir="ltr" />
                <HxInput label="اشباع اکسیژن" en="SpO2 %" numeric value={form.vsSpo2} onChange={(v) => set('vsSpo2', v)} dir="ltr" />
              </div>
            </HxCard>
            <HxCard icon={HxIcon.ruler} title="آنتروپومتری و عملکرد کلیه" sub="Anthropometry & baseline kidney function">
              <div className="hx-row3">
                <HxInput label="وزن" en="kg" numeric value={form.weight} onChange={(v) => set('weight', v)} dir="ltr" />
                <HxInput label="قد" en="cm" numeric value={form.height} onChange={(v) => set('height', v)} dir="ltr" />
                <HxInput label="دور سر" en="cm" numeric value={hx.hc} onChange={(v) => setH('hc', v)} dir="ltr" />
              </div>
              <HxInput label="کراتینین پایه" en="mg/dL" numeric value={form.baselineCr} onChange={(v) => set('baselineCr', v)} dir="ltr" />
              <div className="hx-calc" dir="ltr">
                <div>
                  <span>Schwartz eGFR</span>
                  <b>{form.height && form.baselineCr ? schwartzEGFR(form.height, form.baselineCr).toFixed(1) : '—'}</b>
                </div>
                <div>
                  <span>BSA</span>
                  <b>{form.height && form.weight ? bsaMosteller(form.height, form.weight).toFixed(2) : '—'}</b>
                </div>
                <div>
                  <span>BMI</span>
                  <b>{form.height && form.weight ? bmiCalc(form.height, form.weight).toFixed(1) : '—'}</b>
                </div>
              </div>
              <p className="hx-hint">قد و وزن جدید در نمودار رشد هم ثبت می‌شود.</p>
            </HxCard>
          </>
        )}

        {step === 12 && (
          <HxCard icon={HxIcon.steth} title="معاینه فیزیکی" sub="Physical Examination">
            <button
              type="button"
              className="hx-pill solid"
              onClick={() => {
                setForm((f) => {
                  const n = { ...f }
                  for (const x of EXAM_FIELDS) if (!String(n[x.key] ?? '').trim()) (n as unknown as Record<string, unknown>)[x.key] = x.normal
                  return n
                })
                setDirty(true)
              }}
            >
              ✓ بقیه موارد: طبیعی
            </button>
            {EXAM_FIELDS.map((x) => (
              <HxArea
                key={x.key}
                label={x.label}
                value={form[x.key] as string | null}
                onChange={(v) => set(x.key, v)}
                rows={2}
                chips={
                  <div className="hx-quick">
                    <button type="button" className={form[x.key] === x.normal ? 'used' : ''} onClick={() => set(x.key, x.normal)}>
                      + طبیعی
                    </button>
                  </div>
                }
              />
            ))}
          </HxCard>
        )}

        {step === 13 && (
          <>
            <HxCard icon={HxIcon.check} title="تشخیص و وضعیت" sub="Impression">
              <HxInput label="تشخیص" en="Diagnosis" value={form.diagnosis} onChange={(v) => set('diagnosis', v)} dir="ltr" />
              <HxInput label="بیماری زمینه‌ای" en="Underlying disease" value={form.underlyingDisease} onChange={(v) => set('underlyingDisease', v)} dir="ltr" />
              <div className="hx-row2">
                <HxInput label="وضعیت دیالیز" value={form.dialysisStatus} onChange={(v) => set('dialysisStatus', v)} dir="ltr" />
                <HxInput label="نوع دیالیز" value={form.dialysisModality} onChange={(v) => set('dialysisModality', v)} dir="ltr" />
              </div>
              <HxInput label="وضعیت پیوند" value={form.transplantStatus} onChange={(v) => set('transplantStatus', v)} dir="ltr" />
              <HxArea label="نکات کلیدی" en="Key points" value={form.keyPoints} onChange={(v) => set('keyPoints', v)} />
            </HxCard>
            <HxCard icon={HxIcon.note} title="خلاصه شرح حال" sub="برای کپی در یادداشت یا پرسیدن از دستیار">
              <pre className="hx-summary" dir="auto">
                {summary}
              </pre>
              <button
                type="button"
                className="hx-pill solid"
                onClick={() => {
                  void navigator.clipboard?.writeText(summary).then(() => {
                    setCopied(true)
                    window.setTimeout(() => setCopied(false), 1600)
                  })
                }}
              >
                {copied ? '✓ کپی شد' : 'کپی خلاصه'}
              </button>
            </HxCard>
          </>
        )}

        {status && <p className={`hx-status ${status.kind}`}>{status.text}</p>}
      </div>

      <footer className="hx-bar">
        <button type="button" className="hx-sq" disabled={step === 1} onClick={() => goto(step - 1)} aria-label="مرحله قبل">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
        <button type="button" className="hx-sq" disabled={saving} onClick={() => void persist()} aria-label="ذخیره">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm2 2v4h8V5zm5 9a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" />
          </svg>
        </button>
        <button type="button" className="hx-next" disabled={saving} onClick={() => void next()}>
          {saving ? 'در حال ذخیره…' : step === STEPS.length ? 'پایان و ذخیره' : 'مرحله بعد'}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
        </button>
      </footer>
    </div>
  )
}
