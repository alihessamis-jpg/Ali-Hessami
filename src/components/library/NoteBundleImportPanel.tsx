// v1.6 (NEPHRON_CHAPTER_FORMAT.md section 10.2): "Import bundle (zip)" --
// imports a manifest.json-driven set of chapter notes at once, next to the
// existing single-chapter "Import note" (on each chapter's own Reader
// page) and the other per-item importers on this page. Select the
// notes+manifest zip together with any figures-only zip(s): their images
// are pooled before any note is imported, so the bundle doesn't have to be
// repackaged into one file first.
import { useRef, useState } from 'react'
import { importNoteBundle, type BundleImportProgress, type BundleImportReport } from '../../lib/bundleImport'
import { describeError } from '../../lib/describeError'

interface Props {
  open: boolean
  onClose: () => void
}

export function NoteBundleImportPanel({ open, onClose }: Props) {
  const [fileNames, setFileNames] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [report, setReport] = useState<BundleImportReport | null>(null)
  const [progress, setProgress] = useState<BundleImportProgress | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pickedFiles = useRef<File[]>([])

  if (!open) return null

  function reset() {
    setFileNames([])
    setImportError(null)
    setReport(null)
    setProgress(null)
    pickedFiles.current = []
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handlePick(picked: File[]) {
    pickedFiles.current = picked
    setFileNames(picked.map((f) => f.name))
    setReport(null)
    setImportError(null)
  }

  async function handleImport() {
    if (pickedFiles.current.length === 0) return
    setImporting(true)
    setImportError(null)
    setProgress({ done: 0, total: 0, currentFile: '', phase: 'loading' })
    try {
      const result = await importNoteBundle(pickedFiles.current, setProgress)
      setReport(result)
    } catch (err) {
      setImportError(describeError(err, 'Bundle import failed'))
    } finally {
      setImporting(false)
      setProgress(null)
    }
  }

  return (
    <>
      <div className="pc-sheet-bg" onClick={handleClose} />
      <div className="pc-sheet" role="dialog" aria-label="Import note bundle">
        <div style={{ width: 40, height: 5, borderRadius: 3, background: '#D5DEEB', alignSelf: 'center' }} />
        <div className="np-head">
          <h2 style={{ fontSize: 17 }}>Import bundle (zip)</h2>
          <button type="button" className="np-btn ghost sm" style={{ width: 44, padding: 0 }} aria-label="Close" onClick={handleClose}>
            ✕
          </button>
        </div>

        {report ? (
          <>
            <p className="np-small" style={{ color: '#17663A' }}>
              {report.totalNotes} note{report.totalNotes === 1 ? '' : 's'} · {report.totalCards} cards · {report.totalAnchors} anchors ·{' '}
              {report.totalLinks} links · {report.totalUnresolved} unresolved
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Ch.</th>
                    <th>Sections</th>
                    <th>Cards</th>
                    <th>Anchors</th>
                    <th>Links</th>
                    <th>Unresolved</th>
                    <th>Missing figures</th>
                    <th>Auto-linked</th>
                  </tr>
                </thead>
                <tbody>
                  {report.files.map((f, i) => (
                    <tr key={i} className={f.error || f.unresolvedLinks.length > 0 ? 'row-abnormal' : undefined}>
                      <td>{f.file.split('/').pop()}</td>
                      <td>
                        {f.chapterNumber ?? '—'}
                        {f.chapterPart ? `.${f.chapterPart}` : ''}
                      </td>
                      <td>{f.sections}</td>
                      <td>{f.cards}</td>
                      <td>{f.anchors}</td>
                      <td>{f.links}</td>
                      <td>{f.unresolvedLinks.length > 0 ? f.unresolvedLinks.join(', ') : '0'}</td>
                      <td>{f.missingFigures.length > 0 ? f.missingFigures.join(', ') : '—'}</td>
                      <td>{f.autolinked}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {report.files.some((f) => f.error) && (
              <div className="form-error">
                <b>Failed:</b>
                <ul style={{ margin: '4px 0 0', paddingInlineStart: 18 }}>
                  {report.files
                    .filter((f) => f.error)
                    .map((f, i) => (
                      <li key={i}>
                        {f.file}: {f.error}
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
              Select the notes+<code>manifest.json</code> zip, together with any figures-only zip(s) -- their images are pooled before any
              note is imported. Each note replaces its chapter's (or part's) note and rebuilds its cards in place, matched by stable id, so
              re-importing never duplicates. A figure the bundle doesn't have is reported, not treated as an error.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".zip"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => {
                // Convert to a plain array (and so to real File references)
                // before clearing the input's value -- some mobile browsers
                // (notably iOS/iPadOS Safari with a multi-file document
                // picker) invalidate the live FileList as soon as the value
                // is reset, so reading it lazily inside handlePick picked up
                // an empty list.
                const files = e.target.files ? Array.from(e.target.files) : []
                e.target.value = ''
                if (files.length > 0) handlePick(files)
              }}
            />
            <button type="button" className="np-btn ghost sm" onClick={() => inputRef.current?.click()}>
              {fileNames.length > 0 ? fileNames.join(', ') : 'Choose one or more .zip files'}
            </button>
            {importError && <p className="form-error">{importError}</p>}
            {importing && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <p className="np-small">
                  {progress?.phase === 'loading' || !progress || progress.total === 0
                    ? 'Unpacking zip(s)…'
                    : `${progress.done} / ${progress.total} notes imported${progress.currentFile ? ` — working on ${progress.currentFile}` : ''}`}
                </p>
                <div style={{ height: 6, borderRadius: 3, background: '#EEF2F8', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: progress && progress.total > 0 ? `${Math.round((progress.done / progress.total) * 100)}%` : '8%',
                      height: '100%',
                      background: 'var(--accent)',
                      transition: 'width .2s',
                    }}
                  />
                </div>
                <p className="np-small">
                  This can take several minutes for a large bundle (note text + figure uploads, one at a time). Keep this tab open and in
                  the foreground until it finishes.
                </p>
              </div>
            )}
            <button type="button" className="np-btn sm" disabled={fileNames.length === 0 || importing} onClick={() => void handleImport()}>
              {importing ? 'Importing…' : `Import ${fileNames.length || ''} bundle${fileNames.length === 1 ? '' : 's'}`}
            </button>
          </>
        )}
      </div>
    </>
  )
}
