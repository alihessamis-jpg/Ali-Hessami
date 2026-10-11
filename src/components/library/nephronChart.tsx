// Renders a NEPHRON_CHAPTER_FORMAT.md v1.1 ```nephron-chart``` fenced block
// as an SVG line chart. The markdown table that follows it in the source
// stays as the accessible/data fallback -- it's rendered separately by the
// normal `table` component, unchanged.
import type { ReactNode } from 'react'

export interface NephronChartSeries {
  name: string
  fa?: string
  color: string
  values: number[]
}

export interface NephronChartSpec {
  type: 'line'
  id?: string
  x: number[]
  x_label?: string
  y_label?: string
  y_min: number
  y_max: number
  series: NephronChartSeries[]
}

const WIDTH = 520
const HEIGHT = 300
const LEFT = 52
const RIGHT = 504
const TOP = 16
const BOTTOM = 256

function niceStep(range: number, targetTicks = 5): number {
  const rough = range / targetTicks
  const mag = Math.pow(10, Math.floor(Math.log10(rough)))
  const norm = rough / mag
  const step = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10
  return step * mag
}

export function renderNephronChart(spec: NephronChartSpec, index: number): ReactNode {
  const { x, y_min: yMin, y_max: yMax, series } = spec
  if (!Array.isArray(x) || x.length === 0 || !Array.isArray(series) || series.length === 0 || yMax <= yMin) {
    return null
  }

  const xAt = (i: number) => LEFT + ((x[i] - x[0]) / (x[x.length - 1] - x[0] || 1)) * (RIGHT - LEFT)
  const yAt = (v: number) => BOTTOM - ((v - yMin) / (yMax - yMin)) * (BOTTOM - TOP)

  const step = niceStep(yMax - yMin)
  const ticks: number[] = []
  for (let v = Math.ceil(yMin / step) * step; v <= yMax + 1e-9; v += step) ticks.push(Math.round(v * 1000) / 1000)

  const caption = `Figure ${index}${spec.y_label ? ` · ${spec.y_label}` : ''}`

  return (
    <figure className="chart" dir="ltr">
      <figcaption>
        <bdi dir="ltr">{caption}</bdi>
      </figcaption>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} fontFamily="Plus Jakarta Sans, sans-serif">
        {ticks.map((t) => (
          <g key={`t-${t}`}>
            <line x1={LEFT} x2={RIGHT} y1={yAt(t)} y2={yAt(t)} stroke="#E6ECF5" />
            <text x={LEFT - 8} y={yAt(t) + 4} textAnchor="end" fontSize={14} fill="#7A879B">
              {t}%
            </text>
          </g>
        ))}
        {x.map((v, i) => (
          <text key={`x-${i}`} x={xAt(i)} y={BOTTOM + 18} textAnchor="middle" fontSize={14} fill="#7A879B">
            {v}
          </text>
        ))}
        {spec.x_label && (
          <text x={(LEFT + RIGHT) / 2} y={BOTTOM + 40} textAnchor="middle" fontSize={14} fill="#7A879B">
            {spec.x_label}
          </text>
        )}
        {series.map((s, si) => {
          const points = s.values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ')
          return (
            <g key={`s-${si}`}>
              <polyline points={points} fill="none" stroke={s.color} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
              {s.values.map((v, i) => (
                <circle key={`c-${si}-${i}`} cx={xAt(i)} cy={yAt(v)} r={3.5} fill="#fff" stroke={s.color} strokeWidth={2} />
              ))}
            </g>
          )
        })}
      </svg>
      <div className="legend">
        {series.map((s, si) => (
          <span key={`l-${si}`}>
            <i style={{ background: s.color }} />
            <bdi dir="ltr">{s.name}</bdi>
            {s.fa && (
              <>
                {' · '}
                <span dir="rtl">{s.fa}</span>
              </>
            )}
          </span>
        ))}
      </div>
    </figure>
  )
}
