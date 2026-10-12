import { useOnlineStatus } from '../hooks/useOnlineStatus'

export function OfflineIndicator() {
  const online = useOnlineStatus()
  if (online) return null
  return (
    <span className="offline-pill" title="No connection — showing cached Academy content where available">
      ● Offline
    </span>
  )
}
