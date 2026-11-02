// v1.6 (section 10.1): "↩ بازگشت به سؤال" needs to land back on the exact
// same Practice question, with score and position kept -- but tapping a
// source link navigates to a different route (the Reader), which unmounts
// BoardQuestionsPanel and drops its React state. Persisting a snapshot here
// before navigating away, and restoring it on the next BoardQuestionsPanel
// mount, survives that round trip. sessionStorage (not localStorage): a
// resume snapshot is only ever meant for this tab, this visit.

const KEY = 'nephron.practiceResume.v1'

export interface PracticeResumeSnapshot {
  chapterFilterId: string | null
  practiceTopic: string
  queueIds: string[]
  queueIndex: number
  sessionScore: { correct: number; total: number }
  selectedIndex: number | null
  submitted: boolean
}

export function savePracticeResume(snapshot: PracticeResumeSnapshot) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(snapshot))
  } catch {
    // best-effort -- a failed save just means the round trip starts fresh
  }
}

/** Reads and clears the snapshot (one-shot: only the next mount consumes it). */
export function takePracticeResume(): PracticeResumeSnapshot | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    sessionStorage.removeItem(KEY)
    return JSON.parse(raw) as PracticeResumeSnapshot
  } catch {
    return null
  }
}
