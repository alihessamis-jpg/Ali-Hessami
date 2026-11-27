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
import { EXAM_GENERAL, visibleExamSystems, vitalRanges, type ExamSystem } from '../lib/pedsExam'
import { assessBloodPressure, headCircumferenceForAgePercentile, heightForAgePercentile, normalizeSex, weightForAgePercentile } from '../lib/growth'
import { askAssistant } from '../lib/api/assistant'
import { FilesPanel, LabsPanel } from '../components/history/ParaclinicPanels'
import { HxArea, HxCard, HxIcon, HxInput, HxLabel, HxSegmented, TriChips, TriLegend } from '../components/history/HistoryFields'
import type { Patient, PatientCareStatus, PatientScalarKey } from '../types/domain'

const NUMERIC = new Set<PatientScalarKey>(['height', 'weight', 'baselineCr', 'vsTemp', 'vsHR', 'vsRR', 'vsSpo2'])

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
  const [openExam, setOpenExam] = useState<string | null>(null)
  const [aiBusy, setAiBusy] = useState<'ddx' | 'hpi' | null>(null)
  const [aiErr, setAiErr] = useState<string | null>(null)
  const [teachOpen, setTeachOpen] = useState<string | null>(null)

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

  function set<K extends PatientScalarKey>(key: K, raw: string) {
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

  async function persist(markDone?: string, extra?: Partial<PedsHistory>): Promise<string | null> {
    setSaving(true)
    setStatus(null)
    const nextHx: PedsHistory = {
      ...hx,
      ...extra,
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
    if (step === STEPS.length && (hx.status ?? 'draft') === 'draft') setHx((h) => ({ ...h, status: 'complete' }))
    const ok = await persist(STEPS[step - 1].id, step === STEPS.length && (hx.status ?? 'draft') === 'draft' ? { status: 'complete' } : undefined)
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

  const ranges = vitalRanges(ageM)
  const sexCode = normalizeSex(form.sex)
  const pct = (() => {
    const out: { w?: string; h?: string; hc?: string; hPct?: number } = {}
    if (ageM == null || !sexCode) return out
    const fmt = (v: number | null) => (v == null || Number.isNaN(v) ? undefined : `صدک ${toPersianDigits(Math.round(v))}`)
    if (form.weight) out.w = fmt(weightForAgePercentile(form.weight, ageM, sexCode))
    if (form.height) {
      const hp = heightForAgePercentile(form.height, ageM, sexCode)
      out.h = fmt(hp)
      out.hPct = hp
    }
    if (hx.hc && Number(hx.hc)) out.hc = fmt(headCircumferenceForAgePercentile(Number(hx.hc), ageM, sexCode))
    return out
  })()
  const bp = (() => {
    const m = /^\s*(\d{2,3})\s*\/\s*(\d{2,3})/.exec(form.vsBP ?? '')
    if (!m || ageM == null || !sexCode) return null
    const a = assessBloodPressure(Number(m[1]), Number(m[2]), ageM / 12, sexCode, pct.hPct ?? null)
    const tone = a.category === 'normal' ? 'ok' : a.category === 'indeterminate' ? undefined : 'bad'
    return { label: a.label, note: a.note, tone } as { label: string; note?: string; tone?: 'ok' | 'bad' }
  })()

  async function aiFill(kind: 'ddx' | 'hpi') {
    if (!original) return
    setAiBusy(kind)
    setAiErr(null)
    const prompt =
      kind === 'ddx'
        ? 'بر اساس شرح حال زیر، تشخیص‌های افتراقی را به ترتیب اولویت فهرست کن؛ برای هر مورد یک خط دلیل (یافته‌های موافق/مخالف) و در پایان مهم‌ترین workup بعدی. فقط فهرست، بدون مقدمه. اصطلاحات پزشکی انگلیسی بمانند.'
        : 'شرح بیماری فعلی (HPI) زیر را به یک متن حرفه‌ای، منظم و زمانی (کرونولوژیک) بازنویسی کن، بدون اضافه کردن هیچ اطلاعات جدید. فقط متن نهایی HPI، بدون مقدمه. اصطلاحات پزشکی انگلیسی بمانند.\n\nHPI:\n' + (form.hpi ?? '')
    let text = ''
    const key = kind === 'ddx' ? 'ddx' : 'hpiFinal'
    try {
      await askAssistant(
        { mode: 'patient', patientId: original.id, message: prompt, caseText: summary },
        {
          onDelta: (t) => {
            text += t
            setHx((h) => ({ ...h, [key]: text }))
          },
          onReset: () => {
            text = ''
          },
          onFinal: (t) => {
            text = t
            setHx((h) => ({ ...h, [key]: t }))
          },
          onError: (m) => setAiErr(m),
        }
      )
      setDirty(true)
    } catch (e) {
      setAiErr(e instanceof Error ? e.message : 'خطا')
    } finally {
      setAiBusy(null)
    }
  }

  function examText(sys: ExamSystem): string {
    return sys.col ? String(form[sys.col] ?? '') : hx.exam?.[sys.id] ?? ''
  }
  function setExamText(sys: ExamSystem, v: string) {
    if (sys.col) set(sys.col, v)
    else setH('exam', { ...(hx.exam ?? {}), [sys.id]: v })
  }
  function applyNormal(sys: ExamSystem) {
    if (sys.col) {
      const key = sys.col
      setForm((f) => ({ ...f, [key]: sys.normal }))
    } else {
      setHx((h) => ({ ...h, exam: { ...(h.exam ?? {}), [sys.id]: sys.normal } }))
    }
    if (sys.picks?.length) {
      setHx((h) => {
        const p = { ...(h.examPick ?? {}) }
        for (const pk of sys.picks ?? []) p[`${sys.id}.${pk.id}`] = pk.options[pk.normal]
        return { ...h, examPick: p }
      })
    }
    setDirty(true)
  }

  function renderExam(sys: ExamSystem, single = false) {
    const text = examText(sys)
    const isNormal = text === sys.normal
    const open = single || openExam === sys.id
    const filled = text.trim().length > 0
    const body = (
      <>
        {sys.teach && (
          <button type="button" className="hx-pill ghost" onClick={() => setTeachOpen(teachOpen === sys.id ? null : sys.id)}>
            🎓 آموزش
          </button>
        )}
        {teachOpen === sys.id && sys.teach && (
          <ul className="hx-teach">
            {sys.teach.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        )}
        {sys.picks?.map((pk) => (
          <HxSegmented
            key={pk.id}
            label={pk.label}
            options={pk.options.map((o) => ({ id: o, label: o }))}
            value={hx.examPick?.[`${sys.id}.${pk.id}`]}
            onChange={(v) => setH('examPick', { ...(hx.examPick ?? {}), [`${sys.id}.${pk.id}`]: v ?? '' })}
          />
        ))}
        <HxArea value={text} onChange={(v) => setExamText(sys, v)} placeholder={sys.placeholder} rows={3} />
      </>
    )
    if (single) {
      return (
        <HxCard icon={HxIcon.child} title={sys.title} sub={sys.en}>
          <button type="button" className={isNormal ? 'hx-pill on' : 'hx-pill solid'} onClick={() => applyNormal(sys)}>
            ✓ نرمال
          </button>
          {body}
        </HxCard>
      )
    }
    return (
      <div key={sys.id} className={open ? 'hx-acc open' : 'hx-acc'}>
        <div className="hx-acc-head">
          <button type="button" className="hx-acc-title" onClick={() => setOpenExam(open ? null : sys.id)} aria-expanded={open}>
            <b>{sys.title}</b>
            <small>{sys.en}</small>
            {filled && <span className={isNormal ? 'hx-count y' : 'hx-count n'}>{isNormal ? '✓' : '•'}</span>}
          </button>
          <button type="button" className={isNormal ? 'hx-norm on' : 'hx-norm'} onClick={() => applyNormal(sys)}>
            نرمال
          </button>
          <button type="button" className="hx-chev" onClick={() => setOpenExam(open ? null : sys.id)} aria-label="باز / بسته">
            <svg className="chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>
        {open && <div className="hx-acc-body">{body}</div>}
      </div>
    )
  }

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
            {renderExam(EXAM_GENERAL, true)}

            <HxCard icon={HxIcon.heart} title="علائم حیاتی و رشد" sub="محدوده طبیعی بر اساس سن کودک کنار هر کادر نمایش داده می‌شود">
              <div className="hx-vgrid" dir="rtl">
                <VitalBox label="نبض" unit="bpm" value={form.vsHR} onChange={(v) => set('vsHR', v)} range={ranges?.hr} needAge={!ranges} />
                <VitalBox label="فشار خون" unit="mmHg" value={form.vsBP} onChange={(v) => set('vsBP', v)} text placeholder="110/70" note={bp ? bp.label : !ranges ? 'سن را وارد کنید' : undefined} tone={bp?.tone} />
                <VitalBox label="تعداد تنفس" unit="/min" value={form.vsRR} onChange={(v) => set('vsRR', v)} range={ranges?.rr} needAge={!ranges} />
                <VitalBox label="دما" unit="°C" value={form.vsTemp} onChange={(v) => set('vsTemp', v)} note={form.vsTemp != null && form.vsTemp >= 38 ? 'تب' : undefined} tone={form.vsTemp != null && form.vsTemp >= 38 ? 'bad' : undefined} />
                <VitalBox label="اشباع اکسیژن" unit="%" value={form.vsSpo2} onChange={(v) => set('vsSpo2', v)} note={form.vsSpo2 != null && form.vsSpo2 < 92 ? 'پایین' : undefined} tone={form.vsSpo2 != null && form.vsSpo2 < 92 ? 'bad' : undefined} />
                <VitalBox label="وزن" unit="kg" value={form.weight} onChange={(v) => set('weight', v)} note={pct.w} />
                <VitalBox label="قد / طول" unit="cm" value={form.height} onChange={(v) => set('height', v)} note={pct.h} />
                <VitalBox label="دور سر" unit="cm" value={hx.hc} onChange={(v) => setH('hc', v)} note={pct.hc} />
                <div className="hx-vbox calc">
                  <span>BMI</span>
                  <b dir="ltr">{form.height && form.weight ? bmiCalc(form.height, form.weight).toFixed(1) : '—'} <small>kg/m²</small></b>
                </div>
                <div className="hx-vbox calc">
                  <span>BSA</span>
                  <b dir="ltr">{form.height && form.weight ? bsaMosteller(form.height, form.weight).toFixed(2) : '—'} <small>m²</small></b>
                </div>
              </div>
              {bp?.note && <p className={`hx-flag ${bp.tone === 'ok' ? 'ok' : ''}`} dir="ltr">{bp.label} — {bp.note}</p>}
              <HxInput label="کراتینین پایه" en="mg/dL" numeric value={form.baselineCr} onChange={(v) => set('baselineCr', v)} dir="ltr" />
              {form.height && form.baselineCr ? <p className="hx-hint">Schwartz eGFR: <b dir="ltr">{schwartzEGFR(form.height, form.baselineCr).toFixed(1)}</b> mL/min/1.73m²</p> : null}
              <p className="hx-hint">ⓘ محدوده نبض و تنفس از PALS (کودک بیدار)، فشار خون بر اساس AAP 2017 و صدک قد؛ صدک‌ها خودکار از منحنی WHO (زیر ۲ سال) و CDC محاسبه می‌شوند. قد و وزن جدید در نمودار رشد هم ثبت می‌شود.</p>
            </HxCard>

            <HxCard icon={HxIcon.steth} title="معاینه سیستم‌ها" sub="روی هر عنوان بزنید؛ دکمه «نرمال» متن استاندارد را درج می‌کند">
              <button
                type="button"
                className="hx-pill solid"
                onClick={() => {
                  for (const sys of visibleExamSystems(ageM)) if (!examText(sys).trim()) applyNormal(sys)
                }}
              >
                ✓ بقیه سیستم‌ها: نرمال
              </button>
              <div className="hx-acc-list">
                {visibleExamSystems(ageM).map((sys) => renderExam(sys))}
              </div>
              {form.exHeent && <HxArea label="HEENT (یادداشت قبلی)" value={form.exHeent} onChange={(v) => set('exHeent', v)} rows={2} />}
            </HxCard>
          </>
        )}

        {step === 12 && (
          <>
            <HxCard icon={HxIcon.note} title="فهرست مشکلات" sub="Problem List">
              <HxArea value={hx.problemList} onChange={(v) => setH('problemList', v)} placeholder={'۱. …\n۲. …'} rows={4} />
            </HxCard>
            <LabsPanel patientId={original?.id ?? null} onOpenLabs={() => original && navigate(`/patients/${original.id}?tab=labs`)} />
            <HxCard icon={HxIcon.note} title="یادداشت آزمایش‌ها" sub="تفسیر یا مواردی که در Labs ثبت نمی‌شوند">
              <HxArea value={hx.labNotes} onChange={(v) => setH('labNotes', v)} placeholder="U/A، کشت ادرار، VBG، تفسیر کلی…" rows={3} />
            </HxCard>
            <HxCard icon={HxIcon.kidney} title="تصویربرداری" sub="Imaging">
              <HxArea value={hx.imagingNotes} onChange={(v) => setH('imagingNotes', v)} placeholder="سونوگرافی کلیه و مجاری (اندازه، اکوژنیسیته، هیدرونفروز SFU/APD)، VCUG، DMSA، MAG3…" rows={3} />
            </HxCard>
            <HxCard icon={HxIcon.check} title="سایر بررسی‌ها" sub="Other">
              <HxArea value={hx.otherTests} onChange={(v) => setH('otherTests', v)} placeholder="بیوپسی کلیه، ژنتیک، اکو، فوندوسکوپی، شنوایی‌سنجی…" rows={3} />
            </HxCard>
            <FilesPanel patientId={original?.id ?? null} />
          </>
        )}

        {step === 13 && (
          <>
            <HxCard icon={HxIcon.kidney} title="تشخیص‌های افتراقی" sub="Differential Diagnosis">
              <button type="button" className="hx-pill" disabled={!!aiBusy || !original} onClick={() => void aiFill('ddx')}>
                ✎ {aiBusy === 'ddx' ? 'در حال تولید…' : 'تولید هوشمند'}
              </button>
              <HxArea value={hx.ddx} onChange={(v) => setH('ddx', v)} placeholder="تشخیص‌های احتمالی به ترتیب اولویت…" rows={6} />
            </HxCard>

            <HxCard icon={HxIcon.note} title="بازنگری شرح بیماری فعلی" sub="نسخه نهایی و حرفه‌ای HPI">
              <button type="button" className="hx-pill" disabled={!!aiBusy || !original || !form.hpi?.trim()} onClick={() => void aiFill('hpi')}>
                ✎ {aiBusy === 'hpi' ? 'در حال بازنویسی…' : 'بازنویسی هوشمند'}
              </button>
              <div className="hx-quote">
                <small>متن فعلی شرح بیماری</small>
                <p dir="auto">{form.hpi?.trim() || 'هنوز وارد نشده است'}</p>
              </div>
              <HxArea label="نسخه نهایی" value={hx.hpiFinal} onChange={(v) => setH('hpiFinal', v)} placeholder="نسخه بازنویسی‌شده شرح بیماری فعلی…" rows={6} />
              {hx.hpiFinal?.trim() && hx.hpiFinal !== form.hpi && (
                <button type="button" className="hx-pill solid" onClick={() => set('hpi', hx.hpiFinal ?? '')}>
                  جایگزین کردن شرح بیماری با نسخه نهایی
                </button>
              )}
              {!original && <p className="hx-hint">ابزارهای هوشمند بعد از اولین ذخیره فعال می‌شوند.</p>}
              {aiErr && <p className="hx-hint err">{aiErr}</p>}
            </HxCard>

            <HxCard icon={HxIcon.check} title="جمع‌بندی و طرح درمان" sub="Assessment & Plan">
              <HxArea label="خلاصه" value={hx.assessment} onChange={(v) => setH('assessment', v)} placeholder="خلاصه وضعیت بیمار…" rows={4} />
              <HxInput label="تشخیص" en="Diagnosis" value={form.diagnosis} onChange={(v) => set('diagnosis', v)} dir="ltr" />
              <HxInput label="بیماری زمینه‌ای" en="Underlying disease" value={form.underlyingDisease} onChange={(v) => set('underlyingDisease', v)} dir="ltr" />
              <HxArea label="نکات کلیدی" value={form.keyPoints} onChange={(v) => set('keyPoints', v)} placeholder="نکات مهم این بیمار…" />
              <HxArea label="طرح درمان" value={hx.plan} onChange={(v) => setH('plan', v)} placeholder="اقدامات تشخیصی و درمانی پیشنهادی…" rows={6} />
              <details className="hx-more">
                <summary>دیالیز و پیوند</summary>
                <div className="hx-row2">
                  <HxInput label="وضعیت دیالیز" value={form.dialysisStatus} onChange={(v) => set('dialysisStatus', v)} dir="ltr" />
                  <HxInput label="نوع دیالیز" value={form.dialysisModality} onChange={(v) => set('dialysisModality', v)} dir="ltr" />
                </div>
                <HxInput label="وضعیت پیوند" value={form.transplantStatus} onChange={(v) => set('transplantStatus', v)} dir="ltr" />
              </details>
            </HxCard>

            <HxCard icon={HxIcon.check} title="وضعیت شرح حال">
              <HxSegmented
                options={[
                  { id: 'draft', label: 'ناتمام' },
                  { id: 'complete', label: 'تکمیل شده' },
                  { id: 'reviewed', label: 'بررسی شده' },
                ]}
                value={hx.status ?? 'draft'}
                onChange={(v) => setH('status', v ?? 'draft')}
              />
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
          {saving ? 'در حال ذخیره…' : step === STEPS.length ? '✓ تکمیل شرح حال' : 'مرحله بعد'}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
        </button>
      </footer>
    </div>
  )
}

function VitalBox({
  label,
  unit,
  value,
  onChange,
  range,
  needAge,
  note,
  tone,
  text,
  placeholder,
}: {
  label: string
  unit: string
  value: string | number | null | undefined
  onChange: (v: string) => void
  range?: [number, number]
  needAge?: boolean
  note?: string
  tone?: 'ok' | 'bad'
  text?: boolean
  placeholder?: string
}) {
  const n = value === '' || value == null ? null : Number(value)
  const out = range && n != null && !Number.isNaN(n) ? (n < range[0] || n > range[1] ? 'bad' : 'ok') : undefined
  const t = tone ?? out
  return (
    <label className={`hx-vbox ${t ?? ''}`}>
      <span>{label}</span>
      <span className="row" dir="ltr">
        <input value={value ?? ''} onChange={(e) => onChange(e.target.value)} inputMode={text ? 'text' : 'decimal'} placeholder={placeholder ?? '—'} />
        <small>{unit}</small>
      </span>
      {range ? (
        <em>
          طبیعی: <span dir="ltr">{range[0]}–{range[1]}</span>
        </em>
      ) : needAge ? (
        <em>سن را وارد کنید</em>
      ) : note ? (
        <em>{note}</em>
      ) : null}
    </label>
  )
}
