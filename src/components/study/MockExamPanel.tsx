import { useEffect, useMemo, useState } from 'react'
import { addBoardQuestionAttempt } from '../../lib/api/boardQuestionAttempts'
import type { BoardQuestion, BoardQuestionAttempt } from '../../types/domain'

// See the identical sentinel in BoardQuestionsPanel: fill_blank is
// self-graded (no single "selected option"), and here an mcq left
// unanswered when time runs out also has no selection to record.
const NO_SELECTED_INDEX = -1

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface MockAnswer {
  selectedIndex?: number
  matchSelections?: Record<string, string>
}

// mcq/matching are auto-gradable from the stored selection; fill_blank has
// no single right-answer match to check against, so it stays self-graded
// during the post-exam review (see fillGraded state below).
function autoGrade(q: BoardQuestion, answer: MockAnswer | undefined): boolean | null {
  if (q.type === 'mcq') return (answer?.selectedIndex ?? NO_SELECTED_INDEX) === q.correctIndex
  if (q.type === 'matching') {
    const pairs = q.matchAnswer ?? []
    return pairs.length > 0 && pairs.every((p) => answer?.matchSelections?.[p.left] === p.right)
  }
  return null
}

interface MockExamPanelProps {
  questions: BoardQuestion[]
  onRecordAttempt: (attempt: BoardQuestionAttempt) => void
}

export function MockExamPanel({ questions, onRecordAttempt }: MockExamPanelProps) {
  const [questionCount, setQuestionCount] = useState(40)
  const [timeLimitMin, setTimeLimitMin] = useState(60)
  const [queue, setQueue] = useState<BoardQuestion[] | null>(null)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, MockAnswer>>({})
  const [fillGraded, setFillGraded] = useState<Record<string, boolean>>({})
  const [deadline, setDeadline] = useState<number | null>(null)
  const [remainingSec, setRemainingSec] = useState(0)
  const [finished, setFinished] = useState(false)
  const [reviewIndex, setReviewIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!queue || finished || deadline == null) return
    const tick = () => setRemainingSec(Math.max(0, Math.round((deadline - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [queue, finished, deadline])

  useEffect(() => {
    if (queue && !finished && deadline != null && remainingSec <= 0) void finishExam()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSec])

  function startExam() {
    const pool = shuffle(questions).slice(0, Math.min(questionCount, questions.length))
    setQueue(pool)
    setIndex(0)
    setAnswers({})
    setFillGraded({})
    setFinished(false)
    setReviewIndex(0)
    setDeadline(Date.now() + timeLimitMin * 60 * 1000)
    setRemainingSec(timeLimitMin * 60)
    setError(null)
  }

  function selectMcq(qId: string, i: number) {
    setAnswers((prev) => ({ ...prev, [qId]: { ...prev[qId], selectedIndex: i } }))
  }

  function selectMatch(qId: string, leftKey: string, rightKey: string) {
    setAnswers((prev) => ({
      ...prev,
      [qId]: { ...prev[qId], matchSelections: { ...(prev[qId]?.matchSelections ?? {}), [leftKey]: rightKey } },
    }))
  }

  async function finishExam() {
    if (!queue) return
    setFinished(true)
    setReviewIndex(0)
    for (const q of queue) {
      if (q.type === 'fill_blank') continue // graded during review instead
      const isCorrect = autoGrade(q, answers[q.id]) ?? false
      const selectedIndex = q.type === 'mcq' ? answers[q.id]?.selectedIndex ?? NO_SELECTED_INDEX : NO_SELECTED_INDEX
      try {
        const attempt = await addBoardQuestionAttempt({ questionId: q.id, selectedIndex, isCorrect })
        onRecordAttempt(attempt)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to record attempt')
      }
    }
  }

  async function gradeFillBlank(q: BoardQuestion, gotItRight: boolean) {
    setFillGraded((prev) => ({ ...prev, [q.id]: gotItRight }))
    try {
      const attempt = await addBoardQuestionAttempt({ questionId: q.id, selectedIndex: NO_SELECTED_INDEX, isCorrect: gotItRight })
      onRecordAttempt(attempt)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record attempt')
    }
  }

  const summary = useMemo(() => {
    if (!queue) return null
    let correct = 0
    let graded = 0
    const byTopic = new Map<string, { correct: number; total: number }>()
    for (const q of queue) {
      const entry = byTopic.get(q.topic) ?? { correct: 0, total: 0 }
      const isCorrect = q.type === 'fill_blank' ? fillGraded[q.id] ?? null : autoGrade(q, answers[q.id])
      entry.total += 1
      if (isCorrect != null) {
        graded += 1
        if (isCorrect) {
          correct += 1
          entry.correct += 1
        }
      }
      byTopic.set(q.topic, entry)
    }
    return {
      correct,
      graded,
      byTopic: Array.from(byTopic.entries())
        .map(([topic, v]) => ({ topic, ...v }))
        .sort((a, b) => a.correct / a.total - b.correct / b.total),
    }
  }, [queue, answers, fillGraded])

  if (questions.length < 5) {
    return <p className="empty-state">Add at least 5 questions under "Manage questions" to run a mock exam.</p>
  }

  if (!queue) {
    return (
      <div className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title">Mock exam</h2>
        </div>
        <p className="patient-meta">
          Pulls questions from the whole bank regardless of topic, times you like a real exam, and holds feedback
          until you finish — then shows a score report by topic.
        </p>
        <div className="field-grid">
          <label>
            Number of questions
            <input
              type="number"
              min={5}
              max={questions.length}
              value={questionCount}
              onChange={(e) => {
                const n = Math.max(5, Math.min(questions.length, Number(e.target.value) || 5))
                setQuestionCount(n)
                setTimeLimitMin(Math.round(n * 1.5))
              }}
            />
          </label>
          <label>
            Time limit (minutes)
            <input
              type="number"
              min={1}
              value={timeLimitMin}
              onChange={(e) => setTimeLimitMin(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
        </div>
        <div className="form-actions">
          <button type="button" onClick={startExam}>
            Start mock exam
          </button>
        </div>
      </div>
    )
  }

  if (finished && summary) {
    const pct = summary.graded > 0 ? Math.round((summary.correct / summary.graded) * 100) : 0
    const ungradedFill = queue.filter((q) => q.type === 'fill_blank' && !(q.id in fillGraded)).length
    const reviewQ = queue[reviewIndex]
    const reviewAnswer = answers[reviewQ.id]
    return (
      <div className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title">Mock exam results</h2>
        </div>
        {error && <p className="form-error">{error}</p>}
        <p>
          {summary.correct} / {summary.graded} graded correct ({pct}%)
          {ungradedFill > 0 &&
            ` · ${ungradedFill} fill-in-the-blank question${ungradedFill === 1 ? '' : 's'} need self-grading below`}
        </p>
        <table className="data-table">
          <thead>
            <tr>
              <th>Topic</th>
              <th>Correct</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {summary.byTopic.map((t) => (
              <tr key={t.topic} className={t.correct / t.total < 0.6 ? 'row-abnormal' : undefined}>
                <td>{t.topic}</td>
                <td>{t.correct}</td>
                <td>{t.total}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="dash-card-header" style={{ marginTop: 24 }}>
          <h2 className="dash-card-title">
            Review · Question {reviewIndex + 1} / {queue.length}
          </h2>
        </div>
        <p className="patient-meta">{reviewQ.topic}</p>
        <p>
          <strong>{reviewQ.question}</strong>
        </p>

        {reviewQ.type === 'mcq' &&
          reviewQ.options.map((opt, i) => {
            const isCorrectOpt = i === reviewQ.correctIndex
            const isSelected = i === reviewAnswer?.selectedIndex
            const cls = ['quiz-option']
            if (isCorrectOpt) cls.push('correct')
            if (isSelected && !isCorrectOpt) cls.push('incorrect')
            return (
              <button key={i} type="button" className={cls.join(' ')} disabled>
                {opt}
                {isSelected ? ' (your answer)' : ''}
              </button>
            )
          })}

        {reviewQ.type === 'matching' &&
          (reviewQ.matchLeft ?? []).map((item) => {
            const correctRight = (reviewQ.matchAnswer ?? []).find((p) => p.left === item.key)?.right
            const correctText = (reviewQ.matchRight ?? []).find((r) => r.key === correctRight)?.text
            const selectedRight = reviewAnswer?.matchSelections?.[item.key]
            const selectedText = (reviewQ.matchRight ?? []).find((r) => r.key === selectedRight)?.text
            const isRowCorrect = selectedRight === correctRight
            return (
              <p key={item.key} className={isRowCorrect ? 'value-correct' : 'value-abnormal'}>
                {item.text} → {selectedText ?? '(no answer)'}
                {!isRowCorrect && ` (correct: ${correctText})`}
              </p>
            )
          })}

        {reviewQ.type === 'fill_blank' && (
          <>
            <p className="patient-meta">
              Answer{(reviewQ.fillAnswers?.length ?? 0) > 1 ? 's' : ''}:{' '}
              <strong>{(reviewQ.fillAnswers ?? []).join(' · ')}</strong>
            </p>
            {!(reviewQ.id in fillGraded) && (
              <div className="form-actions">
                <button type="button" onClick={() => void gradeFillBlank(reviewQ, true)}>
                  I got it right
                </button>
                <button type="button" className="button-secondary" onClick={() => void gradeFillBlank(reviewQ, false)}>
                  I got it wrong
                </button>
              </div>
            )}
          </>
        )}

        {reviewQ.explanation && <p className="patient-meta">{reviewQ.explanation}</p>}

        <div className="form-actions">
          <button type="button" className="button-secondary" disabled={reviewIndex === 0} onClick={() => setReviewIndex((i) => i - 1)}>
            Previous
          </button>
          <button
            type="button"
            className="button-secondary"
            disabled={reviewIndex >= queue.length - 1}
            onClick={() => setReviewIndex((i) => i + 1)}
          >
            Next
          </button>
          <button type="button" onClick={() => setQueue(null)}>
            New mock exam
          </button>
        </div>
      </div>
    )
  }

  const q = queue[index]
  const answer = answers[q.id]
  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <h2 className="dash-card-title">Mock exam</h2>
        <span className={remainingSec < 60 ? 'value-abnormal' : undefined} style={{ fontWeight: 700 }}>
          {formatClock(remainingSec)}
        </span>
      </div>
      <p className="patient-meta">
        Question {index + 1} / {queue.length} · {q.topic}
      </p>
      <p>
        <strong>{q.question}</strong>
      </p>

      {q.type === 'mcq' &&
        q.options.map((opt, i) => (
          <button
            key={i}
            type="button"
            className={`quiz-option ${answer?.selectedIndex === i ? 'selected' : ''}`}
            onClick={() => selectMcq(q.id, i)}
          >
            {opt}
          </button>
        ))}

      {q.type === 'matching' &&
        (q.matchLeft ?? []).map((item) => (
          <div key={item.key} className="form-actions" style={{ alignItems: 'center' }}>
            <span style={{ flex: 1 }}>{item.text}</span>
            <select value={answer?.matchSelections?.[item.key] ?? ''} onChange={(e) => selectMatch(q.id, item.key, e.target.value)}>
              <option value="" disabled>
                Choose match…
              </option>
              {(q.matchRight ?? []).map((r) => (
                <option key={r.key} value={r.key}>
                  {r.text}
                </option>
              ))}
            </select>
          </div>
        ))}

      {q.type === 'fill_blank' && (
        <p className="patient-meta">Answer it in your head, then self-grade during the review after you finish.</p>
      )}

      <div className="form-actions">
        <button type="button" className="button-secondary" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
          Previous
        </button>
        <button type="button" className="button-secondary" disabled={index >= queue.length - 1} onClick={() => setIndex((i) => i + 1)}>
          Next
        </button>
        <button type="button" onClick={() => void finishExam()}>
          Submit exam
        </button>
      </div>
    </div>
  )
}
