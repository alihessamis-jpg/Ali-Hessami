import { useMemo, useState } from 'react'
import type { AcademyCard } from '../../types/domain'

interface Props {
  cards: AcademyCard[]
  onFinish: (results: Array<{ card: AcademyCard; correct: boolean }>) => void
  onCancel: () => void
}

const MIN_QUESTIONS = 3
const MAX_QUESTIONS = 5

function sample<T>(items: T[], n: number): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, n)
}

export function SectionQuickCheck({ cards, onFinish, onCancel }: Props) {
  const quiz = useMemo(() => sample(cards, Math.min(MAX_QUESTIONS, cards.length)), [cards])
  const [index, setIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [results, setResults] = useState<Array<{ card: AcademyCard; correct: boolean }>>([])

  if (quiz.length === 0) {
    return (
      <div className="dash-card">
        <p className="empty-state">
          No cards yet for the topics linked to this section — make some cards on those topics first, or mark this
          section read without a quiz.
        </p>
        <div className="form-actions">
          <button onClick={() => onFinish([])}>Mark read without a quiz</button>
          <button className="link-button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  const current = quiz[index]

  function grade(correct: boolean) {
    const next = [...results, { card: current, correct }]
    if (index + 1 >= quiz.length) {
      onFinish(next)
      return
    }
    setResults(next)
    setIndex((i) => i + 1)
    setShowAnswer(false)
  }

  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <h2 className="dash-card-title">Quick check</h2>
        <span className="patient-meta">
          {index + 1} / {quiz.length}
          {quiz.length < MIN_QUESTIONS ? ' (fewer than 3 cards available)' : ''}
        </span>
      </div>
      <p className="td-q" dir="rtl" style={{ marginBottom: 12 }}>
        {current.prompt}
      </p>
      {showAnswer ? (
        <>
          <p className="patient-meta" dir="rtl">
            {current.answer}
          </p>
          <div className="form-actions" style={{ marginTop: 10 }}>
            <button onClick={() => grade(true)}>Got it right</button>
            <button onClick={() => grade(false)}>Got it wrong</button>
          </div>
        </>
      ) : (
        <button onClick={() => setShowAnswer(true)}>Show answer</button>
      )}
      <div className="form-actions" style={{ marginTop: 14 }}>
        <button className="link-button" onClick={onCancel}>
          Cancel quiz
        </button>
      </div>
    </div>
  )
}
