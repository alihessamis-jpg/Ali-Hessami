// Step 12 of the history wizard: lab results (read from / added to the
// patient's Labs) and files (patient documents in Storage).
import { useEffect, useRef, useState } from 'react'
import { addLabEntry, listLabEntries } from '../../lib/api/labs'
import { addPatientDocument, listPatientDocuments } from '../../lib/api/patientDocuments'
import { uploadPatientDocumentFile } from '../../lib/storage'
import { supabase } from '../../lib/supabaseClient'
import { toShamsi } from '../../lib/shamsi'
import type { LabEntry, PatientDocument } from '../../types/domain'
import { HxCard, HxIcon } from './HistoryFields'

const QUICK_TESTS: Array<{ test: string; unit: string }> = [
  { test: 'Creatinine', unit: 'mg/dL' },
  { test: 'BUN', unit: 'mg/dL' },
  { test: 'Sodium', unit: 'mEq/L' },
  { test: 'Potassium', unit: 'mEq/L' },
  { test: 'Bicarbonate', unit: 'mEq/L' },
  { test: 'Hemoglobin', unit: 'g/dL' },
  { test: 'Albumin', unit: 'g/dL' },
  { test: 'UPCR', unit: 'mg/mg' },
  { test: 'C3', unit: 'mg/dL' },
]

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function LabsPanel({ patientId, onOpenLabs }: { patientId: string | null; onOpenLabs: () => void }) {
  const [labs, setLabs] = useState<LabEntry[]>([])
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ date: today(), test: '', value: '', unit: '' })
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!patientId) return
    listLabEntries(patientId)
      .then(setLabs)
      .catch(() => undefined)
  }, [patientId])

  async function save() {
    if (!patientId || !draft.test.trim()) return
    setBusy(true)
    setErr(null)
    try {
      const num = Number(draft.value)
      const e = await addLabEntry({
        patientId,
        date: draft.date,
        test: draft.test.trim(),
        value: draft.value !== '' && !Number.isNaN(num) ? num : null,
        valueText: draft.value !== '' && Number.isNaN(num) ? draft.value : null,
        unit: draft.unit || null,
      })
      setLabs((l) => [...l, e])
      setDraft({ date: draft.date, test: '', value: '', unit: '' })
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'ثبت نشد')
    } finally {
      setBusy(false)
    }
  }

  const recent = [...labs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12)

  return (
    <HxCard icon={HxIcon.tube} title="نتایج آزمایش" sub="Laboratory Results">
      <button type="button" className="hx-banner" onClick={onOpenLabs} disabled={!patientId}>
        <span className="hx-tile">{HxIcon.tube}</span>
        <span>
          <b>همه آزمایش‌ها در تب Labs</b>
          <small>روند Cr/eGFR، هشدارها و نمودارها از همین ثبت‌ها ساخته می‌شوند</small>
        </span>
        <span className="chev">‹</span>
      </button>
      {!patientId ? (
        <p className="hx-empty">برای ثبت آزمایش، ابتدا یک بار ذخیره کنید</p>
      ) : recent.length === 0 ? (
        <p className="hx-empty">آزمایشی ثبت نشده</p>
      ) : (
        <div className="hx-labs" dir="ltr">
          {recent.map((l) => (
            <div key={l.id} className="hx-lab">
              <b>{l.test}</b>
              <span>
                {l.value ?? l.valueText ?? '—'} <small>{l.unit}</small>
              </span>
              <em className="fa">{toShamsi(l.date)}</em>
            </div>
          ))}
        </div>
      )}
      {patientId &&
        (adding ? (
          <div className="hx-subcard">
            <div className="hx-quick">
              {QUICK_TESTS.map((q) => (
                <button key={q.test} type="button" className={draft.test === q.test ? 'used' : ''} onClick={() => setDraft((d) => ({ ...d, test: q.test, unit: q.unit }))}>
                  {q.test}
                </button>
              ))}
            </div>
            <div className="hx-row2" dir="ltr">
              <input className="hx-input" placeholder="Test" value={draft.test} onChange={(e) => setDraft((d) => ({ ...d, test: e.target.value }))} />
              <input className="hx-input" type="date" value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} />
            </div>
            <div className="hx-row2" dir="ltr">
              <input className="hx-input" placeholder="Value" inputMode="decimal" value={draft.value} onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))} />
              <input className="hx-input" placeholder="Unit" value={draft.unit} onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))} />
            </div>
            {err && <p className="hx-hint err">{err}</p>}
            <div className="hx-acc-actions">
              <button type="button" className="hx-pill" disabled={busy || !draft.test.trim()} onClick={() => void save()}>
                {busy ? '…' : 'ثبت'}
              </button>
              <button type="button" className="hx-pill ghost" onClick={() => setAdding(false)}>
                بستن
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="hx-add" onClick={() => setAdding(true)}>
            ＋ افزودن دستی آزمایش
          </button>
        ))}
    </HxCard>
  )
}

export function FilesPanel({ patientId }: { patientId: string | null }) {
  const [docs, setDocs] = useState<PatientDocument[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!patientId) return
    listPatientDocuments(patientId)
      .then(setDocs)
      .catch(() => undefined)
  }, [patientId])

  async function upload(files: FileList | null) {
    if (!patientId || !files?.length) return
    setBusy(true)
    setErr(null)
    try {
      const { data } = await supabase.auth.getSession()
      const uid = data.session?.user.id
      if (!uid) throw new Error('وارد حساب نشده‌اید')
      for (const f of Array.from(files)) {
        if (f.size > 10 * 1024 * 1024) throw new Error(`${f.name}: بیشتر از ۱۰ مگابایت`)
        const path = await uploadPatientDocumentFile(uid, patientId, f)
        const d = await addPatientDocument(patientId, path, f.name)
        setDocs((x) => [d, ...x])
      }
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'آپلود نشد')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <HxCard icon={HxIcon.note} title="تصاویر و فایل‌ها" sub="برگه آزمایش، گزارش تصویربرداری و…">
      {!patientId ? (
        <p className="hx-empty">برای آپلود فایل، ابتدا یک بار ذخیره کنید</p>
      ) : (
        <>
          <label
            className="hx-drop"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              void upload(e.dataTransfer.files)
            }}
          >
            <input ref={inputRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => void upload(e.target.files)} />
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8M12 12v8M9 15l3-3 3 3" />
            </svg>
            <b>{busy ? 'در حال آپلود…' : 'برای آپلود بزنید یا فایل را اینجا رها کنید'}</b>
            <small>JPG، PNG، WEBP، PDF · حداکثر ۱۰ مگابایت</small>
          </label>
          {err && <p className="hx-hint err">{err}</p>}
          {docs.length > 0 && (
            <ul className="hx-files">
              {docs.map((d) => (
                <li key={d.id} dir="auto">
                  📎 {d.filename ?? d.storagePath.split('/').pop()} <span className="fa">{toShamsi(d.createdAt.slice(0, 10))}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </HxCard>
  )
}
