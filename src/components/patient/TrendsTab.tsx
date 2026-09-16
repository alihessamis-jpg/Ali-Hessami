import { useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { listLabEntries } from '../../lib/api/labs'
import { toShamsi } from '../../lib/shamsi'
import type { LabEntry } from '../../types/domain'

interface Props {
  patientId: string
}

export function TrendsTab({ patientId }: Props) {
  const [entries, setEntries] = useState<LabEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTest, setSelectedTest] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    listLabEntries(patientId)
      .then((rows) => {
        setEntries(rows)
        setSelectedTest((current) => current ?? rows[0]?.test ?? null)
      })
      .finally(() => setLoading(false))
  }, [patientId])

  const tests = useMemo(() => Array.from(new Set(entries.map((e) => e.test))).sort(), [entries])

  const chartData = useMemo(
    () =>
      entries
        .filter((e) => e.test === selectedTest && e.value != null)
        .map((e) => ({ date: e.date, value: e.value as number })),
    [entries, selectedTest]
  )

  if (loading) return <p>Loading…</p>
  if (tests.length === 0) return <p className="empty-state">Add labs to see trends.</p>

  return (
    <div>
      <div className="trend-picker">
        <label>
          Test
          <select value={selectedTest ?? ''} onChange={(e) => setSelectedTest(e.target.value)}>
            {tests.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      {chartData.length < 2 ? (
        <p className="empty-state">Need at least two data points for {selectedTest} to plot a trend.</p>
      ) : (
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={(value: string) => toShamsi(value)} />
              <YAxis domain={['auto', 'auto']} />
              <Tooltip labelFormatter={(label: string) => toShamsi(label)} />
              <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
