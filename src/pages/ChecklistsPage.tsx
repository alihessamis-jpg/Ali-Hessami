import { useEffect, useState, type FormEvent } from 'react'
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
import { ChecklistIcon } from '../components/icons'
import { protectNumberRanges } from '../lib/bidiText'
import type { ChecklistItem, ChecklistTemplate } from '../types/domain'

export function ChecklistsPage() {
  const { session } = useAuth()
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [completions, setCompletions] = useState<Record<string, boolean>>({})
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newItemLabel, setNewItemLabel] = useState('')
  const [newItemSection, setNewItemSection] = useState('')
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div>
      <h1 className="page-title">
        <span className="page-title-icon">
          <ChecklistIcon />
        </span>
        Checklists
      </h1>
      <p className="empty-state">
        Completion state is per-clinician, not tied to a specific patient — same as the original app.
      </p>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 220 }}>
          <form className="inline-form" onSubmit={(e) => void handleAddTemplate(e)}>
            <input
              placeholder="New checklist name"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
            />
            <button type="submit">Add</button>
          </form>
          <ul className="patient-list">
            {templates.map((t) => (
              <li key={t.id}>
                <button
                  className={t.id === selectedId ? 'tab active' : 'tab'}
                  style={{ width: '100%', textAlign: 'left', display: 'block' }}
                  onClick={() => setSelectedId(t.id)}
                >
                  {t.name}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div style={{ flex: 1, minWidth: 280 }}>
          {selectedId ? (
            <>
              <div className="page-header">
                <h2 style={{ margin: 0 }}>
                  {templates.find((t) => t.id === selectedId)?.name} ({checkedCount}/{items.length})
                </h2>
                <button className="link-button" onClick={() => void handleDeleteTemplate(selectedId)}>
                  Delete checklist
                </button>
              </div>
              <ul className="patient-list">
                {items.map((item, i) => {
                  const showHeader = item.section && item.section !== items[i - 1]?.section
                  return (
                    <li key={item.id}>
                      {showHeader && (
                        <div
                          className="dash-card-title"
                          dir="rtl"
                          style={{ marginTop: i === 0 ? 0 : 16, marginBottom: 4 }}
                        >
                          {protectNumberRanges(item.section ?? '')}
                        </div>
                      )}
                      <label style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <input
                          type="checkbox"
                          checked={completions[item.id] ?? false}
                          onChange={() => void toggleItem(item.id)}
                        />
                        <span dir="rtl">{protectNumberRanges(item.label)}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
              <form className="inline-form" onSubmit={(e) => void handleAddItem(e)}>
                <input
                  placeholder="Section (optional)"
                  value={newItemSection}
                  onChange={(e) => setNewItemSection(e.target.value)}
                />
                <input
                  placeholder="New item"
                  value={newItemLabel}
                  onChange={(e) => setNewItemLabel(e.target.value)}
                />
                <button type="submit">Add item</button>
              </form>
            </>
          ) : (
            <p className="empty-state">Create a checklist to get started.</p>
          )}
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}
    </div>
  )
}
