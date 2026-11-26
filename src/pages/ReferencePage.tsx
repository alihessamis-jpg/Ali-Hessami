import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  addDialysisReference,
  deleteDialysisReference,
  listDialysisReference,
} from '../lib/api/dialysisReference'
import {
  addDrugReference,
  deleteDrugReference,
  listDrugReference,
  searchFormulary,
  type FormularyHit,
} from '../lib/api/drugReference'
import { listPatients } from '../lib/api/patients'
import { importReferenceFile } from '../lib/api/referenceImport'
import { schwartzBedside, round, type Dialysis } from '../lib/doseCalc'
import { DrugMonograph, type PatientDoseContext } from '../components/reference/DrugMonograph'
import {
  addReferenceAttachment,
  deleteReferenceAttachment,
  listReferenceAttachments,
  setReferenceAttachmentEntry,
} from '../lib/api/referenceAttachments'
import {
  deleteReferenceAttachmentFile,
  getReferenceAttachmentSignedUrl,
  uploadReferenceAttachmentFile,
} from '../lib/storage'
import { useAuth } from '../context/AuthContext'
import type { DialysisRefEntry, DrugRefEntry, Patient, ReferenceAttachment } from '../types/domain'
import { HeroScene } from '../components/hero/HeroScene'

function isImagePath(path: string): boolean {
  return /\.(png|jpe?g|gif|webp|heic|heif)$/i.test(path)
}

type Tab = 'drug' | 'dialysis'
type DrugFilter = 'all' | 'book' | 'mine' | 'renal' | 'neonate' | 'meningitis'

function numOrNull(v: string): number | null {
  const n = Number(v.replace(',', '.'))
  return v.trim() && Number.isFinite(n) && n > 0 ? n : null
}

const emptyDrugDraft = {
  medication: '',
  indication: '',
  normalDose: '',
  pediatricDose: '',
  maxDose: '',
  egfrRange: '',
  adjustedDose: '',
  frequency: '',
  notes: '',
}

const emptyDialysisDraft = {
  medication: '',
  indication: '',
  pediatricDose: '',
  route: '',
  frequency: '',
  maxDose: '',
  notes: '',
}

export function ReferencePage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const [tab, setTab] = useState<Tab>('drug')
  const [search, setSearch] = useState('')

  const [drugs, setDrugs] = useState<DrugRefEntry[]>([])
  const [dialysis, setDialysis] = useState<DialysisRefEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drugDraft, setDrugDraft] = useState(emptyDrugDraft)
  const [dialysisDraft, setDialysisDraft] = useState(emptyDialysisDraft)
  const [showForm, setShowForm] = useState(false)

  const [expandedId, setExpandedId] = useState<string | null>(null)

  // --- patient context for dose calculation / renal row highlighting
  const [patients, setPatients] = useState<Patient[]>([])
  const [patientId, setPatientId] = useState('')
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [egfr, setEgfr] = useState('')
  const [scr, setScr] = useState('')
  const [dialysisMode, setDialysisMode] = useState<Dialysis>('none')
  const [drugFilter, setDrugFilter] = useState<DrugFilter>('all')
  const [fullText, setFullText] = useState(false)
  const [hits, setHits] = useState<FormularyHit[]>([])
  const [searching, setSearching] = useState(false)
  const [importing, setImporting] = useState<string | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  async function handleImportFile(fileList: FileList | null) {
    const file = fileList?.[0]
    if (!file) return
    setError(null)
    setImporting('Reading file…')
    try {
      const res = await importReferenceFile(file, (done, total) => setImporting(`Importing drugs… ${done} / ${total}`))
      setImporting(`Done: ${res.drugs} drugs${res.chapters ? ` and ${res.chapters} library chapters` : ''} imported. Reloading…`)
      setDrugs(await listDrugReference())
      setImporting(null)
    } catch (err) {
      setImporting(null)
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  const ctx: PatientDoseContext = {
    weightKg: numOrNull(weight),
    heightCm: numOrNull(height),
    egfr: numOrNull(egfr),
    dialysis: dialysisMode,
  }

  useEffect(() => {
    listPatients()
      .then(setPatients)
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!fullText || search.trim().length < 3) {
      setHits([])
      return
    }
    setSearching(true)
    const t = window.setTimeout(() => {
      searchFormulary(search.trim(), 20)
        .then(setHits)
        .catch((err) => setError(err instanceof Error ? err.message : 'Search failed'))
        .finally(() => setSearching(false))
    }, 350)
    return () => window.clearTimeout(t)
  }, [fullText, search])

  function pickPatient(id: string) {
    setPatientId(id)
    const p = patients.find((x) => x.id === id)
    if (!p) return
    setWeight(p.weight != null ? String(p.weight) : '')
    setHeight(p.height != null ? String(p.height) : '')
    if (p.baselineEGFR != null) setEgfr(String(p.baselineEGFR))
    else if (p.height && p.baselineCr) setEgfr(round(schwartzBedside(p.height, p.baselineCr)))
    setDialysisMode(p.dialysisModality && /pd|peritoneal/i.test(p.dialysisModality) ? 'pd' : p.dialysisModality && /hd|hemo/i.test(p.dialysisModality) ? 'ihd' : 'none')
  }

  function applyScr(v: string) {
    setScr(v)
    const h = numOrNull(height)
    const c = numOrNull(v)
    if (h && c) setEgfr(round(schwartzBedside(h, c)))
  }

  const [attachments, setAttachments] = useState<Record<Tab, ReferenceAttachment[]>>({ drug: [], dialysis: [] })
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({})
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([listDrugReference(), listDialysisReference()])
      .then(([d, dial]) => {
        setDrugs(d)
        setDialysis(dial)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load reference data'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    listReferenceAttachments(tab)
      .then((rows) => {
        setAttachments((prev) => ({ ...prev, [tab]: rows }))
        rows.forEach((a) => {
          getReferenceAttachmentSignedUrl(a.storagePath)
            .then((url) => setAttachmentUrls((prev) => ({ ...prev, [a.id]: url })))
            .catch(() => undefined)
        })
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load attachments'))
  }, [tab])

  async function handleAttachmentFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !session) return
    setUploadingAttachment(true)
    setError(null)
    try {
      for (const file of Array.from(fileList)) {
        const path = await uploadReferenceAttachmentFile(session.user.id, file)
        const attachment = await addReferenceAttachment(tab, path, file.name)
        setAttachments((prev) => ({ ...prev, [tab]: [attachment, ...prev[tab]] }))
        getReferenceAttachmentSignedUrl(path)
          .then((url) => setAttachmentUrls((prev) => ({ ...prev, [attachment.id]: url })))
          .catch(() => undefined)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload attachment')
    } finally {
      setUploadingAttachment(false)
    }
  }

  function handleAttachmentDrop(e: DragEvent<HTMLButtonElement>) {
    e.preventDefault()
    setDragOver(false)
    void handleAttachmentFiles(e.dataTransfer.files)
  }

  async function handleDeleteAttachment(a: ReferenceAttachment) {
    try {
      await deleteReferenceAttachment(a.id)
      await deleteReferenceAttachmentFile(a.storagePath).catch(() => undefined)
      setAttachments((prev) => ({ ...prev, [tab]: prev[tab].filter((x) => x.id !== a.id) }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete attachment')
    }
  }

  async function handleLinkAttachment(attachmentId: string, entryId: string) {
    try {
      const updated = await setReferenceAttachmentEntry(attachmentId, entryId || null)
      setAttachments((prev) => ({ ...prev, [tab]: prev[tab].map((x) => (x.id === updated.id ? updated : x)) }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link attachment')
    }
  }

  async function handleAddDrug(e: FormEvent) {
    e.preventDefault()
    if (!drugDraft.medication.trim()) return
    try {
      const entry = await addDrugReference({
        medication: drugDraft.medication.trim(),
        indication: drugDraft.indication || null,
        normalDose: drugDraft.normalDose || null,
        pediatricDose: drugDraft.pediatricDose || null,
        doseKg: null,
        maxDose: drugDraft.maxDose || null,
        egfrRange: drugDraft.egfrRange || null,
        adjustedDose: drugDraft.adjustedDose || null,
        frequency: drugDraft.frequency || null,
        notes: drugDraft.notes || null,
      })
      setDrugs((prev) => [...prev, entry].sort((a, b) => a.medication.localeCompare(b.medication)))
      setDrugDraft(emptyDrugDraft)
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add entry')
    }
  }

  async function handleAddDialysis(e: FormEvent) {
    e.preventDefault()
    if (!dialysisDraft.medication.trim()) return
    try {
      const entry = await addDialysisReference({
        medication: dialysisDraft.medication.trim(),
        indication: dialysisDraft.indication || null,
        pediatricDose: dialysisDraft.pediatricDose || null,
        route: dialysisDraft.route || null,
        frequency: dialysisDraft.frequency || null,
        maxDose: dialysisDraft.maxDose || null,
        notes: dialysisDraft.notes || null,
      })
      setDialysis((prev) => [...prev, entry].sort((a, b) => a.medication.localeCompare(b.medication)))
      setDialysisDraft(emptyDialysisDraft)
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add entry')
    }
  }

  const q = search.toLowerCase()
  const filteredDrugs = drugs.filter((d) => {
    const hay = [d.medication, d.tradeNames, d.drugClass, d.seeAlso, d.indication].filter(Boolean).join(' ').toLowerCase()
    if (q && !hay.includes(q)) return false
    switch (drugFilter) {
      case 'book':
        return !!d.sourceKey
      case 'mine':
        return !d.sourceKey
      case 'renal':
        return !!d.renalAdjustment?.length
      case 'neonate':
        return !!d.neonatalDose
      case 'meningitis':
        return !!d.meningitisDose
      default:
        return true
    }
  })
  const bookCount = drugs.filter((d) => d.sourceKey).length
  const filteredDialysis = dialysis.filter((d) => d.medication.toLowerCase().includes(search.toLowerCase()))
  const unlinkedTabAttachments = attachments[tab].filter((a) => !a.entryId)

  const activeList = tab === 'drug' ? filteredDrugs : filteredDialysis
  const activeAttachments = attachments[tab]

  function renderMed(d: DrugRefEntry | DialysisRefEntry) {
    const linkedAttachments = activeAttachments.filter((a) => a.entryId === d.id)
    const unlinkedAttachments = activeAttachments.filter((a) => !a.entryId)
    const isOpen = expandedId === d.id
    const fields: Array<[string, string | null | undefined]> =
      tab === 'drug'
        ? (() => {
            const drug = d as DrugRefEntry
            return [
              ['Indication', drug.indication],
              ['Normal dose', drug.normalDose],
              ['Pediatric dose', drug.pediatricDose],
              ['eGFR range', drug.egfrRange],
              ['Adjusted dose', drug.adjustedDose],
              ['Max dose', drug.maxDose],
              ['Frequency', drug.frequency],
            ]
          })()
        : (() => {
            const dial = d as DialysisRefEntry
            return [
              ['Indication', dial.indication],
              ['Pediatric dose', dial.pediatricDose],
              ['Route', dial.route],
              ['Frequency', dial.frequency],
              ['Max dose', dial.maxDose],
            ]
          })()
    return (
      <div key={d.id} className={isOpen ? 'ref-med open' : 'ref-med'}>
        <button type="button" className="ref-medb" onClick={() => setExpandedId(isOpen ? null : d.id)}>
          <span className="np-ic" style={{ width: 34, height: 34, borderRadius: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-45 12 12)" />
              <path d="m9 9 6 6" />
            </svg>
          </span>
          <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'start' }}>
            <b style={{ fontSize: 14 }}>{d.medication}</b>
            {fields[0][1] && <span className="np-small">{fields[0][1]}</span>}
            {tab === 'drug' && (d as DrugRefEntry).sourceKey && (
              <span className="ref-badges">
                <span className="ref-badge">Harriet Lane 23e · {(d as DrugRefEntry).sourcePages}</span>
                {(d as DrugRefEntry).renalAdjustment?.length ? <span className="ref-badge renal">Ch.31 renal</span> : null}
                {(d as DrugRefEntry).neonatalDose ? <span className="ref-badge neo">Neonate</span> : null}
              </span>
            )}
          </span>
          <svg className="ref-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </button>
        {isOpen && tab === 'drug' && (d as DrugRefEntry).sourceKey && (
          <div className="ref-medbody">
            <DrugMonograph entry={d as DrugRefEntry} ctx={ctx} />
          </div>
        )}
        {isOpen && !(tab === 'drug' && (d as DrugRefEntry).sourceKey) && (
          <div className="ref-medbody">
            {fields
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <span key={label} style={{ fontSize: 13, color: '#3B4A60' }}>
                  <strong>{label}:</strong> {value}
                </span>
              ))}
            {d.notes && <span style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: '#3B4A60' }}>{d.notes}</span>}
            {linkedAttachments.length > 0 && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {linkedAttachments.map((a) =>
                  attachmentUrls[a.id] ? (
                    isImagePath(a.storagePath) ? (
                      <a key={a.id} href={attachmentUrls[a.id]} target="_blank" rel="noreferrer">
                        <img src={attachmentUrls[a.id]} alt={a.filename ?? 'Attachment'} style={{ maxWidth: 120, borderRadius: 10 }} />
                      </a>
                    ) : (
                      <a key={a.id} href={attachmentUrls[a.id]} target="_blank" rel="noreferrer">
                        Open PDF — {a.filename}
                      </a>
                    )
                  ) : (
                    <span key={a.id} className="np-small">Loading…</span>
                  )
                )}
              </div>
            )}
            <span className="np-small">Attachments: [{linkedAttachments.length}]</span>
            {unlinkedAttachments.length > 0 && (
              <label className="np-small" style={{ display: 'block' }}>
                Link an uploaded photo/PDF
                <select value="" onChange={(e) => e.target.value && void handleLinkAttachment(e.target.value, d.id)} style={{ marginTop: 4 }}>
                  <option value="">Choose a file…</option>
                  {unlinkedAttachments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.filename ?? 'Attachment'}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              type="button"
              className="np-btn ghost sm"
              style={{ alignSelf: 'flex-start', color: '#B42318' }}
              onClick={() =>
                tab === 'drug'
                  ? void deleteDrugReference(d.id).then(() => setDrugs((prev) => prev.filter((x) => x.id !== d.id)))
                  : void deleteDialysisReference(d.id).then(() => setDialysis((prev) => prev.filter((x) => x.id !== d.id)))
              }
            >
              Delete
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="np-page">
      <button type="button" className="np-backlink" onClick={() => navigate(-1)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
          <path d="m15 6-6 6 6 6" />
        </svg>
        Back
      </button>

      <section className="np-hero np-fade">
        <HeroScene scene="pyramids" page="reference" className="hero-scene" />
        <div className="hero-scrim" />
        <div className="np-hrow">
          <div className="np-txt">
            <h1>Reference</h1>
            <p className="np-sub">
              {bookCount > 0
                ? `Harriet Lane Handbook 23rd ed. formulary (${bookCount} drugs, cited by page) plus your own verified entries.`
                : 'Your own verified dosing list — private to you.'}
            </p>
          </div>
        </div>
      </section>

      <div className="np-toolbar np-fade" style={{ animationDelay: '.08s' }}>
        <div className="np-seg">
          <button type="button" className={tab === 'drug' ? 'on' : ''} onClick={() => setTab('drug')}>
            Drug dosing
          </button>
          <button type="button" className={tab === 'dialysis' ? 'on' : ''} onClick={() => setTab('dialysis')}>
            Dialysis medications
          </button>
        </div>
        <div className="np-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <label className="np-sr" htmlFor="ref-search">
            Search medication
          </label>
          <input id="ref-search" placeholder="Search medication" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button type="button" className="np-btn" onClick={() => setShowForm((v) => !v)}>
          {showForm ? (
            'Cancel'
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add entry
            </>
          )}
        </button>
      </div>

      {tab === 'drug' && !loading && bookCount === 0 && (
        <section className="np-card np-fade">
          <h2>Import the Harriet Lane formulary</h2>
          <span className="np-small">
            Choose the file <b>harriet_lane_23e_nephron_import.json</b> on this device. It loads 502 drugs (Chapters 30–31) into your
            private reference and adds Chapters 30–31 to the Library for the assistant. Safe to repeat.
          </span>
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => void handleImportFile(e.target.files)}
          />
          <button type="button" className="np-btn" disabled={!!importing} onClick={() => importInputRef.current?.click()} style={{ alignSelf: 'flex-start' }}>
            {importing ? 'Importing…' : 'Choose file and import'}
          </button>
          {importing && <span className="np-small">{importing}</span>}
        </section>
      )}

      {tab === 'drug' && (
        <section className="np-card np-fade ref-ctx" style={{ animationDelay: '.1s' }}>
          <div className="ref-ctx-row">
            {patients.length > 0 && (
              <div className="np-field">
                <label htmlFor="ref-pt">Patient</label>
                <select id="ref-pt" value={patientId} onChange={(e) => pickPatient(e.target.value)}>
                  <option value="">— manual —</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.weight ? ` · ${p.weight} kg` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="np-field">
              <label htmlFor="ref-wt">Weight (kg)</label>
              <input id="ref-wt" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </div>
            <div className="np-field">
              <label htmlFor="ref-ht">Height (cm)</label>
              <input id="ref-ht" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} />
            </div>
            <div className="np-field">
              <label htmlFor="ref-scr">SCr (mg/dL)</label>
              <input id="ref-scr" inputMode="decimal" value={scr} onChange={(e) => applyScr(e.target.value)} />
            </div>
            <div className="np-field">
              <label htmlFor="ref-egfr">eGFR (mL/min/1.73 m²)</label>
              <input id="ref-egfr" inputMode="decimal" value={egfr} onChange={(e) => setEgfr(e.target.value)} />
            </div>
            <div className="np-field">
              <label htmlFor="ref-dial">Dialysis</label>
              <select id="ref-dial" value={dialysisMode} onChange={(e) => setDialysisMode(e.target.value as Dialysis)}>
                <option value="none">None</option>
                <option value="ihd">Intermittent HD</option>
                <option value="pd">Peritoneal dialysis</option>
              </select>
            </div>
          </div>
          <span className="np-small">
            {ctx.weightKg && ctx.heightCm ? `BSA (Mosteller) ${round(Math.sqrt((ctx.weightKg * ctx.heightCm) / 3600))} m² · ` : ''}
            eGFR from SCr uses the bedside CKiD equation 0.413 × height / SCr (Harriet Lane Ch. 31, p. 1196). Matching kidney-failure rows
            are highlighted inside each drug.
          </span>
        </section>
      )}

      {tab === 'drug' && (
        <div className="np-chips ref-filters np-fade">
          {(
            [
              ['all', 'All'],
              ['book', 'Harriet Lane'],
              ['mine', 'My entries'],
              ['renal', 'Renal adjustment'],
              ['neonate', 'Neonatal dose'],
              ['meningitis', 'Meningitis'],
            ] as [DrugFilter, string][]
          ).map(([k, label]) => (
            <button key={k} type="button" className={drugFilter === k ? 'np-chip on' : 'np-chip'} onClick={() => setDrugFilter(k)}>
              {label}
            </button>
          ))}
          <button type="button" className={fullText ? 'np-chip on' : 'np-chip'} onClick={() => setFullText((v) => !v)}>
            Search inside monographs
          </button>
        </div>
      )}

      {tab === 'drug' && fullText && search.trim().length >= 3 && (
        <section className="np-card np-fade ref-hits">
          <h2>Inside the monographs: “{search.trim()}”</h2>
          {searching && <span className="np-small">Searching…</span>}
          {!searching && hits.length === 0 && <span className="np-small">No monograph mentions this.</span>}
          {hits.map((h) => (
            <button
              key={h.id}
              type="button"
              className="ref-hit"
              onClick={() => {
                setDrugFilter('all')
                setFullText(false)
                setSearch(h.medication)
                setExpandedId(h.id)
              }}
            >
              <b>{h.medication}</b> <span className="ref-src">{h.sourcePages}</span>
              {!h.matchedAll && <span className="np-small"> (some words only)</span>}
              <span className="ref-hit-x">…{h.excerpt.replace(/\*\*/g, '').replace(/\{p\.(\d+)\}/g, '[p.$1]')}…</span>
            </button>
          ))}
        </section>
      )}

      {error && <p className="form-error">{error}</p>}

      {showForm && tab === 'drug' && (
        <form className="np-card np-fade" onSubmit={(e) => void handleAddDrug(e)}>
          <h2>Add drug dosing entry</h2>
          <div className="np-f2">
            <div className="np-field">
              <label htmlFor="rd-med">Medication</label>
              <input id="rd-med" value={drugDraft.medication} onChange={(e) => setDrugDraft({ ...drugDraft, medication: e.target.value })} required />
            </div>
            <div className="np-field">
              <label htmlFor="rd-ind">Indication</label>
              <input id="rd-ind" value={drugDraft.indication} onChange={(e) => setDrugDraft({ ...drugDraft, indication: e.target.value })} />
            </div>
            <div className="np-field">
              <label htmlFor="rd-norm">Normal dose</label>
              <input id="rd-norm" value={drugDraft.normalDose} onChange={(e) => setDrugDraft({ ...drugDraft, normalDose: e.target.value })} />
            </div>
            <div className="np-field">
              <label htmlFor="rd-ped">Pediatric dose</label>
              <input id="rd-ped" value={drugDraft.pediatricDose} onChange={(e) => setDrugDraft({ ...drugDraft, pediatricDose: e.target.value })} />
            </div>
            <div className="np-field">
              <label htmlFor="rd-max">Max dose</label>
              <input id="rd-max" value={drugDraft.maxDose} onChange={(e) => setDrugDraft({ ...drugDraft, maxDose: e.target.value })} />
            </div>
            <div className="np-field">
              <label htmlFor="rd-egfr">eGFR range</label>
              <input id="rd-egfr" value={drugDraft.egfrRange} onChange={(e) => setDrugDraft({ ...drugDraft, egfrRange: e.target.value })} />
            </div>
            <div className="np-field">
              <label htmlFor="rd-adj">Adjusted dose</label>
              <input id="rd-adj" value={drugDraft.adjustedDose} onChange={(e) => setDrugDraft({ ...drugDraft, adjustedDose: e.target.value })} />
            </div>
            <div className="np-field">
              <label htmlFor="rd-freq">Frequency</label>
              <input id="rd-freq" value={drugDraft.frequency} onChange={(e) => setDrugDraft({ ...drugDraft, frequency: e.target.value })} />
            </div>
          </div>
          <div className="np-field">
            <label htmlFor="rd-notes">Notes</label>
            <textarea id="rd-notes" rows={2} value={drugDraft.notes} onChange={(e) => setDrugDraft({ ...drugDraft, notes: e.target.value })} />
          </div>
          <button type="submit" className="np-btn">
            Save
          </button>
        </form>
      )}

      {showForm && tab === 'dialysis' && (
        <form className="np-card np-fade" onSubmit={(e) => void handleAddDialysis(e)}>
          <h2>Add dialysis medication entry</h2>
          <div className="np-f2">
            <div className="np-field">
              <label htmlFor="rl-med">Medication</label>
              <input id="rl-med" value={dialysisDraft.medication} onChange={(e) => setDialysisDraft({ ...dialysisDraft, medication: e.target.value })} required />
            </div>
            <div className="np-field">
              <label htmlFor="rl-ind">Indication</label>
              <input id="rl-ind" value={dialysisDraft.indication} onChange={(e) => setDialysisDraft({ ...dialysisDraft, indication: e.target.value })} />
            </div>
            <div className="np-field">
              <label htmlFor="rl-ped">Pediatric dose</label>
              <input id="rl-ped" value={dialysisDraft.pediatricDose} onChange={(e) => setDialysisDraft({ ...dialysisDraft, pediatricDose: e.target.value })} />
            </div>
            <div className="np-field">
              <label htmlFor="rl-route">Route</label>
              <input id="rl-route" value={dialysisDraft.route} onChange={(e) => setDialysisDraft({ ...dialysisDraft, route: e.target.value })} />
            </div>
            <div className="np-field">
              <label htmlFor="rl-freq">Frequency</label>
              <input id="rl-freq" value={dialysisDraft.frequency} onChange={(e) => setDialysisDraft({ ...dialysisDraft, frequency: e.target.value })} />
            </div>
            <div className="np-field">
              <label htmlFor="rl-max">Max dose</label>
              <input id="rl-max" value={dialysisDraft.maxDose} onChange={(e) => setDialysisDraft({ ...dialysisDraft, maxDose: e.target.value })} />
            </div>
          </div>
          <div className="np-field">
            <label htmlFor="rl-notes">Notes</label>
            <textarea id="rl-notes" rows={2} value={dialysisDraft.notes} onChange={(e) => setDialysisDraft({ ...dialysisDraft, notes: e.target.value })} />
          </div>
          <button type="submit" className="np-btn">
            Save
          </button>
        </form>
      )}

      <div className="np-grid2">
        {loading ? (
          <p>Loading…</p>
        ) : activeList.length === 0 ? (
          <section className="np-empty np-fade">
            <b style={{ fontSize: 15 }}>No entries yet</b>
            <span className="np-small">Add your first verified dosing entry above.</span>
          </section>
        ) : (
          <section className="np-card np-fade" style={{ animationDelay: '.14s', padding: '6px 16px', gap: 0 }}>
            {activeList.map((d) => renderMed(d))}
          </section>
        )}

        <section className="np-card np-fade" style={{ animationDelay: '.2s' }}>
          <h2>Attachments</h2>
          <span className="np-small">
            Photos or PDFs of tables, protocols or dosing charts for {tab === 'drug' ? 'drug dosing' : 'dialysis medications'}.
          </span>
          <button
            type="button"
            className="ref-drop"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e: DragEvent<HTMLButtonElement>) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleAttachmentDrop}
          >
            <svg className="ref-drop-frame" aria-hidden="true">
              <rect x="1" y="1" height="158" rx="17" style={{ width: 'calc(100% - 2px)' }} fill="none" stroke="#5B8EF0" strokeWidth={2} strokeDasharray="8 4" />
            </svg>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,application/pdf"
              multiple
              hidden
              onChange={(e) => void handleAttachmentFiles(e.target.files)}
            />
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1E5BD8" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="ref-drop-icon">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            <b style={{ fontSize: 14 }}>{uploadingAttachment ? 'Uploading…' : 'Drop images or PDFs'}</b>
            <span className="np-small">{dragOver ? 'Release to upload' : 'Choose one or more files'}</span>
          </button>
          {unlinkedTabAttachments.length === 0 ? (
            <span className="np-small">
              {attachments[tab].length === 0
                ? 'No attachments yet.'
                : 'Every attachment is linked to a medication — open it in the list to view.'}
            </span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {unlinkedTabAttachments.map((a) => (
                <div key={a.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {attachmentUrls[a.id] ? (
                    isImagePath(a.storagePath) ? (
                      <a href={attachmentUrls[a.id]} target="_blank" rel="noreferrer">
                        <img src={attachmentUrls[a.id]} alt={a.filename ?? 'Attachment'} style={{ maxWidth: '100%', borderRadius: 10 }} />
                      </a>
                    ) : (
                      <a href={attachmentUrls[a.id]} target="_blank" rel="noreferrer">
                        Open PDF — {a.filename}
                      </a>
                    )
                  ) : (
                    <span className="np-small">Loading…</span>
                  )}
                  <span className="np-small">{a.filename ?? 'Attachment'}</span>
                  <select value={a.entryId ?? ''} onChange={(e) => void handleLinkAttachment(a.id, e.target.value)}>
                    <option value="">Not linked to a medication</option>
                    {(tab === 'drug' ? drugs : dialysis).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.medication}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="link-button" style={{ alignSelf: 'flex-start' }} onClick={() => void handleDeleteAttachment(a)}>
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
