import { useOnlineStatus } from '../hooks/useOnlineStatus'

export function OfflineIndicator() {
  const online = useOnlineStatus()
  if (online) return null
  return (
    <span
      className="offline-pill"
      title="No connection — showing the copy saved on this device. Changes can't be saved until you're back online."
    >
      ● Offline · read-only
    </span>
  )
}
