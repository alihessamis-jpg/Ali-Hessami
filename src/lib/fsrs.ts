// A compact FSRS-style scheduler (stability/difficulty state machine, power
// forgetting curve, default-weight parameters in the spirit of FSRS v4).
// It is self-consistent — every formula below derives from the same
// retrievability curve — but is a from-scratch implementation, not a port
// of the reference algorithm, so treat interval predictions as "FSRS-style"
// rather than byte-identical to Anki/ts-fsrs output.
import type { FsrsCardState, FsrsRating, FsrsStateValue } from '../types/domain'

export const FSRS_STATE = { NEW: 0, LEARNING: 1, REVIEW: 2, RELEARNING: 3 } as const satisfies Record<string, FsrsStateValue>

export function emptyFsrsState(now = new Date()): FsrsCardState {
  return {
    due: now.toISOString(),
    stability: null,
    difficulty: null,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    state: FSRS_STATE.NEW,
    lastReview: null,
    reviewHistory: [],
  }
}

// w0-3: initial stability for Again/Hard/Good/Easy. w4-5: initial difficulty.
// w6-7: difficulty update + mean-reversion target weight. w8-10: stability
// growth on a successful review. w11-14: stability after a lapse. w15-16:
// Hard penalty / Easy bonus multipliers on the success-growth formula.
const W = [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61]

const REQUEST_RETENTION = 0.9
const RATING_INDEX: Record<FsrsRating, number> = { again: 1, hard: 2, good: 3, easy: 4 }

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x))
}

// Power forgetting curve: R(t,S) = (1 + t/(9S))^-1 — retrievability after
// `elapsedDays` given stability `stability` (both in days).
function retrievability(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0
  return Math.pow(1 + elapsedDays / (9 * stability), -1)
}

// Inverse of retrievability(): the elapsed-day interval at which R first
// drops to `targetRetention`, i.e. the next review date for a given stability.
function intervalForStability(stability: number, targetRetention = REQUEST_RETENTION): number {
  return Math.max(1, 9 * stability * (1 / targetRetention - 1))
}

function initDifficulty(g: number): number {
  return clamp(W[4] - (g - 3) * W[5], 1, 10)
}

function initStability(g: number): number {
  return W[g - 1]
}

function nextDifficulty(d: number, g: number): number {
  const updated = d - W[6] * (g - 3)
  const reverted = W[7] * initDifficulty(4) + (1 - W[7]) * updated
  return clamp(reverted, 1, 10)
}

function nextStabilityOnSuccess(d: number, s: number, r: number, g: number): number {
  const bonus = g === 2 ? W[15] : g === 4 ? W[16] : 1
  const growth = 1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp((1 - r) * W[10]) - 1) * bonus
  return s * growth
}

function nextStabilityOnLapse(d: number, s: number, r: number): number {
  return W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp((1 - r) * W[14])
}

// Again always drops into a short same-session relearning step rather than
// the full day-granularity formula — consistent with how the Reader/Review
// mockups show "Again: <1 min".
const AGAIN_RELEARN_MINUTES = 10

export interface FsrsScheduleResult {
  next: FsrsCardState
  intervalDays: number
}

export function scheduleFsrs(state: FsrsCardState, rating: FsrsRating, now = new Date()): FsrsScheduleResult {
  const g = RATING_INDEX[rating]
  const lastReview = state.lastReview ? new Date(state.lastReview) : null
  const elapsedDays = lastReview ? Math.max(0, (now.getTime() - lastReview.getTime()) / 86_400_000) : 0

  let difficulty: number
  let stability: number

  if (state.state === FSRS_STATE.NEW || state.difficulty == null || state.stability == null) {
    difficulty = initDifficulty(g)
    stability = initStability(g)
  } else {
    const r = retrievability(elapsedDays, state.stability)
    difficulty = nextDifficulty(state.difficulty, g)
    stability = g === 1 ? nextStabilityOnLapse(difficulty, state.stability, r) : nextStabilityOnSuccess(difficulty, state.stability, r, g)
  }
  stability = Math.max(0.1, stability)

  let nextState: FsrsStateValue
  let scheduledDays: number
  let due: Date

  if (g === 1) {
    nextState = state.state === FSRS_STATE.NEW ? FSRS_STATE.LEARNING : FSRS_STATE.RELEARNING
    scheduledDays = 0
    due = new Date(now.getTime() + AGAIN_RELEARN_MINUTES * 60_000)
  } else {
    nextState = FSRS_STATE.REVIEW
    scheduledDays = intervalForStability(stability)
    due = new Date(now.getTime() + scheduledDays * 86_400_000)
  }

  const next: FsrsCardState = {
    due: due.toISOString(),
    stability,
    difficulty,
    elapsedDays,
    scheduledDays,
    reps: state.reps + 1,
    lapses: g === 1 ? state.lapses + 1 : state.lapses,
    state: nextState,
    lastReview: now.toISOString(),
    reviewHistory: [...state.reviewHistory, { date: now.toISOString(), rating }],
  }

  return { next, intervalDays: scheduledDays }
}

export function formatFsrsInterval(days: number): string {
  if (days < 1) return '<1 min'
  if (days < 2) return '1 d'
  if (days < 30) return `${Math.round(days)} d`
  if (days < 365) return `${Math.round((days / 30) * 10) / 10} mo`
  return `${Math.round((days / 365) * 10) / 10} y`
}

export type FsrsPreviewMap = Record<FsrsRating, { intervalDays: number; label: string }>

// Computes the interval preview for all four grades without committing,
// for the Review page's grade-button subtitles ("2 d", "14 d", ...).
export function fsrsPreviewAll(state: FsrsCardState, now = new Date()): FsrsPreviewMap {
  const ratings: FsrsRating[] = ['again', 'hard', 'good', 'easy']
  const entries = ratings.map((rating) => {
    const { intervalDays } = scheduleFsrs(state, rating, now)
    return [rating, { intervalDays, label: formatFsrsInterval(intervalDays) }] as const
  })
  return Object.fromEntries(entries) as FsrsPreviewMap
}

// A card counts as "mastered" once its scheduled interval has reached 21
// days — matches the Library's chapter-status legend.
export const MASTERED_INTERVAL_DAYS = 21

export function isCardMastered(state: FsrsCardState): boolean {
  return state.scheduledDays >= MASTERED_INTERVAL_DAYS
}
