import { useRef, useState } from 'react'
import {
  buildImportDrafts,
  parseQuestionImportFile,
  validateQuestionImportFile,
  type QuestionImportError,
  type QuestionImportFile,
} from '../../lib/boardQuestionImport'
import { importBoardQuestions, listBoardQuestionsForChapter } from '../../lib/api/boardQuestions'
import { describeError } from '../../lib/describeError'
import type { BoardQuestion, LibraryChapter } from '../../types/domain'

interface Props {
  open: boolean
  chapters: LibraryChapter[]
  onClose: () => void
  onImported: (questions: BoardQuestion[]) => void
}

const TYPE_LABEL: Record<string, string> = {
  mcq: 'MCQ',
  true_false: 'True/False',
  essay: 'Essay',
}

// Repeatable "Import questions" flow (see docs/question-import-schema.md):
// pick a JSON file matching the schema, confirm the chapter, preview with
// validation, then import. Re-importing the same file is safe -- each
// question's "chapterId:sourceFile:number" import key makes the save an
// upsert instead of a duplicate (see importBoardQuestions).
export function QuestionImportPanel({ open, chapters, onClose, onImported }: Props) {
  const [file, setFile] = useState<QuestionImportFile | null>(null)
  const [fileName, setFileName] = useState('')
  const [chapterId, setChapterId] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<QuestionImportError[]>([])
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [done, setDone] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  function reset() {
    setFile(null)
    setFileName('')
    setChapterId('')
    setParseError(null)
    setValidationErrors([])
    setImportError(null)
    setDone(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleFile(picked: File) {
    setFileName(picked.name)
    setParseError(null)
    setDone(null)
    try {
      const text = await picked.text()
      const parsed = parseQuestionImportFile(JSON.parse(text))
      setFile(parsed)
      setValidationErrors(validateQuestionImportFile(parsed))
      const match = chapters.find((c) => c.chapterNumber === parsed.chapter_number)
      setChapterId(match?.id ?? '')
    } catch (err) {
      setFile(null)
      setParseError(describeError(err, 'Could not read this file'))
    }
  }

  async function handleImport() {
    if (!file || !chapterId) return
    setImporting(true)
    setImportError(null)
    try {
      const drafts = buildImportDrafts(file, chapterId)
      await importBoardQuestions(drafts)
      const imported = await listBoardQuestionsForChapter(chapterId)
      onImported(imported)
      setDone(drafts.length)
    } catch (err) {
      setImportError(describeError(err, 'Import failed'))
    } finally {
      setImporting(false)
    }
  }

  const hardErrors = validationErrors.length > 0
  const selectedChapter = chapters.find((c) => c.id === chapterId)

  return (
    <>
      <div className="pc-sheet-bg" onClick={handleClose} />
      <div className="pc-sheet" role="dialog" aria-label="Import questions">
        <div style={{ width: 40, height: 5, borderRadius: 3, background: '#D5DEEB', alignSelf: 'center' }} />
        <div className="np-head">
          <h2 style={{ fontSize: 17 }}>Import questions</h2>
          <button type="button" className="np-btn ghost sm" style={{ width: 44, padding: 0 }} aria-label="Close" onClick={handleClose}>
            ✕
          </button>
        </div>

        {done != null ? (
          <>
            <p className="np-small" style={{ color: '#17663A' }}>
              {done} question{done === 1 ? '' : 's'} imported into {selectedChapter?.title ?? 'the chapter'}.
            </p>
            <button type="button" className="np-btn sm" onClick={handleClose}>
              Done
            </button>
          </>
        ) : (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const picked = e.target.files?.[0]
                e.target.value = ''
                if (picked) void handleFile(picked)
              }}
            />
            <button type="button" className="np-btn ghost sm" onClick={() => inputRef.current?.click()}>
              {fileName || 'Choose a .json file'}
            </button>
            {parseError && <p className="form-error">{parseError}</p>}

            {file && (
              <>
                <label>
                  Chapter
                  <select value={chapterId} onChange={(e) => setChapterId(e.target.value)}>
                    <option value="">Pick a chapter…</option>
                    {chapters.map((c) => (
                      <option key={c.id} value={c.id}>
                        Ch {c.chapterNumber} — {c.title}
                      </option>
                    ))}
                  </select>
                </label>

                <p className="np-small">
                  {file.chapter_title_fa || file.chapter_title} · {file.questions.length} questions
                  {file.source ? ` · ${file.source}` : ''}
                  {file.source_file ? ` · ${file.source_file}` : ''}
                </p>

                {hardErrors && (
                  <div className="form-error">
                    <b>Fix before importing:</b>
                    <ul style={{ margin: '4px 0 0', paddingInlineStart: 18 }}>
                      {validationErrors.map((e, i) => (
                        <li key={i}>
                          {e.number != null ? `Q${e.number}: ` : ''}
                          {e.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {file.questions.map((q) => (
                    <div key={q.number} className="np-card" style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                        <b className="np-small">Q{q.number}</b>
                        <span className="np-small" style={{ color: '#5B6B82' }}>
                          {TYPE_LABEL[q.type] ?? q.type}
                        </span>
                        {q.answer_verified === false && (
                          <span className="np-small" style={{ color: '#93590B', background: '#FDF0D5', padding: '1px 7px', borderRadius: 999 }}>
                            answer not verified
                          </span>
                        )}
                      </div>
                      <p className="np-small fa" dir="rtl" style={{ margin: 0, whiteSpace: 'pre-line' }}>
                        {q.stem.length > 160 ? `${q.stem.slice(0, 160)}…` : q.stem}
                      </p>
                    </div>
                  ))}
                </div>

                {importError && <p className="form-error">{importError}</p>}
                <button type="button" className="np-btn sm" disabled={!chapterId || hardErrors || importing} onClick={() => void handleImport()}>
                  {importing ? 'Importing…' : `Import ${file.questions.length} questions`}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </>
  )
}
