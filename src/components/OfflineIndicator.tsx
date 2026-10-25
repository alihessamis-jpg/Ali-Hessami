import { Link } from 'react-router-dom'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useOutbox } from './PendingSync'

export function OfflineIndicator() {
  const online = useOnlineStatus()
  const ops = useOutbox()
  const failed = ops.filter((o) => o.failed).length
  const waiting = ops.length - failed

  if (failed > 0) {
    return (
      <Link to="/settings" className="offline-pill offline-pill--error" title="Some offline changes were rejected — open Settings to review">
        ⚠ {failed} not synced
      </Link>
    )
  }
  if (!online) {
    return (
      <span
        className="offline-pill"
        title="No connection — showing the copy saved on this device. Notes and lab results you add are saved here and sync automatically."
      >
        ● Offline{waiting > 0 ? ` · ${waiting} to sync` : ''}
      </span>
    )
  }
  if (waiting > 0) {
    return (
      <span className="offline-pill" title="Sending changes made offline">
        ⟳ Syncing {waiting}…
      </span>
    )
  }
  return null
}
