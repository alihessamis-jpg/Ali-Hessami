import { useMemo } from 'react'
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { buildReferenceCurve, REFERENCE_PERCENTILES, type GrowthMeasurement, type Sex } from '../../lib/growth'
import { toShamsi } from '../../lib/shamsi'

interface PatientPoint {
  ageMonths: number
  value: number
  date: string
}

interface Props {
  measurement: GrowthMeasurement
  sex: Sex
  unit: string
  title: string
  patientPoints: PatientPoint[]
}

const PERCENTILE_STYLE: Record<number, { stroke: string; dash?: string; width: number }> = {
  3: { stroke: '#d97706', dash: '4 3', width: 1 },
  15: { stroke: '#94a3b8', dash: '4 3', width: 1 },
  50: { stroke: '#64748b', width: 1.5 },
  85: { stroke: '#94a3b8', dash: '4 3', width: 1 },
  97: { stroke: '#d97706', dash: '4 3', width: 1 },
}

function ageLabel(months: number): string {
  if (months < 24) return `${Math.round(months)}mo`
  return `${(months / 12).toFixed(1)}y`
}

export function GrowthChart({ measurement, sex, unit, title, patientPoints }: Props) {
  const refCurve = useMemo(() => buildReferenceCurve(measurement, sex), [measurement, sex])

  const maxAgeMonths = useMemo(() => {
    const tableMax = refCurve[refCurve.length - 1]?.ageMonths ?? 24
    if (patientPoints.length === 0) return Math.min(tableMax, 24)
    const maxPatientAge = Math.max(...patientPoints.map((p) => p.ageMonths))
    return Math.min(tableMax, Math.max(24, maxPatientAge * 1.15))
  }, [refCurve, patientPoints])

  const curveLines = useMemo(
    () =>
      REFERENCE_PERCENTILES.map((pct) => ({
        pct,
        data: refCurve.filter((p) => p.ageMonths <= maxAgeMonths).map((p) => ({ ageMonths: p.ageMonths, value: p.values[pct] })),
      })),
    [refCurve, maxAgeMonths]
  )

  const patientData = useMemo(
    () =>
      [...patientPoints]
        .filter((p) => p.ageMonths <= maxAgeMonths)
        .sort((a, b) => a.ageMonths - b.ageMonths)
        .map((p) => ({ ageMonths: p.ageMonths, value: p.value, date: p.date })),
    [patientPoints, maxAgeMonths]
  )

  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <h2 className="dash-card-title">{title}</h2>
      </div>
      <div style={{ width: '100%', height: 320 }}>
        <ResponsiveContainer>
          <ComposedChart margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="ageMonths"
              type="number"
              domain={[0, maxAgeMonths]}
              tickFormatter={ageLabel}
              allowDuplicatedCategory={false}
            />
            <YAxis type="number" domain={['auto', 'auto']} unit={unit} width={56} />
            <Tooltip
              labelFormatter={(months: number) => `Age: ${ageLabel(Number(months))}`}
              formatter={(value: number, name: string) => [`${Number(value).toFixed(2)} ${unit}`, name]}
            />
            {curveLines.map(({ pct, data }) => (
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
                legendType="none"
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
      <p className="patient-meta">
        Dashed amber lines: 3rd/97th percentile · dashed grey: 15th/85th · solid grey: 50th (median) · blue: this patient
        {patientData.length > 0 ? ` (${patientData.length} measurement${patientData.length === 1 ? '' : 's'})` : ''}.
      </p>
      {patientData.length > 0 && (
        <p className="patient-meta">
          Latest: {toShamsi(patientData[patientData.length - 1].date)} — {patientData[patientData.length - 1].value} {unit}
        </p>
      )}
    </div>
  )
}
