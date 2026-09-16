import { useEffect, useState, type FormEvent } from 'react'
import { addFlashcard, deleteFlashcard, listFlashcards, updateFlashcardSrs } from '../../lib/api/flashcards'
import { scheduleReview } from '../../lib/srs'
import { toShamsi } from '../../lib/shamsi'
import type { Flashcard } from '../../types/domain'

export function FlashcardsPanel() {
  const [cards, setCards] = useState<Flashcard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [deck, setDeck] = useState('')
  const [reviewIndex, setReviewIndex] = useState(0)
  const [showBack, setShowBack] = useState(false)

  useEffect(() => {
    listFlashcards()
      .then(setCards)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load flashcards'))
      .finally(() => setLoading(false))
  }, [])

  const today = new Date().toISOString().slice(0, 10)
  const dueCards = cards.filter((c) => !c.nextReview || c.nextReview <= today)
  const current = dueCards[reviewIndex % Math.max(dueCards.length, 1)]

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!front.trim() || !back.trim()) return
    try {
      const card = await addFlashcard({ front: front.trim(), back: back.trim(), deck: deck || null })
      setCards((prev) => [...prev, card])
      setFront('')
      setBack('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add card')
    }
  }

  async function handleRate(rating: 'easy' | 'moderate' | 'difficult') {
    if (!current) return
    const next = scheduleReview(current, rating)
    try {
      const updated = await updateFlashcardSrs(current.id, next)
      setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      setShowBack(false)
      setReviewIndex((i) => i + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save review')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteFlashcard(id)
      setCards((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  return (
    <div>
      <form className="lab-form" onSubmit={(e) => void handleAdd(e)}>
        <input placeholder="Front" value={front} onChange={(e) => setFront(e.target.value)} />
        <input placeholder="Back" value={back} onChange={(e) => setBack(e.target.value)} />
        <input placeholder="Deck" value={deck} onChange={(e) => setDeck(e.target.value)} />
        <button type="submit">Add card</button>
      </form>

      {error && <p className="form-error">{error}</p>}

      <h2>Review ({dueCards.length} due)</h2>
      {current ? (
        <div className="auth-card" style={{ margin: '0 0 24px', maxWidth: 480 }}>
          <p style={{ fontSize: '1.1rem' }}>{current.front}</p>
          {showBack && <p style={{ color: 'var(--text-muted)' }}>{current.back}</p>}
          {!showBack ? (
            <button onClick={() => setShowBack(true)}>Show answer</button>
          ) : (
            <div className="form-actions" style={{ justifyContent: 'center' }}>
              <button onClick={() => void handleRate('difficult')}>Difficult</button>
              <button onClick={() => void handleRate('moderate')}>Moderate</button>
              <button onClick={() => void handleRate('easy')}>Easy</button>
            </div>
          )}
        </div>
      ) : (
        <p className="empty-state">Nothing due for review.</p>
      )}

      {loading ? (
        <p>Loading…</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Front</th>
              <th>Back</th>
              <th>Deck</th>
              <th>Next review</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => (
              <tr key={c.id}>
                <td>{c.front}</td>
                <td>{c.back}</td>
                <td>{c.deck}</td>
                <td>{c.nextReview ? toShamsi(c.nextReview) : 'New'}</td>
                <td>
                  <button className="link-button" onClick={() => void handleDelete(c.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
