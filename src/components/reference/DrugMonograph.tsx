import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getDrugReference } from '../../lib/api/drugReference'
import { computeDoses, egfrRowMatches, round, type Dialysis, type DoseResult } from '../../lib/doseCalc'
import type { DrugRefEntry, RenalAdjustment } from '../../types/domain'

export interface PatientDoseContext {
  weightKg: number | null
  heightCm: number | null
  egfr: number | null
  dialysis: Dialysis
}

type Tab = 'dose' | 'neonate' | 'meningitis' | 'renal' | 'interactions' | 'supplied' | 'full'

interface Line {
  text: string
  path: string[]
  page: number | null
}

const PAGE_MARK = /\s*\{p\.(\d+)\}/g

function firstPage(pages: string | null | undefined): number | null {
  const m = pages?.match(/(\d+)/)
  return m ? Number(m[1]) : null
}

function stripMd(s: string): string {
  return s.replace(/\*\*/g, '').replace(/^\s*-\s+/, '').replace(PAGE_MARK, '').trim()
}

/** Flattens the monograph markdown into lines with their heading path and book page. */
function monographLines(md: string, startPage: number | null): Line[] {
  const out: Line[] = []
  let page = startPage
  const stack: { depth: number; label: string }[] = []
  let inCode = false
  for (const raw of md.split('\n')) {
    if (raw.trim().startsWith('```')) {
      inCode = !inCode
      continue
    }
    const pm = [...raw.matchAll(PAGE_MARK)]
    const text = stripMd(raw)
    if (!text) {
      if (pm.length) page = Number(pm[pm.length - 1][1])
      continue
    }
    const list = raw.match(/^(\s*)-\s+/)
    const depth = inCode ? 99 : list ? 1 + Math.floor(list[1].length / 2) : 0
    while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop()
    // a page marker on a line means the line itself starts on that page
    if (pm.length) page = Number(pm[0][1])
    out.push({ text, path: stack.map((s) => s.label), page })
    const label = text.includes(':') ? text.slice(0, text.indexOf(':')) : text
    if (!inCode && label.length <= 90) stack.push({ depth, label })
  }
  return out
}

function parseTaggedLines(block: string | null | undefined): Line[] {
  if (!block) return []
  return block
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => {
      const pm = l.match(/\[p\.(\d+)\]\s*$/)
      const body = l.replace(/\s*\[p\.\d+\]\s*$/, '')
      const parts = body.split(' › ')
      return { text: parts[parts.length - 1], path: parts.slice(0, -1), page: pm ? Number(pm[1]) : null }
    })
}

function unitPer(r: DoseResult) {
  return `${r.match.unit}${r.match.per ? '/' + r.match.per : ''}`
}

function DoseChips({ text, ctx }: { text: string; ctx: PatientDoseContext }) {
  const results = computeDoses(text, { weightKg: ctx.weightKg, heightCm: ctx.heightCm })
  if (!results.length) return null
  return (
    <span className="ref-calc">
      {results.map((r, i) => {
        const basis = r.match.basis === 'kg' ? `${ctx.weightKg} kg` : `BSA ${round(r.bsa ?? 0)} m²`
        const total = r.totalLo === r.totalHi ? round(r.totalLo) : `${round(r.totalLo)}–${round(r.totalHi)}`
        return (
          <span key={i} className={r.capped ? 'ref-calc-chip warn' : 'ref-calc-chip'} title={`${r.match.expr} × ${basis}`}>
            <b>
              {total} {unitPer(r)}
            </b>
            {r.perDoseLo != null && r.perDoseHi != null && (
              <>
                {' '}
                → {r.perDoseLo === r.perDoseHi ? round(r.perDoseLo) : `${round(r.perDoseLo)}–${round(r.perDoseHi)}`} {r.match.unit}/dose ({r.divisionLabel})
              </>
            )}
            <span className="ref-calc-src">
              {' '}
              ({r.match.expr} × {basis})
            </span>
            {r.max && (
              <span className="ref-calc-max">
                {' '}
                · {r.capped ? '⚠ exceeds ' : ''}
                {r.max.raw}
              </span>
            )}
          </span>
        )
      })}
    </span>
  )
}

function LineList({ lines, ctx, empty, onlyDoses }: { lines: Line[]; ctx: PatientDoseContext; empty: string; onlyDoses?: boolean }) {
  const shown = onlyDoses ? lines.filter((l) => /\/\s*(kg|m\s?2|m²)/.test(l.text)) : lines
  if (!shown.length) return <span className="np-small">{empty}</span>
  return (
    <ul className="ref-lines">
      {shown.map((l, i) => (
        <li key={i}>
          {l.path.length > 0 && <span className="ref-path">{l.path.join(' › ')}</span>}
          <span>{l.text}</span>
          {l.page != null && <span className="ref-page">p. {l.page}</span>}
          <DoseChips text={l.text} ctx={ctx} />
        </li>
      ))}
    </ul>
  )
}

function RenalTables({ entries, ctx }: { entries: RenalAdjustment[]; ctx: PatientDoseContext }) {
  return (
    <div className="ref-renal">
      {entries.map((e, i) => (
        <div key={i} className="ref-renal-one">
          <div className="ref-renal-head">
            <b>{e.name}</b>
            <span className="ref-src">
              Harriet Lane 23e · Table {e.table} · p. {e.pages}
            </span>
            {e.adult_only && <span className="ref-flag">ᵇ adult data — pediatric guidelines not established</span>}
          </div>
          {e.note && <p className="ref-note">NOTE: {e.note}</p>}
          <div className="ref-tablewrap">
            <table>
              <thead>
                <tr>
                  <th>eGFR (mL/min/1.73 m²)</th>
                  <th>% of usual dose / dose</th>
                  <th>Interval</th>
                </tr>
              </thead>
              <tbody>
                {e.sections.map((s, si) => (
                  <SectionRows key={si} label={s.label} rows={s.rows} ctx={ctx} />
                ))}
              </tbody>
            </table>
          </div>
          {Object.entries(e.footnotes).length > 0 && (
            <ul className="ref-foot">
              {Object.entries(e.footnotes).map(([k, v]) => (
                <li key={k}>
                  <b>{k}</b> {v}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      <p className="np-small">
        Harriet Lane Ch. 31: adjustments do not apply to neonates; they are approximations (often from CKD data) and may not
        extrapolate to AKI — monitor levels and toxicity.
      </p>
    </div>
  )
}

function SectionRows({ label, rows, ctx }: { label: string; rows: RenalAdjustment['sections'][number]['rows']; ctx: PatientDoseContext }) {
  return (
    <>
      {label && (
        <tr className="ref-sec">
          <td colSpan={3}>{label}</td>
        </tr>
      )}
      {rows.map((r, i) => {
        const hit = egfrRowMatches(r.egfr, ctx.egfr, ctx.dialysis)
        return (
          <tr key={i} className={hit ? 'hit' : undefined}>
            <td>{r.egfr}</td>
            <td colSpan={r.interval ? 1 : 2}>{r.dose}</td>
            {r.interval && <td>{r.interval}</td>}
          </tr>
        )
      })}
    </>
  )
}

export function DrugMonograph({ entry, ctx }: { entry: DrugRefEntry; ctx: PatientDoseContext }) {
  const [full, setFull] = useState<DrugRefEntry | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('dose')

  useEffect(() => {
    let alive = true
    getDrugReference(entry.id)
      .then((d) => alive && setFull(d))
      .catch((err) => alive && setError(err instanceof Error ? err.message : 'Failed to load monograph'))
    return () => {
      alive = false
    }
  }, [entry.id])

  const e = full ?? entry
  const start = firstPage(e.sourcePages)
  const lines = useMemo(() => (e.monograph ? monographLines(e.monograph, start) : []), [e.monograph, start])
  const neo = useMemo(() => parseTaggedLines(e.neonatalDose), [e.neonatalDose])
  const men = useMemo(() => parseTaggedLines(e.meningitisDose), [e.meningitisDose])
  const renal = e.renalAdjustment ?? []

  const tabs: [Tab, string, boolean][] = [
    ['dose', 'Dose calculator', !!e.monograph],
    ['neonate', `Neonate (${neo.length})`, neo.length > 0],
    ['meningitis', 'Meningitis / CNS', men.length > 0],
    ['renal', 'Kidney failure', renal.length > 0 || !!e.renalNotes],
    ['interactions', 'Interactions', !!e.interactions],
    ['supplied', 'How supplied', !!e.howSupplied],
    ['full', 'Full monograph', !!e.monograph],
  ]
  const available = tabs.filter((t) => t[2])
  const current = available.some((t) => t[0] === tab) ? tab : available[0]?.[0]

  const citation = [e.source, e.sourceChapter, e.sourcePages].filter(Boolean).join(' — ')

  return (
    <div className="ref-mono">
      {(e.tradeNames || e.drugClass) && (
        <div className="np-small">
          {e.drugClass && <b>{e.drugClass}</b>}
          {e.tradeNames && <span> · {e.tradeNames}</span>}
        </div>
      )}
      {(e.pregnancyCategory || e.renalCaution != null) && (
        <div className="ref-icons">
          {e.pregnancyCategory && <span title="Pregnancy category (see Library → Harriet Lane Ch. 30 §IV)">Pregnancy {e.pregnancyCategory}</span>}
          {e.breastfeedingCategory && <span title="Breastfeeding: 1 compatible · 2 caution · 3 unknown with concerns · X contraindicated · ? not established">Breastfeeding {e.breastfeedingCategory}</span>}
          {e.renalCaution && <span className="warn">Kidney: adjust/caution</span>}
          {e.hepaticCaution && <span className="warn">Liver: adjust/caution</span>}
          {e.pharmacogenomic && <span className="warn">Pharmacogenomics</span>}
        </div>
      )}
      {e.seeAlso && <p className="ref-note">{e.seeAlso}</p>}
      {error && <p className="form-error">{error}</p>}
      {!full && !error && e.sourceKey && <span className="np-small">Loading monograph…</span>}

      {available.length > 0 && (
        <div className="np-chips ref-tabs">
          {available.map(([k, label]) => (
            <button key={k} type="button" className={current === k ? 'np-chip on' : 'np-chip'} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </div>
      )}

      {current === 'dose' && (
        <>
          {!ctx.weightKg && <span className="np-small">Enter the patient's weight above to calculate doses.</span>}
          <LineList lines={lines} ctx={ctx} onlyDoses empty="No weight-based (per kg / per m²) dose in this monograph — see Full monograph." />
          <span className="np-small">
            Calculated only from the numbers printed on each line (× weight, or × BSA by Mosteller). A max dose is checked only when it is
            stated on the same line. Always read the full line and the book page before prescribing.
          </span>
        </>
      )}
      {current === 'neonate' && <LineList lines={neo} ctx={ctx} empty="No neonatal dosing listed." />}
      {current === 'meningitis' && <LineList lines={men} ctx={ctx} empty="No meningitis/CNS dosing listed." />}
      {current === 'renal' && (
        <>
          {renal.length > 0 ? <RenalTables entries={renal} ctx={ctx} /> : <span className="np-small">Not listed in Harriet Lane Tables 31.1/31.2.</span>}
          {e.renalNotes && (
            <div className="ref-md">
              <b>From the monograph remarks:</b>
              <LineList lines={parseTaggedLines(e.renalNotes)} ctx={ctx} empty="" />
            </div>
          )}
        </>
      )}
      {current === 'interactions' && (
        <div className="ref-md">
          <LineList lines={parseTaggedLines(e.interactions)} ctx={ctx} empty="" />
          <span className="np-small">CYP450 substrates/inhibitors/inducers: Library → The Harriet Lane Handbook → Ch. 30, Table 30.1.</span>
        </div>
      )}
      {current === 'supplied' && <p className="ref-pre">{e.howSupplied}</p>}
      {current === 'full' && e.monograph && (
        <div className="ref-md">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{e.monograph.replace(PAGE_MARK, ' `p.$1`')}</ReactMarkdown>
        </div>
      )}

      {citation && <span className="ref-src">Source: {citation}</span>}
    </div>
  )
}
