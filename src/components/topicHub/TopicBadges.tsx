import { parseSummary } from '../../lib/topicHub'
import { toShamsi } from '../../lib/shamsi'
import type { AcademyTopic } from '../../types/domain'

/** «✅ بازبینی‌شده» / «⚠️ بازبینی جزئی» / «📝 یادداشت شخصی» (+ «ویرایش دستی — تاریخ»). */
export function TopicBadges({ topic, showEdited = false }: { topic: AcademyTopic; showEdited?: boolean }) {
  const p = parseSummary(topic.summary)
  return (
    <span className="th-badges">
      {p.status === 'reviewed' && (
        <span className="th-badge ok" title={p.statusText ?? undefined}>
          ✅ بازبینی‌شده
        </span>
      )}
      {p.status === 'partial' && (
        <span className="th-badge warn" title={p.statusText ?? undefined}>
          ⚠️ بازبینی جزئی
        </span>
      )}
      {p.personal && <span className="th-badge note">📝 یادداشت شخصی</span>}
      {showEdited && topic.editedAt && <span className="th-badge edited">ویرایش دستی — {toShamsi(topic.editedAt.slice(0, 10))}</span>}
    </span>
  )
}

export function AccuracyBar({ accuracy, attempts }: { accuracy: number | null; attempts: number }) {
  if (accuracy == null) return <span className="np-small">هنوز تمرین نشده</span>
  const color = accuracy >= 80 ? '#0f8b5f' : accuracy >= 65 ? '#1e5bd8' : accuracy >= 50 ? '#c27a0e' : '#c0392b'
  return (
    <span className="th-acc" title={`${attempts} attempts`}>
      <span className="th-acc-bar" aria-hidden="true">
        <i style={{ width: `${Math.max(3, accuracy)}%`, background: color }} />
      </span>
      <b style={{ color }}>{Math.round(accuracy)}%</b>
    </span>
  )
}
