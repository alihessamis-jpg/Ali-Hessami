import { useEffect, useRef, useState } from 'react'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { getLastOfflineSync, prepareOffline, type OfflinePrepProgress, type OfflinePrepResult } from '../lib/offlinePrep'
import { describeError } from '../lib/describeError'
import { toShamsi } from '../lib/shamsi'
import { discardOp, retryFailed, syncOutbox, type OutboxEntry } from '../lib/offlineOutbox'
import { useOutbox } from './PendingSync'

function describeOp(op: OutboxEntry) {
  if (op.kind === 'noteWeight') return `Weight ${op.weight} kg from a progress note`
  const what = op.table === 'progress_notes' ? 'Progress note' : 'Lab result'
  const verb = op.kind === 'insert' ? 'added' : op.kind === 'update' ? 'edited' : 'deleted'
  const row = op.kind === 'delete' ? null : op.row
  const detail = row ? [row.test, row.date].filter((v) => typeof v === 'string').join(' · ') : ''
  return `${what} ${verb}${detail ? ` (${detail})` : ''}`
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatWhen(ms: number) {
  const d = new Date(ms)
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return `${toShamsi(d.toISOString().slice(0, 10))} · ${time}`
}

export function OfflineAccessCard() {
  const online = useOnlineStatus()
  const [progress, setProgress] = useState<OfflinePrepProgress | null>(null)
  const [last, setLast] = useState<OfflinePrepResult | null>(() => getLastOfflineSync())
  const [error, setError] = useState<string | null>(null)
  const [usage, setUsage] = useState<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const outbox = useOutbox()
  const failedOps = outbox.filter((o) => o.failed)
  const waitingCount = outbox.length - failedOps.length
  const running = progress !== null

  async function refreshUsage() {
    try {
      const est = await navigator.storage?.estimate?.()
      if (est?.usage != null) setUsage(est.usage)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void refreshUsage()
    return () => abortRef.current?.abort()
  }, [])

  async function start() {
    setError(null)
    const controller = new AbortController()
    abortRef.current = controller
    setProgress({ done: 0, total: 0, current: 'Starting…', files: 0 })
    try {
      const result = await prepareOffline(setProgress, controller.signal)
      if (!controller.signal.aborted) setLast(result)
    } catch (err) {
      setError(describeError(err, 'Download for offline failed'))
    } finally {
      abortRef.current = null
      setProgress(null)
      void refreshUsage()
    }
  }

  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <section className="np-card np-fade" style={{ animationDelay: '.38s' }}>
      <h2>Offline access</h2>
      <span className="np-small" style={{ lineHeight: 1.6 }}>
        Without internet, Nephron shows the copy saved on this device — patients, labs, notes, imaging, documents, Academy
        and Library. Anything you open while online is saved automatically; this button saves everything at once. Progress
        notes and lab results can also be added offline — they're kept on this device and sync automatically once you're
        back online. Other changes need a connection.
      </span>

      {running && progress ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="offline-sync-bar" aria-hidden="true">
            <i style={{ width: `${pct}%` }} />
          </div>
          <span className="np-small">
            {progress.total > 0 ? `${progress.done} / ${progress.total} pages` : 'Preparing…'} · {progress.files} files ·{' '}
            {progress.current}
          </span>
          <button type="button" className="np-btn" onClick={() => abortRef.current?.abort()}>
            Stop
          </button>
        </div>
      ) : (
        <button type="button" className="np-btn" onClick={() => void start()} disabled={!online}>
          {online ? 'Download everything for offline' : 'Connect to the internet to download'}
        </button>
      )}

      {error && <p className="form-error">{error}</p>}

      <span className="np-small" style={{ lineHeight: 1.6 }}>
        {waitingCount > 0
          ? `${waitingCount} change${waitingCount === 1 ? '' : 's'} made offline waiting to sync — sent automatically when you're online.`
          : 'All notes and lab results made offline have synced.'}
        {waitingCount > 0 && online && (
          <>
            {' '}
            <button type="button" className="link-button" onClick={() => void syncOutbox()}>
              Sync now
            </button>
          </>
        )}
      </span>

      {failedOps.length > 0 && (
        <>
          <span className="np-small" style={{ lineHeight: 1.6, color: 'var(--danger)' }}>
            The server rejected these offline changes. Retry, or discard ones you no longer need:
          </span>
          <ul className="outbox-list">
            {failedOps.map((op) => (
              <li key={op.seq}>
                <span>
                  <b>{describeOp(op)}</b>
                  <br />
                  {op.failed}
                </span>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    if (window.confirm('Discard this change? It will not be saved.')) void discardOp(op.seq as number)
                  }}
                >
                  Discard
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="np-btn" disabled={!online} onClick={() => void retryFailed()}>
            Retry sync
          </button>
        </>
      )}

      <span className="np-small" style={{ lineHeight: 1.6 }}>
        {last
          ? `Last full download: ${formatWhen(last.finishedAt)} — ${last.pages} pages, ${last.files} files${
              last.failedFiles ? ` (${last.failedFiles} files couldn't be saved)` : ''
            }.`
          : 'No full download yet.'}
        {usage != null ? ` Space used on this device: ${formatBytes(usage)}.` : ''}
      </span>
    </section>
  )
}
