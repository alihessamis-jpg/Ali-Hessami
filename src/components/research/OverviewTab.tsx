import { useState, type FormEvent } from 'react'
import { updateResearchProject } from '../../lib/api/research'
import type { ResearchProject } from '../../types/domain'

const FIELDS: Array<{ key: keyof ResearchProject; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'researchQuestion', label: 'Research question' },
  { key: 'objectives', label: 'Objectives' },
  { key: 'studyDesign', label: 'Study design' },
  { key: 'inclusion', label: 'Inclusion criteria' },
  { key: 'exclusion', label: 'Exclusion criteria' },
  { key: 'literature', label: 'Literature' },
  { key: 'progress', label: 'Progress' },
  { key: 'notes', label: 'Notes' },
]

interface Props {
  project: ResearchProject
  onUpdated: (project: ResearchProject) => void
}

export function OverviewTab({ project, onUpdated }: Props) {
  const [form, setForm] = useState(project)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const updated = await updateResearchProject(project.id, form)
      onUpdated(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="soap-form" onSubmit={(e) => void handleSave(e)}>
      {FIELDS.map(({ key, label }) => (
        <label key={key}>
          {label}
          <textarea
            value={(form[key] as string) ?? ''}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          />
        </label>
      ))}
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button type="submit" disabled={saving}>
          Save
        </button>
      </div>
    </form>
  )
}
