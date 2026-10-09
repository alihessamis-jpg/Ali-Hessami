import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { kdigoStage, schwartzEGFR } from '../../lib/formulas'
import { toShamsi } from '../../lib/shamsi'
import type { LabEntry, Patient } from '../../types/domain'

interface Props {
  labEntries: LabEntry[]
  patient: Patient
}

type Metric = 'cr' | 'eg'

function shortShamsi(date: string): string {
  const full = toShamsi(date)
  const parts = full.split('/')
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : full
}

function CrTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { date: string; value: number } }> }) {
  if (!active || !payload || payload.length === 0) return null
  const p = payload[0].payload
  return (
    <div className="pc-tip">
      {p.value.toFixed(2)} mg/dL · {shortShamsi(p.date)}
    </div>
  )
}

function EgTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { date: string; value: number } }> }) {
  if (!active || !payload || payload.length === 0) return null
  const p = payload[0].payload
  return (
    <div className="pc-tip">
      {Math.round(p.value)} mL/min/1.73m² · {shortShamsi(p.date)}
    </div>
  )
}

export function KidneyFunctionTrend({ labEntries, patient }: Props) {
  const [metric, setMetric] = useState<Metric>('cr')

  const crEntries = useMemo(
    () =>
      labEntries
        .filter((e) => e.test === 'Creatinine' && e.value != null)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [labEntries]
  )

  const crSeries = useMemo(() => crEntries.map((e) => ({ date: e.date, value: e.value as number })), [crEntries])

  const egSeries = useMemo(() => {
    if (!patient.height) return []
    return crEntries.map((e) => ({ date: e.date, value: schwartzEGFR(patient.height!, e.value as number) }))
  }, [crEntries, patient.height])

  const peak = useMemo(() => {
    if (crEntries.length === 0) return null
    return crEntries.reduce((max, e) => ((e.value as number) > (max.value as number) ? e : max), crEntries[0])
  }, [crEntries])

  const stage = peak && patient.baselineCr != null ? kdigoStage(patient.baselineCr, peak.value as number, !!patient.dialysisStatus) : null

  const recovering =
    peak && crEntries.length > 0 && crEntries[crEntries.length - 1].id !== peak.id && (crEntries[crEntries.length - 1].value as number) < (peak.value as number)

  if (crEntries.length < 2) {
    return (
      <section className="np-card np-fade pc-wide" style={{ animationDelay: '.22s' }}>
        <div className="np-head" style={{ flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <h2>Kidney function trend</h2>
            <span className="np-small">Fills in from Labs</span>
          </div>
        </div>
        <section className="np-empty">
          <b style={{ fontSize: 15 }}>Not enough data yet</b>
          <span className="np-small">Add at least 2 creatinine results on the Labs tab to see a trend.</span>
        </section>
      </section>
    )
  }

  const series = metric === 'cr' ? crSeries : egSeries
  const baseline = metric === 'cr' ? patient.baselineCr : patient.baselineEGFR
  const gradientId = metric === 'cr' ? 'pc-grad-cr' : 'pc-grad-eg'

  return (
    <section className="np-card np-fade pc-wide" style={{ animationDelay: '.22s' }}>
      <div className="np-head" style={{ flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <h2>Kidney function trend</h2>
          <span className="np-small">From this patient's Labs</span>
        </div>
        <div className="np-seg" style={{ width: 'auto' }}>
          <button type="button" className={metric === 'cr' ? 'on' : ''} onClick={() => setMetric('cr')}>
            Creatinine
          </button>
          <button type="button" className={metric === 'eg' ? 'on' : ''} onClick={() => setMetric('eg')}>
            eGFR
          </button>
        </div>
      </div>

      {metric === 'eg' && egSeries.length === 0 ? (
        <section className="np-empty">
          <b style={{ fontSize: 15 }}>No height on file</b>
          <span className="np-small">Record a height on the Growth &amp; BP tab to calculate eGFR from creatinine.</span>
        </section>
      ) : (
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <AreaChart data={series} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#1E5BD8" stopOpacity={0.16} />
                  <stop offset="100%" stopColor="#1E5BD8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E6ECF5" vertical={false} />
              <XAxis dataKey="date" tickFormatter={shortShamsi} tick={{ fontSize: 11, fill: '#6B7A90' }} />
              <YAxis domain={[0, 'auto']} tick={{ fontSize: 11, fill: '#6B7A90' }} width={34} />
              <Tooltip content={metric === 'cr' ? <CrTooltip /> : <EgTooltip />} />
              {baseline != null && (
                <ReferenceLine
                  y={baseline}
                  stroke="#8A97AB"
                  strokeWidth={1.5}
                  strokeDasharray="5 5"
                  label={{ value: `baseline ${baseline}`, position: 'insideTopRight', fontSize: 11, fontWeight: 700, fill: '#52627A' }}
                />
              )}
              <Area
                type="monotone"
                dataKey="value"
                stroke="#1E5BD8"
                strokeWidth={2.5}
                fill={`url(#${gradientId})`}
                dot={{ r: 5, fill: '#1E5BD8', stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 6 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {stage != null && peak && patient.baselineCr != null && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className="np-tag" style={{ fontSize: 12, color: '#93590B', background: '#FDF0DC', padding: '5px 10px' }}>
            Peak Cr {(peak.value as number).toFixed(2)} · {((peak.value as number) / patient.baselineCr).toFixed(1)}× baseline → AKI stage {stage}
          </span>
          {recovering && (
            <span className="np-tag" style={{ fontSize: 12, color: '#1546A8', background: '#E3EDFD', padding: '5px 10px' }}>
              Recovering since <span className="fa">{shortShamsi(peak.date)}</span>
            </span>
          )}
        </div>
      )}
    </section>
  )
}
