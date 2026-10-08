import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  addChecklistItem,
  addChecklistTemplate,
  deleteChecklistTemplate,
  getChecklistCompletions,
  listChecklistItems,
  listChecklistTemplates,
  setChecklistCompletion,
} from '../lib/api/checklists'
import { useAuth } from '../context/AuthContext'
import { protectNumberRanges } from '../lib/bidiText'
import { matchesSearch } from '../lib/textFilter'
import type { ChecklistItem, ChecklistTemplate } from '../types/domain'

const RING_RADIUS = 40
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

export function ChecklistsPage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [completions, setCompletions] = useState<Record<string, boolean>>({})
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newItemLabel, setNewItemLabel] = useState('')
  const [newItemSection, setNewItemSection] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [templateSearch, setTemplateSearch] = useState('')
  const [itemSearch, setItemSearch] = useState('')

  useEffect(() => {
    listChecklistTemplates()
      .then((rows) => {
        setTemplates(rows)
        setSelectedId((current) => current ?? rows[0]?.id ?? null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load checklists'))
  }, [])

  useEffect(() => {
    if (!selectedId || !session) return
    Promise.all([listChecklistItems(selectedId), getChecklistCompletions(selectedId, session.user.id)])
      .then(([itemRows, completionRows]) => {
        setItems(itemRows)
        setCompletions(completionRows)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load checklist'))
  }, [selectedId, session])

  async function handleAddTemplate(e: FormEvent) {
    e.preventDefault()
    if (!newTemplateName.trim()) return
    try {
      const template = await addChecklistTemplate({ name: newTemplateName.trim(), description: null })
      setTemplates((prev) => [...prev, template])
      setSelectedId(template.id)
      setNewTemplateName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create checklist')
    }
  }

  async function handleAddItem(e: FormEvent) {
    e.preventDefault()
    if (!selectedId || !newItemLabel.trim()) return
    try {
      const item = await addChecklistItem(selectedId, newItemLabel.trim(), items.length, newItemSection.trim() || null)
      setItems((prev) => [...prev, item])
      setNewItemLabel('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item')
    }
  }

  async function toggleItem(itemId: string) {
    if (!session) return
    const next = !completions[itemId]
    setCompletions((prev) => ({ ...prev, [itemId]: next }))
    try {
      await setChecklistCompletion(itemId, session.user.id, next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  async function handleDeleteTemplate(id: string) {
    try {
      await deleteChecklistTemplate(id)
      setTemplates((prev) => prev.filter((t) => t.id !== id))
      if (selectedId === id) setSelectedId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const checkedCount = items.filter((i) => completions[i.id]).length
  const visibleTemplates = templates.filter((t) => matchesSearch([t.name, t.description], templateSearch))
  const visibleItems = items.filter((i) => matchesSearch([i.label, i.section], itemSearch))
  const selectedTemplate = templates.find((t) => t.id === selectedId)

  const sectionGroups = useMemo(() => {
    const groups: Array<{ section: string | null; items: ChecklistItem[] }> = []
    for (const item of visibleItems) {
      const section = item.section ?? null
      const last = groups[groups.length - 1]
      if (last && last.section === section) last.items.push(item)
      else groups.push({ section, items: [item] })
    }
    return groups
  }, [visibleItems])

  const ringOffset = items.length === 0 ? RING_CIRCUMFERENCE : RING_CIRCUMFERENCE * (1 - checkedCount / items.length)

  const addTemplateForm = (
    <form className="inline-form" onSubmit={(e) => void handleAddTemplate(e)} style={{ display: 'flex', gap: 8 }}>
      <div className="np-field" style={{ flex: 1 }}>
        <label className="np-sr" htmlFor="chk-new-name">
          New checklist name
        </label>
        <input id="chk-new-name" placeholder="New checklist name" value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} />
      </div>
      <button type="submit" className="np-btn sm" style={{ height: 46 }}>
        Add
      </button>
    </form>
  )

  return (
    <div className="np-page">
      <button type="button" className="np-backlink" onClick={() => navigate(-1)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
          <path d="m15 6-6 6 6 6" />
        </svg>
        Back
      </button>

      <div className="chk-wrap">
        <div className="np-stack">
          <div className="np-chips chk-cchips" dir="rtl">
            {visibleTemplates.map((t) => (
              <button
                key={t.id}
                type="button"
                className={t.id === selectedId ? 'np-chip chk-cchip on' : 'np-chip chk-cchip'}
                onClick={() => setSelectedId(t.id)}
              >
                {t.name}
              </button>
            ))}
          </div>
          <div className="chk-mobile-add">{addTemplateForm}</div>

          {!selectedId || !selectedTemplate ? (
            <section className="np-empty np-fade">
              <b style={{ fontSize: 15 }}>No checklist selected</b>
              <span className="np-small">Create a checklist to get started.</span>
            </section>
          ) : (
            <>
              <section className="np-hero np-fade" dir="rtl">
                <div className="np-glow cyan" />
                <div className="np-hrow">
                  <svg width="96" height="96" viewBox="0 0 96 96" fill="none" aria-hidden="true">
                    <circle cx="48" cy="48" r={RING_RADIUS} stroke="rgba(255,255,255,.14)" strokeWidth={8} />
                    <circle
                      cx="48"
                      cy="48"
                      r={RING_RADIUS}
                      stroke="#7FD4FF"
                      strokeWidth={8}
                      strokeLinecap="round"
                      strokeDasharray={RING_CIRCUMFERENCE}
                      strokeDashoffset={ringOffset}
                      transform="rotate(-90 48 48)"
                      style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1)' }}
                    />
                    <text x="48" y="54" textAnchor="middle" fill="#fff" fontSize="20" fontWeight="800" fontFamily="Plus Jakarta Sans">
                      {checkedCount}/{items.length}
                    </text>
                  </svg>
                  <div className="np-txt">
                    <span className="np-eyebrow">CHECKLIST</span>
                    <h1 className="np-fa" style={{ fontSize: 22, lineHeight: 1.5, fontWeight: 700 }}>
                      {protectNumberRanges(selectedTemplate.name)}
                    </h1>
                    <p className="np-sub np-fa">وضعیت تکمیل برای هر پزشک جداست، نه برای هر بیمار.</p>
                  </div>
                </div>
              </section>

              <div className="np-search">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <label className="np-sr" htmlFor="chk-item-search">
                  Search items
                </label>
                <input id="chk-item-search" placeholder="Search items" value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} />
              </div>

              <div className="np-stack">
                {sectionGroups.map((group, gi) => (
                  <section key={group.section ?? `section-${gi}`} className="np-card chk-sec np-fade" dir="rtl" style={{ animationDelay: `${0.16 + gi * 0.08}s`, gap: 0 }}>
                    {group.section && <h2>{protectNumberRanges(group.section)}</h2>}
                    {group.items.map((item) => {
                      const on = completions[item.id] ?? false
                      return (
                        <button key={item.id} type="button" className={on ? 'chk-item on' : 'chk-item'} onClick={() => void toggleItem(item.id)}>
                          <span className="chk-box">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={20}>
                              <path d="m5 12 5 5 9-10" />
                            </svg>
                          </span>
                          <span>{protectNumberRanges(item.label)}</span>
                        </button>
                      )
                    })}
                  </section>
                ))}
              </div>

              <form className="np-card np-fade" onSubmit={(e) => void handleAddItem(e)}>
                <h2>Add item</h2>
                <div className="np-f2">
                  <div className="np-field">
                    <label htmlFor="chk-item-section">Section</label>
                    <input id="chk-item-section" placeholder="Optional" value={newItemSection} onChange={(e) => setNewItemSection(e.target.value)} />
                  </div>
                  <div className="np-field">
                    <label htmlFor="chk-item-label">New item</label>
                    <input id="chk-item-label" placeholder="Item text" value={newItemLabel} onChange={(e) => setNewItemLabel(e.target.value)} />
                  </div>
                </div>
                <button type="submit" className="np-btn sm" style={{ alignSelf: 'flex-start' }}>
                  Add item
                </button>
              </form>
            </>
          )}
        </div>

        <aside className="np-card chk-sidebar np-fade" style={{ animationDelay: '.1s', gap: 10 }}>
          <div className="np-head">
            <h2>Checklists</h2>
            <span className="np-small">{templates.length}</span>
          </div>
          <div className="np-search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <label className="np-sr" htmlFor="chk-template-search">
              Search checklists
            </label>
            <input id="chk-template-search" placeholder="Search checklists" value={templateSearch} onChange={(e) => setTemplateSearch(e.target.value)} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {visibleTemplates.map((t) => (
              <button key={t.id} type="button" className={t.id === selectedId ? 'chk-lst on' : 'chk-lst'} onClick={() => setSelectedId(t.id)}>
                {t.name}
              </button>
            ))}
          </div>
          {addTemplateForm}
          {selectedId && (
            <button type="button" className="np-btn ghost sm" style={{ color: '#B42318' }} onClick={() => void handleDeleteTemplate(selectedId)}>
              Delete checklist
            </button>
          )}
        </aside>
      </div>

      {error && <p className="form-error">{error}</p>}
    </div>
  )
}
