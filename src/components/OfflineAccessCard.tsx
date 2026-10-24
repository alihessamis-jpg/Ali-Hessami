import { useEffect, useRef, useState } from 'react'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { getLastOfflineSync, prepareOffline, type OfflinePrepProgress, type OfflinePrepResult } from '../lib/offlinePrep'
import { describeError } from '../lib/describeError'
import { toShamsi } from '../lib/shamsi'

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
        and Library. Anything you open while online is saved automatically; this button saves everything at once. Offline
        is read-only: changes can only be saved once you're back online.
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
