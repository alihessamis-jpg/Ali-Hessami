import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { addBoardQuestion, deleteBoardQuestion, listBoardQuestions } from '../../lib/api/boardQuestions'
import { addBoardQuestionAttempt, listBoardQuestionAttempts } from '../../lib/api/boardQuestionAttempts'
import { accuracyByTopic, dailyAccuracyTrend } from '../../lib/boardQuestionStats'
import { toShamsi } from '../../lib/shamsi'
import type { BoardQuestion, BoardQuestionAttempt } from '../../types/domain'

type Mode = 'practice' | 'progress' | 'manage'

const emptyDraft = { topic: '', question: '', options: ['', '', '', ''], correctIndex: 0, explanation: '' }

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function BoardQuestionsPanel() {
  const [mode, setMode] = useState<Mode>('practice')
  const [questions, setQuestions] = useState<BoardQuestion[]>([])
  const [attempts, setAttempts] = useState<BoardQuestionAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Practice state
  const [practiceTopic, setPracticeTopic] = useState('All')
  const [queue, setQueue] = useState<BoardQuestion[] | null>(null)
  const [queueIndex, setQueueIndex] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [sessionScore, setSessionScore] = useState({ correct: 0, total: 0 })

  // Manage state
  const [draft, setDraft] = useState(emptyDraft)
  const [manageTopicFilter, setManageTopicFilter] = useState('All')

  useEffect(() => {
    refresh()
  }, [])

  function refresh() {
    setLoading(true)
    Promise.all([listBoardQuestions(), listBoardQuestionAttempts()])
      .then(([q, a]) => {
        setQuestions(q)
        setAttempts(a)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load question bank'))
      .finally(() => setLoading(false))
  }

  const topics = useMemo(() => Array.from(new Set(questions.map((q) => q.topic))).sort(), [questions])

  function startPractice() {
    const pool = practiceTopic === 'All' ? questions : questions.filter((q) => q.topic === practiceTopic)
    setQueue(shuffle(pool))
    setQueueIndex(0)
    setSelectedIndex(null)
    setSubmitted(false)
    setSessionScore({ correct: 0, total: 0 })
  }

  async function handleSubmitAnswer() {
    if (!queue || selectedIndex == null) return
    const q = queue[queueIndex]
    const isCorrect = selectedIndex === q.correctIndex
    setSubmitted(true)
    setSessionScore((prev) => ({ correct: prev.correct + (isCorrect ? 1 : 0), total: prev.total + 1 }))
    try {
      const attempt = await addBoardQuestionAttempt({ questionId: q.id, selectedIndex, isCorrect })
      setAttempts((prev) => [...prev, attempt])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record attempt')
    }
  }

  function handleNext() {
    if (!queue) return
    setQueueIndex((i) => i + 1)
    setSelectedIndex(null)
    setSubmitted(false)
  }

  async function handleAddQuestion(e: FormEvent) {
    e.preventDefault()
    const options = draft.options.map((o) => o.trim()).filter(Boolean)
    if (!draft.topic.trim() || !draft.question.trim() || options.length < 2) return
    if (draft.correctIndex >= options.length) return
    try {
      const created = await addBoardQuestion({
        topic: draft.topic.trim(),
        question: draft.question.trim(),
        options,
        correctIndex: draft.correctIndex,
        explanation: draft.explanation || null,
      })
      setQuestions((prev) => [...prev, created])
      setDraft({ ...emptyDraft, topic: draft.topic })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add question')
    }
  }

  async function handleDeleteQuestion(id: string) {
    try {
      await deleteBoardQuestion(id)
      setQuestions((prev) => prev.filter((q) => q.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete question')
    }
  }

  const topicByQuestionId = useMemo(() => new Map(questions.map((q) => [q.id, q.topic])), [questions])
  const topicStats = useMemo(() => accuracyByTopic(attempts, topicByQuestionId), [attempts, topicByQuestionId])
  const trend = useMemo(() => dailyAccuracyTrend(attempts), [attempts])
  const overallAccuracy = attempts.length > 0 ? Math.round((attempts.filter((a) => a.isCorrect).length / attempts.length) * 100) : null

  const visibleQuestions = manageTopicFilter === 'All' ? questions : questions.filter((q) => q.topic === manageTopicFilter)

  if (loading) return <p>Loading…</p>

  return (
    <div>
      {error && <p className="form-error">{error}</p>}

      <div className="category-pills">
        <button type="button" className={`category-pill ${mode === 'practice' ? 'active' : ''}`} onClick={() => setMode('practice')}>
          Practice
        </button>
        <button type="button" className={`category-pill ${mode === 'progress' ? 'active' : ''}`} onClick={() => setMode('progress')}>
          Progress
        </button>
        <button type="button" className={`category-pill ${mode === 'manage' ? 'active' : ''}`} onClick={() => setMode('manage')}>
          Manage questions
        </button>
      </div>

      {mode === 'practice' && (
        <div className="dash-card">
          <div className="dash-card-header">
            <h2 className="dash-card-title">Practice</h2>
          </div>
          {questions.length === 0 ? (
            <p className="empty-state">No questions yet — add some under "Manage questions" first.</p>
          ) : !queue ? (
            <div className="form-actions">
              <select value={practiceTopic} onChange={(e) => setPracticeTopic(e.target.value)}>
                <option value="All">All topics ({questions.length})</option>
                {topics.map((t) => (
                  <option key={t} value={t}>
                    {t} ({questions.filter((q) => q.topic === t).length})
                  </option>
                ))}
              </select>
              <button type="button" onClick={startPractice}>
                Start
              </button>
            </div>
          ) : queueIndex >= queue.length ? (
            <div>
              <p>
                Session finished — {sessionScore.correct} / {sessionScore.total} correct (
                {sessionScore.total > 0 ? Math.round((sessionScore.correct / sessionScore.total) * 100) : 0}%)
              </p>
              <div className="form-actions">
                <button type="button" onClick={startPractice}>
                  Practice again
                </button>
                <button type="button" className="button-secondary" onClick={() => setQueue(null)}>
                  Change topic
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="patient-meta">
                {queue[queueIndex].topic} · Question {queueIndex + 1} / {queue.length} · Session score: {sessionScore.correct}/
                {sessionScore.total}
              </p>
              <p>
                <strong>{queue[queueIndex].question}</strong>
              </p>
              {queue[queueIndex].options.map((opt, i) => {
                const isCorrectOpt = i === queue[queueIndex].correctIndex
                const isSelected = i === selectedIndex
                const cls = ['quiz-option']
                if (isSelected && !submitted) cls.push('selected')
                if (submitted && isCorrectOpt) cls.push('correct')
                if (submitted && isSelected && !isCorrectOpt) cls.push('incorrect')
                return (
                  <button
                    key={i}
                    type="button"
                    className={cls.join(' ')}
                    disabled={submitted}
                    onClick={() => setSelectedIndex(i)}
                  >
                    {opt}
                  </button>
                )
              })}
              {!submitted ? (
                <div className="form-actions">
                  <button type="button" disabled={selectedIndex == null} onClick={() => void handleSubmitAnswer()}>
                    Submit answer
                  </button>
                </div>
              ) : (
                <div>
                  <p className={selectedIndex === queue[queueIndex].correctIndex ? 'value-correct' : 'value-abnormal'}>
                    {selectedIndex === queue[queueIndex].correctIndex ? 'Correct' : 'Incorrect'}
                  </p>
                  {queue[queueIndex].explanation && <p className="patient-meta">{queue[queueIndex].explanation}</p>}
                  <div className="form-actions">
                    <button type="button" onClick={handleNext}>
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {mode === 'progress' && (
        <div>
          <div className="calc-strip">
            <div>
              <span className="calc-label">Total attempts</span>
              <span className="calc-value">{attempts.length}</span>
            </div>
            <div>
              <span className="calc-label">Overall accuracy</span>
              <span className="calc-value">{overallAccuracy != null ? `${overallAccuracy}%` : '—'}</span>
            </div>
            <div>
              <span className="calc-label">Questions in bank</span>
              <span className="calc-value">{questions.length}</span>
            </div>
          </div>

          <div className="dash-card">
            <div className="dash-card-header">
              <h2 className="dash-card-title">Accuracy trend</h2>
            </div>
            {trend.length < 2 ? (
              <p className="empty-state">Practice on at least two different days to see a trend.</p>
            ) : (
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tickFormatter={(d: string) => toShamsi(d)} tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                    <Tooltip labelFormatter={(d: string) => toShamsi(d)} formatter={(value: number) => [`${value}%`, 'Accuracy']} />
                    <Line type="monotone" dataKey="accuracyPct" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="dash-card">
            <div className="dash-card-header">
              <h2 className="dash-card-title">Accuracy by topic</h2>
              <span className="patient-meta">Weakest first</span>
            </div>
            {topicStats.length === 0 ? (
              <p className="empty-state">No attempts recorded yet.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Topic</th>
                    <th>Attempts</th>
                    <th>Correct</th>
                    <th>Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {topicStats.map((t) => (
                    <tr key={t.topic} className={t.accuracyPct < 60 ? 'row-abnormal' : undefined}>
                      <td>{t.topic}</td>
                      <td>{t.attempts}</td>
                      <td>{t.correct}</td>
                      <td>{t.accuracyPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {mode === 'manage' && (
        <div className="dash-card">
          <div className="dash-card-header">
            <h2 className="dash-card-title">Add a question</h2>
          </div>
          <form className="soap-form" onSubmit={(e) => void handleAddQuestion(e)}>
            <div className="field-grid">
              <label>
                Topic
                <input
                  list="board-question-topics"
                  value={draft.topic}
                  onChange={(e) => setDraft({ ...draft, topic: e.target.value })}
                  placeholder="e.g. CKD-MBD"
                  required
                />
                <datalist id="board-question-topics">
                  {topics.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </label>
            </div>
            <label>
              Question
              <textarea value={draft.question} onChange={(e) => setDraft({ ...draft, question: e.target.value })} required />
            </label>
            <label>Options (mark the correct one)</label>
            {draft.options.map((opt, i) => (
              <div key={i} className="form-actions">
                <input type="radio" name="correct-option" checked={draft.correctIndex === i} onChange={() => setDraft({ ...draft, correctIndex: i })} />
                <input
                  value={opt}
                  onChange={(e) => {
                    const options = [...draft.options]
                    options[i] = e.target.value
                    setDraft({ ...draft, options })
                  }}
                  placeholder={`Option ${i + 1}`}
                  style={{ flex: 1 }}
                />
                {draft.options.length > 2 && (
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      const options = draft.options.filter((_, idx) => idx !== i)
                      const correctIndex = draft.correctIndex >= options.length ? 0 : draft.correctIndex
                      setDraft({ ...draft, options, correctIndex })
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <div className="form-actions">
              <button type="button" className="button-secondary" onClick={() => setDraft({ ...draft, options: [...draft.options, ''] })}>
                Add option
              </button>
            </div>
            <label>
              Explanation
              <textarea value={draft.explanation} onChange={(e) => setDraft({ ...draft, explanation: e.target.value })} placeholder="Shown after answering" />
            </label>
            <div className="form-actions">
              <button type="submit">Save question</button>
            </div>
          </form>

          <div className="dash-card-header" style={{ marginTop: 24 }}>
            <h2 className="dash-card-title">Question bank</h2>
          </div>
          {questions.length > 0 && (
            <div className="category-pills">
              <button type="button" className={`category-pill ${manageTopicFilter === 'All' ? 'active' : ''}`} onClick={() => setManageTopicFilter('All')}>
                All ({questions.length})
              </button>
              {topics.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`category-pill ${manageTopicFilter === t ? 'active' : ''}`}
                  onClick={() => setManageTopicFilter(t)}
                >
                  {t} ({questions.filter((q) => q.topic === t).length})
                </button>
              ))}
            </div>
          )}
          {visibleQuestions.length === 0 ? (
            <p className="empty-state">No questions yet.</p>
          ) : (
            <ul className="note-timeline">
              {visibleQuestions.map((q) => (
                <li key={q.id}>
                  <div className="note-header">
                    <strong>{q.question}</strong>
                    <button className="link-button" onClick={() => void handleDeleteQuestion(q.id)}>
                      Delete
                    </button>
                  </div>
                  <p className="patient-meta">
                    {q.topic} · Correct: {q.options[q.correctIndex]}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
