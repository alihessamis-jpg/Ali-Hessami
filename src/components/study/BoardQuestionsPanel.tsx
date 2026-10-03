import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { addBoardQuestion, deleteBoardQuestion, listBoardQuestions, updateBoardQuestion } from '../../lib/api/boardQuestions'
import { addBoardQuestionAttempt, listBoardQuestionAttempts } from '../../lib/api/boardQuestionAttempts'
import { addFlashcard } from '../../lib/api/flashcards'
import { addReadingItemFromQuestion } from '../../lib/api/readingItems'
import { accuracyByTopic, dailyAccuracyTrend } from '../../lib/boardQuestionStats'
import { toShamsi } from '../../lib/shamsi'
import { matchesSearch } from '../../lib/textFilter'
import { TopicPicker } from './TopicPicker'
import type { BoardQuestion, BoardQuestionAttempt } from '../../types/domain'

type Mode = 'practice' | 'progress' | 'manage'

const emptyDraft = {
  topic: '',
  question: '',
  type: 'mcq' as const,
  options: ['', '', '', ''],
  correctIndex: 0,
  explanation: '',
}

// Non-mcq attempts (matching is auto-graded as a whole, fill-in-the-blank is
// self-graded) have no single "selected option" — this sentinel fills the
// not-null selected_index column without implying a real choice.
const NO_SELECTED_INDEX = -1

function buildFlashcardFromQuestion(q: BoardQuestion): { front: string; back: string } {
  let back = ''
  if (q.type === 'mcq') {
    back = q.correctIndex != null ? q.options[q.correctIndex] ?? '' : ''
  } else if (q.type === 'fill_blank') {
    back = (q.fillAnswers ?? []).join(' / ')
  } else if (q.type === 'matching') {
    const rightByKey = new Map((q.matchRight ?? []).map((r) => [r.key, r.text]))
    const leftByKey = new Map((q.matchLeft ?? []).map((l) => [l.key, l.text]))
    back = (q.matchAnswer ?? [])
      .map((pair) => `${leftByKey.get(pair.left) ?? pair.left} → ${rightByKey.get(pair.right) ?? pair.right}`)
      .join('\n')
  }
  if (q.explanation) back = back ? `${back}\n\n${q.explanation}` : q.explanation
  return { front: q.question, back }
}

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
  const [matchSelections, setMatchSelections] = useState<Record<string, string>>({})
  const [fillRevealed, setFillRevealed] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [sessionScore, setSessionScore] = useState({ correct: 0, total: 0 })
  const [flashcardSavedFor, setFlashcardSavedFor] = useState<string | null>(null)
  const [reviewSavedFor, setReviewSavedFor] = useState<string | null>(null)

  // Manage state
  const [draft, setDraft] = useState(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [manageTopicFilter, setManageTopicFilter] = useState('All')
  const [manageSearch, setManageSearch] = useState('')

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
  const topicCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const q of questions) counts.set(q.topic, (counts.get(q.topic) ?? 0) + 1)
    return counts
  }, [questions])
  const countForTopic = (t: string) => topicCounts.get(t) ?? 0

  function startPractice() {
    const pool = practiceTopic === 'All' ? questions : questions.filter((q) => q.topic === practiceTopic)
    setQueue(shuffle(pool))
    setQueueIndex(0)
    setSelectedIndex(null)
    setMatchSelections({})
    setFillRevealed(false)
    setSubmitted(false)
    setSessionScore({ correct: 0, total: 0 })
    setFlashcardSavedFor(null)
    setReviewSavedFor(null)
  }

  async function recordAttempt(questionId: string, isCorrect: boolean, selectedIndex = NO_SELECTED_INDEX) {
    setSubmitted(true)
    setSessionScore((prev) => ({ correct: prev.correct + (isCorrect ? 1 : 0), total: prev.total + 1 }))
    try {
      const attempt = await addBoardQuestionAttempt({ questionId, selectedIndex, isCorrect })
      setAttempts((prev) => [...prev, attempt])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record attempt')
    }
  }

  async function handleSubmitMcqAnswer() {
    if (!queue || selectedIndex == null) return
    const q = queue[queueIndex]
    await recordAttempt(q.id, selectedIndex === q.correctIndex, selectedIndex)
  }

  async function handleSubmitMatchingAnswer() {
    if (!queue) return
    const q = queue[queueIndex]
    const pairs = q.matchAnswer ?? []
    const isCorrect = pairs.length > 0 && pairs.every((p) => matchSelections[p.left] === p.right)
    await recordAttempt(q.id, isCorrect)
  }

  async function handleSelfGradeFillBlank(gotItRight: boolean) {
    if (!queue) return
    const q = queue[queueIndex]
    await recordAttempt(q.id, gotItRight)
  }

  function handleNext() {
    if (!queue) return
    setQueueIndex((i) => i + 1)
    setSelectedIndex(null)
    setMatchSelections({})
    setFillRevealed(false)
    setSubmitted(false)
    setFlashcardSavedFor(null)
    setReviewSavedFor(null)
  }

  async function handleSaveAsFlashcard(q: BoardQuestion) {
    try {
      const { front, back } = buildFlashcardFromQuestion(q)
      await addFlashcard({ front, back, deck: q.topic })
      setFlashcardSavedFor(q.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save flashcard')
    }
  }

  async function handleSaveToReadingReview(q: BoardQuestion) {
    try {
      const { front, back } = buildFlashcardFromQuestion(q)
      await addReadingItemFromQuestion({ title: front, answer: back, origin: 'Board Questions' })
      setReviewSavedFor(q.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save to reading review')
    }
  }

  async function handleSaveQuestion(e: FormEvent) {
    e.preventDefault()
    const options = draft.options.map((o) => o.trim()).filter(Boolean)
    if (!draft.topic.trim() || !draft.question.trim() || options.length < 2) return
    if (draft.correctIndex >= options.length) return
    try {
      const payload = {
        topic: draft.topic.trim(),
        question: draft.question.trim(),
        type: 'mcq' as const,
        options,
        correctIndex: draft.correctIndex,
        explanation: draft.explanation || null,
      }
      if (editingId) {
        const updated = await updateBoardQuestion(editingId, payload)
        setQuestions((prev) => prev.map((q) => (q.id === editingId ? updated : q)))
        setDraft({ ...emptyDraft, topic: draft.topic })
        setEditingId(null)
      } else {
        const created = await addBoardQuestion(payload)
        setQuestions((prev) => [...prev, created])
        setDraft({ ...emptyDraft, topic: draft.topic })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save question')
    }
  }

  function handleEditQuestion(q: BoardQuestion) {
    if (q.type !== 'mcq') return
    setDraft({
      topic: q.topic,
      question: q.question,
      type: 'mcq',
      options: q.options.length >= 2 ? [...q.options] : [...q.options, ''],
      correctIndex: q.correctIndex ?? 0,
      explanation: q.explanation ?? '',
    })
    setEditingId(q.id)
  }

  function handleCancelEditQuestion() {
    setDraft({ ...emptyDraft, topic: draft.topic })
    setEditingId(null)
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

  const visibleQuestions = questions
    .filter((q) => manageTopicFilter === 'All' || q.topic === manageTopicFilter)
    .filter((q) => matchesSearch([q.topic, q.question, q.explanation, ...q.options], manageSearch))

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
              <TopicPicker
                topics={topics}
                value={practiceTopic}
                onChange={setPracticeTopic}
                countFor={countForTopic}
                totalCount={questions.length}
                allLabel="All topics"
              />
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

              {queue[queueIndex].type === 'mcq' && (
                <>
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
                  {!submitted && (
                    <div className="form-actions">
                      <button type="button" disabled={selectedIndex == null} onClick={() => void handleSubmitMcqAnswer()}>
                        Submit answer
                      </button>
                    </div>
                  )}
                  {submitted && (
                    <p className={selectedIndex === queue[queueIndex].correctIndex ? 'value-correct' : 'value-abnormal'}>
                      {selectedIndex === queue[queueIndex].correctIndex ? 'Correct' : 'Incorrect'}
                    </p>
                  )}
                </>
              )}

              {queue[queueIndex].type === 'matching' && (
                <>
                  {(queue[queueIndex].matchLeft ?? []).map((item) => {
                    const correctRight = (queue[queueIndex].matchAnswer ?? []).find((p) => p.left === item.key)?.right
                    const selectedRight = matchSelections[item.key]
                    const isRowCorrect = submitted && selectedRight === correctRight
                    return (
                      <div key={item.key} className="form-actions" style={{ alignItems: 'center' }}>
                        <span style={{ flex: 1 }}>{item.text}</span>
                        <select
                          value={selectedRight ?? ''}
                          disabled={submitted}
                          onChange={(e) => setMatchSelections((prev) => ({ ...prev, [item.key]: e.target.value }))}
                        >
                          <option value="" disabled>
                            Choose match…
                          </option>
                          {(queue[queueIndex].matchRight ?? []).map((r) => (
                            <option key={r.key} value={r.key}>
                              {r.text}
                            </option>
                          ))}
                        </select>
                        {submitted && <span className={isRowCorrect ? 'value-correct' : 'value-abnormal'}>{isRowCorrect ? '✓' : '✗'}</span>}
                      </div>
                    )
                  })}
                  {!submitted && (
                    <div className="form-actions">
                      <button
                        type="button"
                        disabled={(queue[queueIndex].matchLeft ?? []).some((item) => !matchSelections[item.key])}
                        onClick={() => void handleSubmitMatchingAnswer()}
                      >
                        Submit answer
                      </button>
                    </div>
                  )}
                </>
              )}

              {queue[queueIndex].type === 'fill_blank' && (
                <>
                  {!fillRevealed ? (
                    <div className="form-actions">
                      <button type="button" onClick={() => setFillRevealed(true)}>
                        Reveal answer
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="patient-meta">
                        Answer{(queue[queueIndex].fillAnswers?.length ?? 0) > 1 ? 's' : ''}:{' '}
                        <strong>{(queue[queueIndex].fillAnswers ?? []).join(' · ')}</strong>
                      </p>
                      {!submitted && (
                        <div className="form-actions">
                          <button type="button" onClick={() => void handleSelfGradeFillBlank(true)}>
                            I got it right
                          </button>
                          <button type="button" className="button-secondary" onClick={() => void handleSelfGradeFillBlank(false)}>
                            I got it wrong
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {submitted && (
                <div>
                  {queue[queueIndex].explanation && <p className="patient-meta">{queue[queueIndex].explanation}</p>}
                  <div className="form-actions">
                    <button
                      type="button"
                      className="button-secondary"
                      disabled={flashcardSavedFor === queue[queueIndex].id}
                      onClick={() => void handleSaveAsFlashcard(queue[queueIndex])}
                    >
                      {flashcardSavedFor === queue[queueIndex].id ? 'Saved to flashcards' : 'Save as flashcard'}
                    </button>
                    <button
                      type="button"
                      className="button-secondary"
                      disabled={reviewSavedFor === queue[queueIndex].id}
                      onClick={() => void handleSaveToReadingReview(queue[queueIndex])}
                    >
                      {reviewSavedFor === queue[queueIndex].id ? 'Saved to reading review' : 'Save to reading review'}
                    </button>
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
            <h2 className="dash-card-title">{editingId ? 'Edit question' : 'Add a question'}</h2>
          </div>
          <form className="soap-form" onSubmit={(e) => void handleSaveQuestion(e)}>
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
              <button type="submit">{editingId ? 'Save changes' : 'Save question'}</button>
              {editingId && (
                <button type="button" className="button-secondary" onClick={handleCancelEditQuestion}>
                  Cancel edit
                </button>
              )}
            </div>
          </form>

          <div className="dash-card-header" style={{ marginTop: 24 }}>
            <h2 className="dash-card-title">Question bank</h2>
          </div>
          <div className="form-actions" style={{ margin: '12px 0' }}>
            <input
              placeholder="Search questions…"
              value={manageSearch}
              onChange={(e) => setManageSearch(e.target.value)}
              style={{ width: '100%', maxWidth: 360 }}
            />
            {questions.length > 0 && (
              <TopicPicker
                topics={topics}
                value={manageTopicFilter}
                onChange={setManageTopicFilter}
                countFor={countForTopic}
                totalCount={questions.length}
                allLabel="All"
              />
            )}
          </div>
          {visibleQuestions.length === 0 ? (
            <p className="empty-state">No questions yet.</p>
          ) : (
            <ul className="note-timeline">
              {visibleQuestions.map((q) => (
                <li key={q.id}>
                  <div className="note-header">
                    <strong>{q.question}</strong>
                    {q.type === 'mcq' && (
                      <button className="link-button" onClick={() => handleEditQuestion(q)}>
                        Edit
                      </button>
                    )}
                    <button className="link-button" onClick={() => void handleDeleteQuestion(q.id)}>
                      Delete
                    </button>
                  </div>
                  <p className="patient-meta">
                    {q.topic} · {q.type}
                    {q.type === 'mcq' && q.correctIndex != null && ` · Correct: ${q.options[q.correctIndex]}`}
                    {q.type === 'fill_blank' && q.fillAnswers && ` · Answer: ${q.fillAnswers.join(' · ')}`}
                    {q.type === 'matching' && q.matchAnswer && ` · ${q.matchAnswer.length} pairs`}
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
