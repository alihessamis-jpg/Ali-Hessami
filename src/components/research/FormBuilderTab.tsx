import { useEffect, useState, type FormEvent } from 'react'
import { addResearchField, deleteResearchField, listResearchFields } from '../../lib/api/research'
import type { ResearchField, ResearchFieldType } from '../../types/domain'

const FIELD_TYPES: ResearchFieldType[] = [
  'Text',
  'Number',
  'Date',
  'Checkbox',
  'Radio',
  'Dropdown',
  'Multiple Choice',
  'Laboratory',
  'Calculated Field',
  'Image Upload',
  'File Upload',
]

const CHOICE_TYPES: ResearchFieldType[] = ['Radio', 'Dropdown', 'Multiple Choice']

interface Props {
  projectId: string
}

export function FormBuilderTab({ projectId }: Props) {
  const [fields, setFields] = useState<ResearchField[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [type, setType] = useState<ResearchFieldType>('Text')
  const [required, setRequired] = useState(false)
  const [options, setOptions] = useState('')
  const [formula, setFormula] = useState('')

  useEffect(() => {
    listResearchFields(projectId)
      .then(setFields)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load fields'))
      .finally(() => setLoading(false))
  }, [projectId])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!label.trim()) return
    try {
      const field = await addResearchField({
        projectId,
        label: label.trim(),
        type,
        required,
        options: CHOICE_TYPES.includes(type) ? options.split(',').map((o) => o.trim()).filter(Boolean) : null,
        formula: type === 'Calculated Field' ? formula || null : null,
        orderIndex: fields.length,
      })
      setFields((prev) => [...prev, field])
      setLabel('')
      setOptions('')
      setFormula('')
      setRequired(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add field')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteResearchField(id)
      setFields((prev) => prev.filter((f) => f.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  return (
    <div>
      <form className="lab-form" onSubmit={(e) => void handleAdd(e)}>
        <input placeholder="Field label" value={label} onChange={(e) => setLabel(e.target.value)} required />
        <select value={type} onChange={(e) => setType(e.target.value as ResearchFieldType)}>
          {FIELD_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {CHOICE_TYPES.includes(type) && (
          <input placeholder="Options, comma separated" value={options} onChange={(e) => setOptions(e.target.value)} />
        )}
        {type === 'Calculated Field' && (
          <input placeholder="Formula" value={formula} onChange={(e) => setFormula(e.target.value)} />
        )}
        <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
          Required
        </label>
        <button type="submit">Add field</button>
      </form>

      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : fields.length === 0 ? (
        <p className="empty-state">No fields defined yet.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Type</th>
              <th>Required</th>
              <th>Options / formula</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f) => (
              <tr key={f.id}>
                <td>{f.label}</td>
                <td>{f.type}</td>
                <td>{f.required ? 'Yes' : 'No'}</td>
                <td>{f.options?.join(', ') ?? f.formula ?? ''}</td>
                <td>
                  <button className="link-button" onClick={() => void handleDelete(f.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
