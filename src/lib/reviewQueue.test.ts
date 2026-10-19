import { describe, expect, it } from 'vitest'
import { estimateReviewMinutes, shuffle } from './reviewQueue'

describe('shuffle', () => {
  it('returns every input item exactly once, without mutating the input', () => {
    const input = [1, 2, 3, 4, 5]
    const copy = [...input]
    const result = shuffle(input)
    expect(input).toEqual(copy)
    expect(result).toHaveLength(input.length)
    expect([...result].sort()).toEqual([...input].sort())
  })
})

describe('estimateReviewMinutes', () => {
  it('is zero when nothing is due or new', () => {
    expect(estimateReviewMinutes(0, 0)).toBe(0)
  })

  it('rounds up to at least one minute when there is anything to review', () => {
    expect(estimateReviewMinutes(1, 0)).toBeGreaterThanOrEqual(1)
  })

  it('grows with both due and new counts', () => {
    const small = estimateReviewMinutes(2, 2)
    const large = estimateReviewMinutes(20, 20)
    expect(large).toBeGreaterThan(small)
  })
})
