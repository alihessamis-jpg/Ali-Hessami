import { useEffect, useState } from 'react'
import { OUTBOX_EVENT, listOutbox, pendingIds, type OutboxEntry } from '../lib/offlineOutbox'

// Ids of notes/labs saved on this device that haven't reached Supabase yet.
export function usePendingIds(): Set<string> {
  const [ids, setIds] = useState<Set<string>>(() => new Set())
  useEffect(() => {
    let alive = true
    const load = () => void pendingIds().then((next) => alive && setIds(next))
    load()
    window.addEventListener(OUTBOX_EVENT, load)
    return () => {
      alive = false
      window.removeEventListener(OUTBOX_EVENT, load)
    }
  }, [])
  return ids
}

export function useOutbox(): OutboxEntry[] {
  const [ops, setOps] = useState<OutboxEntry[]>([])
  useEffect(() => {
    let alive = true
    const load = () => void listOutbox().then((next) => alive && setOps(next))
    load()
    window.addEventListener(OUTBOX_EVENT, load)
    return () => {
      alive = false
      window.removeEventListener(OUTBOX_EVENT, load)
    }
  }, [])
  return ops
}

export function PendingSyncChip() {
  return (
    <span className="sync-chip" title="Saved on this device — sends automatically when you're back online">
      ⟳ waiting to sync
    </span>
  )
}
