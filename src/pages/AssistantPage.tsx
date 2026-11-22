import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AssistantChat } from '../components/assistant/AssistantChat'
import { deleteConversation, listConversations, type AssistantConversation } from '../lib/api/assistant'

type Filter = 'all' | 'patient' | 'chapter' | 'general'

const MODE_LABEL: Record<AssistantConversation['mode'], string> = { patient: 'بیمار', study: 'فصل', general: 'کلی' }

export function AssistantPage() {
  const [params, setParams] = useSearchParams()
  const openId = params.get('c')
  const isNew = params.get('new') === '1'
  const [items, setItems] = useState<AssistantConversation[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [subject, setSubject] = useState<string>('') // patientId or chapterId within the filter

  useEffect(() => {
    listConversations()
      .then(setItems)
      .catch((e) => setError(e.message ?? String(e)))
  }, [openId, isNew])

  const subjects = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of items ?? []) {
      if (filter === 'patient' && c.patientId) m.set(c.patientId, c.patientName ?? 'بیمار')
      if (filter === 'chapter' && c.chapterId) m.set(c.chapterId, c.chapterTitle ?? 'فصل')
    }
    return [...m.entries()]
  }, [items, filter])

  const shown = (items ?? []).filter((c) => {
    if (filter === 'patient') return !!c.patientId && (!subject || c.patientId === subject)
    if (filter === 'chapter') return !!c.chapterId && (!subject || c.chapterId === subject)
    if (filter === 'general') return !c.patientId && !c.chapterId
    return true
  })

  const current = items?.find((c) => c.id === openId) ?? null

  if (openId || isNew) {
    return (
      <div className="np-page as-page" dir="rtl">
        <div className="as-page-bar">
          <button type="button" className="as-mini" onClick={() => setParams({})}>
            → گفت‌وگوها
          </button>
          <span className="as-page-title" dir="auto">
            {current?.title ?? 'گفت‌وگوی جدید'}
          </span>
        </div>
        <AssistantChat
          key={openId ?? 'new'}
          variant="page"
          conversationId={openId}
          mode={current?.mode ?? 'general'}
          patientId={current?.patientId ?? null}
          chapterId={current?.chapterId ?? null}
          contextLabel={current ? current.patientName ?? current.chapterTitle ?? null : null}
          onConversation={(id) => setParams({ c: id }, { replace: true })}
        />
      </div>
    )
  }

  return (
    <div className="np-page as-page" dir="rtl">
      <section className="as-page-hero">
        <h1>✨ دستیار Nephron</h1>
        <p>هر پاسخ فقط از کتاب‌ها، کارت‌ها، بانک سؤال و جدول داروی خودت — با منبع کنار هر جمله.</p>
        <button type="button" className="as-chip solid" onClick={() => setParams({ new: '1' })}>
          + گفت‌وگوی جدید
        </button>
      </section>

      <div className="as-filters" role="tablist" aria-label="فیلتر">
        {(
          [
            ['all', 'همه'],
            ['patient', 'بیماران'],
            ['chapter', 'فصل‌ها'],
            ['general', 'کلی'],
          ] as [Filter, string][]
        ).map(([f, label]) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            className={filter === f ? 'as-chip on' : 'as-chip'}
            onClick={() => {
              setFilter(f)
              setSubject('')
            }}
          >
            {label}
          </button>
        ))}
        {subjects.length > 0 && (
          <select value={subject} onChange={(e) => setSubject(e.target.value)} className="as-select" aria-label="انتخاب">
            <option value="">{filter === 'patient' ? 'همهٔ بیماران' : 'همهٔ فصل‌ها'}</option>
            {subjects.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && <p className="as-err">{error}</p>}
      {!items && !error && <p className="as-hint">در حال بارگذاری…</p>}
      {items && shown.length === 0 && <p className="as-hint">گفت‌وگویی نیست.</p>}

      <ul className="as-convs">
        {shown.map((c) => (
          <li key={c.id}>
            <button type="button" className="as-conv" onClick={() => setParams({ c: c.id })}>
              <span className={`as-tag ${c.mode}`}>{MODE_LABEL[c.mode]}</span>
              <span className="as-conv-title" dir="auto">
                {c.title || '—'}
              </span>
              <span className="as-conv-sub" dir="auto">
                {[c.patientName, c.chapterTitle, new Date(c.updatedAt).toLocaleDateString('fa-IR')].filter(Boolean).join(' · ')}
              </span>
            </button>
            <button
              type="button"
              className="as-del"
              aria-label="حذف گفت‌وگو"
              onClick={async () => {
                if (!window.confirm('این گفت‌وگو حذف شود؟')) return
                await deleteConversation(c.id)
                setItems((xs) => (xs ?? []).filter((x) => x.id !== c.id))
              }}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
