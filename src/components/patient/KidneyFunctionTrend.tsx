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

interface SeriesPoint {
  date: string
  value: number
  x: number
}

interface GapBreak {
  midX: number
  realGapDays: number
}

// A gap wider than this between two consecutive results is compressed on
// the x-axis (so one old outlier result doesn't squeeze every other point
// into a sliver) and marked with a break glyph instead of being drawn to
// real scale.
const GAP_THRESHOLD_DAYS = 45
const COMPRESSED_GAP_VISUAL_DAYS = 20

function daysBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000
}

// Lays out points on a real day-scaled x-axis, compressing any gap over
// the threshold to a fixed visual width and recording its midpoint so a
// break marker can be drawn there.
function layoutTimeScale(dates: string[]): { x: number[]; breaks: GapBreak[] } {
  const x = [0]
  const breaks: GapBreak[] = []
  for (let i = 1; i < dates.length; i++) {
    const realGap = daysBetween(dates[i - 1], dates[i])
    if (realGap > GAP_THRESHOLD_DAYS) {
      breaks.push({ midX: x[i - 1] + COMPRESSED_GAP_VISUAL_DAYS / 2, realGapDays: Math.round(realGap) })
      x.push(x[i - 1] + COMPRESSED_GAP_VISUAL_DAYS)
    } else {
      x.push(x[i - 1] + realGap)
    }
  }
  return { x, breaks }
}

// Walks backward from the latest point while the trend keeps moving in the
// given direction, returning the point where that run started — the peak
// before a decline, or the trough before a rise.
function findTrendStart<T extends { value: number }>(entries: T[], direction: 'falling' | 'rising'): T {
  let i = entries.length - 1
  while (i > 0) {
    const prev = entries[i - 1].value
    const curr = entries[i].value
    const continues = direction === 'falling' ? prev >= curr : prev <= curr
    if (!continues) break
    i--
  }
  return entries[i]
}

function shortShamsi(date: string): string {
  const full = toShamsi(date)
  const parts = full.split('/')
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : full
}

function CrTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: SeriesPoint }> }) {
  if (!active || !payload || payload.length === 0) return null
  const p = payload[0].payload
  return (
    <div className="pc-tip">
      {p.value.toFixed(2)} mg/dL · {shortShamsi(p.date)}
    </div>
  )
}

function EgTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: SeriesPoint }> }) {
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

  // Normalized {date, value} points — crEntries is already filtered to
  // value != null, but that narrowing doesn't survive on the LabEntry type.
  const crPoints = useMemo(() => crEntries.map((e) => ({ date: e.date, value: e.value as number })), [crEntries])

  const { x: xPositions, breaks } = useMemo(() => layoutTimeScale(crPoints.map((p) => p.date)), [crPoints])

  const crSeries = useMemo<SeriesPoint[]>(
    () => crPoints.map((p, i) => ({ date: p.date, value: p.value, x: xPositions[i] })),
    [crPoints, xPositions]
  )

  const egSeries = useMemo<SeriesPoint[]>(() => {
    if (!patient.height) return []
    return crPoints.map((p, i) => ({ date: p.date, value: schwartzEGFR(patient.height!, p.value), x: xPositions[i] }))
  }, [crPoints, xPositions, patient.height])

  const peak = useMemo(() => {
    if (crPoints.length === 0) return null
    return crPoints.reduce((max, p) => (p.value > max.value ? p : max), crPoints[0])
  }, [crPoints])

  const stage = peak && patient.baselineCr != null ? kdigoStage(patient.baselineCr, peak.value, !!patient.dialysisStatus) : null

  const trend = useMemo(() => {
    if (crPoints.length < 2) return null
    const last = crPoints[crPoints.length - 1].value
    const prev = crPoints[crPoints.length - 2].value
    if (last < prev) return { direction: 'falling' as const, since: findTrendStart(crPoints, 'falling').date }
    if (last > prev) return { direction: 'rising' as const, since: findTrendStart(crPoints, 'rising').date }
    return null
  }, [crPoints])

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
  const unit = metric === 'cr' ? 'mg/dL' : 'mL/min/1.73m²'
  const xTicks = series.map((p) => p.x)
  const xLabelByTick = new Map(series.map((p) => [p.x, shortShamsi(p.date)]))

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
            <AreaChart data={series} margin={{ top: 8, right: 16, left: 4, bottom: 8 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#1E5BD8" stopOpacity={0.16} />
                  <stop offset="100%" stopColor="#1E5BD8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E6ECF5" vertical={false} />
              <XAxis
                dataKey="x"
                type="number"
                domain={['dataMin', 'dataMax']}
                ticks={xTicks}
                tickFormatter={(x: number) => xLabelByTick.get(x) ?? ''}
                tick={{ fontSize: 11, fill: '#6B7A90' }}
              />
              <YAxis
                domain={[0, 'auto']}
                tick={{ fontSize: 11, fill: '#6B7A90' }}
                width={44}
                label={{ value: unit, angle: -90, position: 'insideLeft', fontSize: 10, fill: '#6B7A90' }}
              />
              <Tooltip content={metric === 'cr' ? <CrTooltip /> : <EgTooltip />} />
              {breaks.map((b) => (
                <ReferenceLine
                  key={b.midX}
                  x={b.midX}
                  stroke="#A9B3C4"
                  strokeWidth={1.5}
                  strokeDasharray="2 3"
                  label={{ value: '⫽', position: 'top', fontSize: 14, fill: '#8A97AB' }}
                />
              ))}
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
                type="linear"
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

      {breaks.length > 0 && (
        <span className="np-small">
          ⫽ marks a compressed gap of {breaks.map((b) => `${b.realGapDays}d`).join(', ')} between results.
        </span>
      )}

      {(stage != null || trend) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {stage != null && peak && patient.baselineCr != null && (
            <span className="np-tag" style={{ fontSize: 12, color: '#93590B', background: '#FDF0DC', padding: '5px 10px' }}>
              Peak Cr {peak.value.toFixed(2)} · {(peak.value / patient.baselineCr).toFixed(1)}× baseline → AKI stage {stage}
            </span>
          )}
          {trend?.direction === 'falling' && (
            <span className="np-tag" style={{ fontSize: 12, color: '#1546A8', background: '#E3EDFD', padding: '5px 10px' }}>
              Recovering since <span className="fa">{shortShamsi(trend.since)}</span>
            </span>
          )}
          {trend?.direction === 'rising' && (
            <span className="np-tag" style={{ fontSize: 12, color: '#93590B', background: '#FDF0DC', padding: '5px 10px' }}>
              Rising since <span className="fa">{shortShamsi(trend.since)}</span>
            </span>
          )}
        </div>
      )}
    </section>
  )
}
