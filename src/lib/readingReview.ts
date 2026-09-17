import type { ReadingItem, ReviewCheckpointKey } from '../types/domain'

export interface ReviewCheckpoint {
  key: ReviewCheckpointKey
  label: string
  days: number
}

// Fixed spaced-review schedule: 3 days, 1 week, 14 days, 1 month, 3 months
// after reading something, independent of the adaptive SRS used for
// Academy topics and flashcards.
export const REVIEW_CHECKPOINTS: ReviewCheckpoint[] = [
  { key: 'review3dDone', label: '3 days', days: 3 },
  { key: 'review7dDone', label: '1 week', days: 7 },
  { key: 'review14dDone', label: '14 days', days: 14 },
  { key: 'review30dDone', label: '1 month', days: 30 },
  { key: 'review90dDone', label: '3 months', days: 90 },
]

function addDaysToDateStr(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function checkpointDueDate(item: ReadingItem, checkpoint: ReviewCheckpoint): string {
  return addDaysToDateStr(item.dateRead, checkpoint.days)
}

export interface DueCheckpoint {
  item: ReadingItem
  checkpoint: ReviewCheckpoint
  dueDate: string
}

export function listDueCheckpoints(items: ReadingItem[], today: string): DueCheckpoint[] {
  const due: DueCheckpoint[] = []
  for (const item of items) {
    for (const checkpoint of REVIEW_CHECKPOINTS) {
      if (item[checkpoint.key]) continue
      const dueDate = checkpointDueDate(item, checkpoint)
      if (dueDate <= today) due.push({ item, checkpoint, dueDate })
    }
  }
  return due.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}
