import { useMemo } from 'react'
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { buildBpReferenceCurve, type Sex } from '../../lib/growth'
import { toShamsi } from '../../lib/shamsi'

interface PatientBpPoint {
  ageYears: number
  sbp: number
  dbp: number
  date: string
}

interface Props {
  sex: Sex
  heightPercentile: number
  patientPoints: PatientBpPoint[]
}

const PERCENTILE_STYLE: Record<'50' | '90' | '95', { stroke: string; dash?: string; width: number }> = {
  '50': { stroke: '#64748b', width: 1.5 },
  '90': { stroke: '#94a3b8', dash: '4 3', width: 1 },
  '95': { stroke: '#d97706', dash: '4 3', width: 1 },
}

function ageLabel(years: number): string {
  return `${years.toFixed(years < 3 ? 1 : 0)}y`
}

type ReferencePoint = ReturnType<typeof buildBpReferenceCurve>[number]

function referenceValue(point: ReferencePoint, dataKey: 'sbp' | 'dbp', pct: '50' | '90' | '95'): number {
  if (dataKey === 'sbp') return pct === '50' ? point.sbp50 : pct === '90' ? point.sbp90 : point.sbp95
  return pct === '50' ? point.dbp50 : pct === '90' ? point.dbp90 : point.dbp95
}

function useChartLines(curve: ReferencePoint[], key: 'sbp' | 'dbp', maxAge: number) {
  return useMemo(
    () =>
      (['50', '90', '95'] as const).map((pct) => ({
        pct,
        data: curve
          .filter((p) => p.ageYears <= maxAge)
          .map((p) => ({ ageYears: p.ageYears, value: referenceValue(p, key, pct) })),
      })),
    [curve, key, maxAge]
  )
}

function BpSubChart({
  title,
  unit,
  curve,
  dataKey,
  patientData,
  maxAge,
}: {
  title: string
  unit: string
  curve: ReturnType<typeof buildBpReferenceCurve>
  dataKey: 'sbp' | 'dbp'
  patientData: Array<{ ageYears: number; value: number; date: string }>
  maxAge: number
}) {
  const lines = useChartLines(curve, dataKey, maxAge)
  return (
    <div>
      <p className="patient-meta" style={{ fontWeight: 600 }}>{title}</p>
      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer>
          <ComposedChart margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="ageYears"
              type="number"
              domain={[1, maxAge]}
              tickFormatter={ageLabel}
              allowDuplicatedCategory={false}
            />
            <YAxis type="number" domain={['auto', 'auto']} unit={unit} width={56} />
            <Tooltip
              labelFormatter={(years: number) => `Age: ${ageLabel(Number(years))}`}
              formatter={(value: number, name: string) => [`${Number(value).toFixed(0)} ${unit}`, name]}
            />
            {lines.map(({ pct, data }) => (
              <Line
                key={pct}
                data={data}
                dataKey="value"
                name={`${pct}th percentile`}
                stroke={PERCENTILE_STYLE[pct].stroke}
                strokeWidth={PERCENTILE_STYLE[pct].width}
                strokeDasharray={PERCENTILE_STYLE[pct].dash}
                dot={false}
                isAnimationActive={false}
              />
            ))}
            <Line
              data={patientData}
              dataKey="value"
              name="Patient"
              stroke="#2563eb"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#2563eb' }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function BpChart({ sex, heightPercentile, patientPoints }: Props) {
  const curve = useMemo(() => buildBpReferenceCurve(sex, heightPercentile), [sex, heightPercentile])

  const maxAge = useMemo(() => {
    const tableMax = curve[curve.length - 1]?.ageYears ?? 17
    if (patientPoints.length === 0) return tableMax
    const maxPatientAge = Math.max(...patientPoints.map((p) => p.ageYears))
    return Math.min(tableMax, Math.max(5, Math.ceil(maxPatientAge)))
  }, [curve, patientPoints])

  const sbpPoints = useMemo(
    () =>
      [...patientPoints]
        .filter((p) => p.ageYears <= maxAge)
        .sort((a, b) => a.ageYears - b.ageYears)
        .map((p) => ({ ageYears: p.ageYears, value: p.sbp, date: p.date })),
    [patientPoints, maxAge]
  )
  const dbpPoints = useMemo(
    () =>
      [...patientPoints]
        .filter((p) => p.ageYears <= maxAge)
        .sort((a, b) => a.ageYears - b.ageYears)
        .map((p) => ({ ageYears: p.ageYears, value: p.dbp, date: p.date })),
    [patientPoints, maxAge]
  )

  const latest = useMemo(() => {
    if (patientPoints.length === 0) return null
    const sorted = [...patientPoints].sort((a, b) => a.ageYears - b.ageYears)
    return sorted[sorted.length - 1]
  }, [patientPoints])

  if (curve.length === 0) return null

  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <h2 className="dash-card-title">Blood pressure-for-age (AAP 2017)</h2>
      </div>
      <BpSubChart title="Systolic" unit="mmHg" curve={curve} dataKey="sbp" patientData={sbpPoints} maxAge={maxAge} />
      <BpSubChart title="Diastolic" unit="mmHg" curve={curve} dataKey="dbp" patientData={dbpPoints} maxAge={maxAge} />
      <p className="patient-meta">
        Dashed amber: 95th percentile · dashed grey: 90th · solid grey: 50th (median) · blue: this patient. Reference
        lines assume the {Math.round(heightPercentile)}th height percentile (this patient's most recent); the AAP
        guideline also applies simplified fixed cutoffs (e.g. ≥130/80, ≥140/90) from age 13 onward, used for the
        category shown above.
      </p>
      {latest && (
        <p className="patient-meta">
          Latest: {toShamsi(latest.date)} — {latest.sbp}/{latest.dbp} mmHg
        </p>
      )}
    </div>
  )
}
