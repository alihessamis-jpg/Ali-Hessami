import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { FREE_TIER_STORAGE_LIMIT_BYTES, getStorageUsageBytes } from '../lib/storage'

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function StorageUsageIndicator() {
  const { session } = useAuth()
  const [usedBytes, setUsedBytes] = useState<number | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!session) return
    let cancelled = false
    getStorageUsageBytes(session.user.id)
      .then((bytes) => {
        if (!cancelled) setUsedBytes(bytes)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [session])

  if (!session || error || usedBytes === null) return null

  const percent = Math.min(100, (usedBytes / FREE_TIER_STORAGE_LIMIT_BYTES) * 100)

  return (
    <div className="storage-usage" title="Supabase storage used (free tier limit: 1 GB)">
      <span className="storage-usage-label">
        {formatBytes(usedBytes)} / 1 GB
      </span>
      <div className="storage-usage-bar">
        <div
          className="storage-usage-bar-fill"
          style={{ width: `${percent}%` }}
          data-warn={percent >= 80 ? 'true' : undefined}
        />
      </div>
    </div>
  )
}
