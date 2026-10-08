import type { ReactNode } from 'react'
import { KidneyIcon } from '../icons'

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="empty-state-illustration">
      <KidneyIcon />
      <p className="empty-state">{children}</p>
    </div>
  )
}
