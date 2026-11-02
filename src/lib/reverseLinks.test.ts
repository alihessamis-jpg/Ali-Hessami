import { describe, expect, it } from 'vitest'
import { buildAnchorQuestionIndex, sectionQuestionCount, sectionQuestionRefs } from './reverseLinks'
import type { BoardQuestion, LibraryCard } from '../types/domain'

function boardQuestion(partial: Partial<BoardQuestion> & { id: string }): BoardQuestion {
  return {
    topic: 'Test',
    question: 'q',
    type: 'mcq',
    options: ['a', 'b'],
    correctIndex: 0,
    createdAt: '2026-01-01',
    answerVerified: true,
    reviewStatus: 'approved',
    ...partial,
  }
}

function mcqCard(partial: Partial<LibraryCard> & { id: string }): LibraryCard {
  return {
    chapterId: 'ch1',
    kind: 'mcq',
    front: 'front',
    back: 'back',
    options: { choices: [{ label: 'الف', text: 'a', correct: true }], explanation: null },
    status: 'approved',
    due: '2026-01-01',
    stability: 0,
    difficulty: 0,
    reps: 0,
    lapses: 0,
    ...partial,
  } as LibraryCard
}

describe('buildAnchorQuestionIndex', () => {
  it('indexes a board_questions.explanation link', () => {
    const q = boardQuestion({ id: 'q1', explanation: 'see [[#ch76-s6-1-p1|BUN]] for the source' })
    const index = buildAnchorQuestionIndex([q], [])
    expect(index.get('ch76-s6-1-p1')).toEqual([{ kind: 'board', question: q }])
  })

  it('indexes a chip link ([[#id]] with no pipe text)', () => {
    const q = boardQuestion({ id: 'q1', explanation: 'see [[#ch72-table2]]' })
    const index = buildAnchorQuestionIndex([q], [])
    expect(index.get('ch72-table2')).toHaveLength(1)
  })

  it('indexes an imported mcq card by its own explanation', () => {
    const card = mcqCard({ id: 'c1', options: { choices: [{ label: 'الف', text: 'a', correct: true }], explanation: '[[#ch75-s4-2|منبع]]' } })
    const index = buildAnchorQuestionIndex([], [card])
    expect(index.get('ch75-s4-2')).toEqual([{ kind: 'card', card }])
  })

  it('ignores a non-mcq card and a question with no link', () => {
    const q = boardQuestion({ id: 'q1', explanation: 'no link here' })
    const card = mcqCard({ id: 'c1', kind: 'cloze', options: null })
    const index = buildAnchorQuestionIndex([q], [card])
    expect(index.size).toBe(0)
  })

  it('collects multiple refs under the same anchor, and dedupes repeated ids within one explanation', () => {
    const q1 = boardQuestion({ id: 'q1', explanation: 'a [[#ch1-s1-p1|x]] and again [[#ch1-s1-p1|y]]' })
    const q2 = boardQuestion({ id: 'q2', explanation: 'b [[#ch1-s1-p1]]' })
    const index = buildAnchorQuestionIndex([q1, q2], [])
    expect(index.get('ch1-s1-p1')).toEqual([
      { kind: 'board', question: q1 },
      { kind: 'board', question: q2 },
    ])
  })
})

describe('sectionQuestionCount / sectionQuestionRefs', () => {
  it('sums every anchor nested under a section id, not just the section id itself', () => {
    const q1 = boardQuestion({ id: 'q1', explanation: '[[#ch76-s6-1-p1|a]]' })
    const q2 = boardQuestion({ id: 'q2', explanation: '[[#ch76-s6-2|b]]' })
    const q3 = boardQuestion({ id: 'q3', explanation: '[[#ch76-s7-p1|c]]' })
    const index = buildAnchorQuestionIndex([q1, q2, q3], [])
    expect(sectionQuestionCount('ch76-s6', index)).toBe(2)
    expect(sectionQuestionRefs('ch76-s6', index)).toHaveLength(2)
    expect(sectionQuestionCount('ch76-s7', index)).toBe(1)
  })

  it('returns 0 for a section with no linked questions', () => {
    const index = buildAnchorQuestionIndex([], [])
    expect(sectionQuestionCount('ch1-s1', index)).toBe(0)
  })
})
