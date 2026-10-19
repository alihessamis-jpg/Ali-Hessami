import { describe, expect, it } from 'vitest'
import {
  currentRetrievability,
  emptyFsrsState,
  formatFsrsInterval,
  fsrsPreviewAll,
  isCardMastered,
  scheduleFsrs,
  MASTERED_INTERVAL_DAYS,
} from './fsrs'
import type { FsrsCardState } from '../types/domain'

const NOW = new Date('2026-01-01T00:00:00.000Z')

describe('scheduleFsrs', () => {
  it('starts a new card in learning with a short interval on Again', () => {
    const state = emptyFsrsState(NOW)
    const { next, intervalDays } = scheduleFsrs(state, 'again', NOW)
    expect(next.state).toBe(1) // LEARNING
    expect(intervalDays).toBe(0)
    expect(next.reps).toBe(1)
    // Again always counts as a lapse, even a card's very first rating.
    expect(next.lapses).toBe(1)
    expect(new Date(next.due).getTime()).toBeGreaterThan(NOW.getTime())
  })

  it('graduates a new card to review on Good with a positive interval', () => {
    const state = emptyFsrsState(NOW)
    const { next, intervalDays } = scheduleFsrs(state, 'good', NOW)
    expect(next.state).toBe(2) // REVIEW
    expect(intervalDays).toBeGreaterThan(0)
    expect(next.stability).not.toBeNull()
    expect(next.difficulty).not.toBeNull()
  })

  it('schedules a longer interval for Easy than for Good from the same state', () => {
    const state = emptyFsrsState(NOW)
    const good = scheduleFsrs(state, 'good', NOW)
    const easy = scheduleFsrs(state, 'easy', NOW)
    expect(easy.intervalDays).toBeGreaterThan(good.intervalDays)
  })

  it('schedules a shorter interval for Hard than for Good from the same state', () => {
    const state = emptyFsrsState(NOW)
    const good = scheduleFsrs(state, 'good', NOW)
    const hard = scheduleFsrs(state, 'hard', NOW)
    expect(hard.intervalDays).toBeLessThanOrEqual(good.intervalDays)
  })

  it('increments lapses and drops to relearning on Again from a review card', () => {
    const state = emptyFsrsState(NOW)
    const afterGood = scheduleFsrs(state, 'good', NOW).next
    const later = new Date(NOW.getTime() + 10 * 86_400_000)
    const { next } = scheduleFsrs(afterGood, 'again', later)
    expect(next.state).toBe(3) // RELEARNING
    expect(next.lapses).toBe(1)
  })

  it('grows stability across repeated Good reviews', () => {
    let state: FsrsCardState = emptyFsrsState(NOW)
    let cursor = NOW
    const stabilities: number[] = []
    for (let i = 0; i < 4; i++) {
      const { next } = scheduleFsrs(state, 'good', cursor)
      state = next
      stabilities.push(state.stability ?? 0)
      cursor = new Date(cursor.getTime() + Math.max(1, state.scheduledDays) * 86_400_000)
    }
    for (let i = 1; i < stabilities.length; i++) {
      expect(stabilities[i]).toBeGreaterThanOrEqual(stabilities[i - 1])
    }
  })

  it('schedules a shorter interval for a higher target retention', () => {
    const state = emptyFsrsState(NOW)
    const afterGood = scheduleFsrs(state, 'good', NOW, 0.9).next
    const later = new Date(NOW.getTime() + 5 * 86_400_000)
    const low = scheduleFsrs(afterGood, 'good', later, 0.85).intervalDays
    const high = scheduleFsrs(afterGood, 'good', later, 0.95).intervalDays
    expect(high).toBeLessThan(low)
  })

  it('appends to review history without losing prior entries', () => {
    const state = emptyFsrsState(NOW)
    const first = scheduleFsrs(state, 'good', NOW).next
    const second = scheduleFsrs(first, 'hard', new Date(NOW.getTime() + 86_400_000)).next
    expect(second.reviewHistory).toHaveLength(2)
    expect(second.reviewHistory[0].rating).toBe('good')
    expect(second.reviewHistory[1].rating).toBe('hard')
  })
})

describe('fsrsPreviewAll', () => {
  it('previews all four ratings without mutating the input state', () => {
    const state = emptyFsrsState(NOW)
    const before = JSON.stringify(state)
    const preview = fsrsPreviewAll(state, NOW)
    expect(JSON.stringify(state)).toBe(before)
    expect(preview.again.intervalDays).toBeLessThanOrEqual(preview.good.intervalDays)
    expect(preview.good.intervalDays).toBeLessThanOrEqual(preview.easy.intervalDays)
  })
})

describe('formatFsrsInterval', () => {
  it('formats sub-day intervals as minutes', () => {
    expect(formatFsrsInterval(0)).toBe('<1 min')
  })
  it('formats day-scale intervals', () => {
    expect(formatFsrsInterval(5)).toBe('5 d')
  })
  it('formats month-scale intervals', () => {
    expect(formatFsrsInterval(60)).toBe('2 mo')
  })
  it('formats year-scale intervals', () => {
    expect(formatFsrsInterval(400)).toBe('1.1 y')
  })
})

describe('isCardMastered', () => {
  it('is false below the mastered interval threshold', () => {
    const state = emptyFsrsState(NOW)
    expect(isCardMastered({ ...state, scheduledDays: MASTERED_INTERVAL_DAYS - 1 })).toBe(false)
  })
  it('is true at or above the mastered interval threshold', () => {
    const state = emptyFsrsState(NOW)
    expect(isCardMastered({ ...state, scheduledDays: MASTERED_INTERVAL_DAYS })).toBe(true)
  })
})

describe('currentRetrievability', () => {
  it('is null for a never-reviewed card', () => {
    const state = emptyFsrsState(NOW)
    expect(currentRetrievability(state, NOW)).toBeNull()
  })

  it('is close to 1 right after a review and decays as time passes', () => {
    const { next } = scheduleFsrs(emptyFsrsState(NOW), 'good', NOW)
    const justAfter = currentRetrievability(next, NOW)
    const muchLater = currentRetrievability(next, new Date(NOW.getTime() + 365 * 86_400_000))
    expect(justAfter).not.toBeNull()
    expect(muchLater).not.toBeNull()
    expect(justAfter as number).toBeGreaterThan(0.9)
    expect(muchLater as number).toBeLessThan(justAfter as number)
  })
})
