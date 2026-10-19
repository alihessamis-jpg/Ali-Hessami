import { useRef, useState } from 'react'
import {
  parseBulkImportCsv,
  parseBulkImportJson,
  validateBulkImportItems,
  type BulkCardImportItem,
} from '../../lib/libraryBulkImport'
import { importBulkCards } from '../../lib/api/library'
import { describeError } from '../../lib/describeError'

interface Props {
  open: boolean
  onClose: () => void
}

const KIND_LABEL: Record<string, string> = {
  basic: 'Card',
  cloze: 'Cloze',
  table_cell: 'Table',
  mcq: 'Board MCQ',
  patient_case: 'Patient case',
  clinical_scenario: 'Scenario',
}

// Paste-in bulk import for cards/questions/scenarios generated elsewhere:
// a JSON array (or { cards: [...] }) of items with kind/chapter_number/
// front/back and kind-specific fields (choices for mcq, stats for
// patient_case, steps for clinical_scenario), or a flat CSV for the
// simple kinds (basic/cloze/table_cell). Every item lands as a
// "suggested" card -- same as any other import -- so it still goes
// through Approve before it joins the FSRS schedule.
export function BulkCardImportPanel({ open, onClose }: Props) {
  const [fileName, setFileName] = useState('')
  const [items, setItems] = useState<BulkCardImportItem[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<Array<{ index: number; message: string }>>([])
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [result, setResult] = useState<{ created: number; errors: Array<{ index: number; message: string }> } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  function reset() {
    setFileName('')
    setItems([])
    setParseError(null)
    setValidationErrors([])
    setImportError(null)
    setResult(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleFile(picked: File) {
    setFileName(picked.name)
    setParseError(null)
    setResult(null)
    try {
      const text = await picked.text()
      const parsed = picked.name.toLowerCase().endsWith('.csv') ? parseBulkImportCsv(text) : parseBulkImportJson(text)
      setItems(parsed)
      setValidationErrors(validateBulkImportItems(parsed))
    } catch (err) {
      setItems([])
      setParseError(describeError(err, 'Could not read this file'))
    }
  }

  async function handleImport() {
    if (items.length === 0) return
    setImporting(true)
    setImportError(null)
    try {
      const { created, errors } = await importBulkCards(items)
      setResult({ created: created.length, errors })
    } catch (err) {
      setImportError(describeError(err, 'Import failed'))
    } finally {
      setImporting(false)
    }
  }

  const hardErrors = validationErrors.length > 0
  const kindCounts = items.reduce<Record<string, number>>((acc, it) => {
    acc[it.kind] = (acc[it.kind] ?? 0) + 1
    return acc
  }, {})

  return (
    <>
      <div className="pc-sheet-bg" onClick={handleClose} />
      <div className="pc-sheet" role="dialog" aria-label="Bulk import cards">
        <div style={{ width: 40, height: 5, borderRadius: 3, background: '#D5DEEB', alignSelf: 'center' }} />
        <div className="np-head">
          <h2 style={{ fontSize: 17 }}>Bulk import</h2>
          <button type="button" className="np-btn ghost sm" style={{ width: 44, padding: 0 }} aria-label="Close" onClick={handleClose}>
            ✕
          </button>
        </div>

        {result ? (
          <>
            <p className="np-small" style={{ color: '#17663A' }}>
              {result.created} card{result.created === 1 ? '' : 's'} imported as suggested — approve them from each chapter.
            </p>
            {result.errors.length > 0 && (
              <div className="form-error">
                <b>{result.errors.length} skipped:</b>
                <ul style={{ margin: '4px 0 0', paddingInlineStart: 18 }}>
                  {result.errors.map((e, i) => (
                    <li key={i}>
                      Item {e.index + 1}: {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button type="button" className="np-btn sm" onClick={handleClose}>
              Done
            </button>
          </>
        ) : (
          <>
            <p className="np-small">
              A JSON array (or <code>{'{ "cards": [...] }'}</code>) of items with <code>kind</code>, <code>chapter_number</code>,{' '}
              <code>front</code>/<code>back</code>, plus <code>choices</code> for mcq, <code>stats</code> for patient_case, or{' '}
              <code>steps</code> for clinical_scenario. CSV works for basic/cloze/table_cell only.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept="application/json,.json,.csv,text/csv"
              style={{ display: 'none' }}
              onChange={(e) => {
                const picked = e.target.files?.[0]
                e.target.value = ''
                if (picked) void handleFile(picked)
              }}
            />
            <button type="button" className="np-btn ghost sm" onClick={() => inputRef.current?.click()}>
              {fileName || 'Choose a .json or .csv file'}
            </button>
            {parseError && <p className="form-error">{parseError}</p>}

            {items.length > 0 && (
              <>
                <p className="np-small">
                  {items.length} items ·{' '}
                  {Object.entries(kindCounts)
                    .map(([k, n]) => `${n} ${KIND_LABEL[k] ?? k}`)
                    .join(' · ')}
                </p>

                {hardErrors && (
                  <div className="form-error">
                    <b>Fix before importing:</b>
                    <ul style={{ margin: '4px 0 0', paddingInlineStart: 18 }}>
                      {validationErrors.map((e, i) => (
                        <li key={i}>
                          Item {e.index + 1}: {e.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {importError && <p className="form-error">{importError}</p>}
                <button type="button" className="np-btn sm" disabled={hardErrors || importing} onClick={() => void handleImport()}>
                  {importing ? 'Importing…' : `Import ${items.length} items`}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </>
  )
}
