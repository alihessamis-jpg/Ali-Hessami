import { useEffect, useState } from 'react'

// Images and PDFs normally open in a new browser tab straight from Supabase
// Storage, which can't work offline (a new tab isn't served by this app's
// offline cache). While offline, links to stored files are intercepted and
// the saved copy is shown here instead, with a Save/Share button so a PDF can
// still be handed to another app (e.g. PDF Expert) from the iPad.

interface ViewerState {
  url: string
  type: string
  name: string
}

function isStorageLink(href: string) {
  return href.includes('/storage/v1/object/')
}

function fileNameFrom(href: string) {
  try {
    const path = new URL(href).pathname
    return decodeURIComponent(path.split('/').pop() || 'file')
  } catch {
    return 'file'
  }
}

export function OfflineFileViewer() {
  const [viewer, setViewer] = useState<ViewerState | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    async function onClick(e: MouseEvent) {
      if (navigator.onLine) return
      if (e.defaultPrevented || e.button !== 0) return
      const anchor = (e.target as Element | null)?.closest?.('a')
      if (!anchor || !anchor.href || !isStorageLink(anchor.href)) return
      e.preventDefault()
      try {
        const res = await fetch(anchor.href)
        if (!res.ok) throw new Error(String(res.status))
        const blob = await res.blob()
        setViewer({ url: URL.createObjectURL(blob), type: blob.type || res.headers.get('content-type') || '', name: fileNameFrom(anchor.href) })
      } catch {
        setMessage("This file isn't saved on this device yet. Open it once while online, or use Settings → Download everything for offline.")
      }
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(null), 5000)
    return () => clearTimeout(t)
  }, [message])

  function close() {
    if (viewer) URL.revokeObjectURL(viewer.url)
    setViewer(null)
  }

  return (
    <>
      {message && (
        <div className="offline-toast" role="status" onClick={() => setMessage(null)}>
          {message}
        </div>
      )}
      {viewer && (
        <div className="offline-viewer" role="dialog" aria-modal="true" aria-label={viewer.name}>
          <div className="offline-viewer-bar">
            <span className="offline-viewer-name">{viewer.name}</span>
            <a className="np-btn" href={viewer.url} download={viewer.name}>
              Save / Share
            </a>
            <button type="button" className="np-btn" onClick={close}>
              Close
            </button>
          </div>
          <div className="offline-viewer-body">
            {viewer.type.startsWith('image/') ? (
              <img src={viewer.url} alt={viewer.name} />
            ) : viewer.type.startsWith('audio/') ? (
              <audio src={viewer.url} controls />
            ) : viewer.type.startsWith('video/') ? (
              <video src={viewer.url} controls />
            ) : (
              <iframe src={viewer.url} title={viewer.name} />
            )}
          </div>
        </div>
      )}
    </>
  )
}
