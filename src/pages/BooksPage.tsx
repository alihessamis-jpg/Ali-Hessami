import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { addBook, listBooks } from '../lib/api/books'
import { BookIcon } from '../components/icons'
import { EmptyState } from '../components/illustrations/EmptyState'
import type { Book } from '../types/domain'

export function BooksPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')

  useEffect(() => {
    listBooks()
      .then(setBooks)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load books'))
      .finally(() => setLoading(false))
  }, [])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    try {
      const book = await addBook({ title: title.trim(), author: author.trim() || null, totalPages: null })
      setBooks((prev) => [...prev, book])
      setTitle('')
      setAuthor('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add book')
    }
  }

  if (loading) return <p>Loading…</p>

  return (
    <div className="np-page">
      <div className="np-head-l" style={{ marginBottom: 12 }}>
        <span className="np-ic">
          <BookIcon />
        </span>
        <h1 style={{ fontSize: 22 }}>Books</h1>
      </div>
      {error && <p className="form-error">{error}</p>}
      <section className="np-card np-fade">
        <h2>Add a book</h2>
        <form className="inline-form" onSubmit={(e) => void handleAdd(e)}>
          <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input placeholder="Author (optional)" value={author} onChange={(e) => setAuthor(e.target.value)} />
          <button type="submit">Add book</button>
        </form>
      </section>
      {books.length === 0 ? (
        <div className="np-card np-fade">
          <EmptyState>No books yet — add one to start chapter/section reading tracking.</EmptyState>
        </div>
      ) : (
        books.map((b) => (
          <Link
            key={b.id}
            to={`/books/${b.id}`}
            className="np-card np-fade"
            style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}
          >
            <span className="np-ic">
              <BookIcon />
            </span>
            <span style={{ flex: 1 }}>
              <b style={{ display: 'block', fontSize: 15 }}>{b.title}</b>
              {b.author && <span className="np-small">{b.author}</span>}
            </span>
          </Link>
        ))
      )}
    </div>
  )
}
