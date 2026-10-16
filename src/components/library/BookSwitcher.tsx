import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { useElementWidth } from '../../hooks/useElementWidth'
import { HeroScene } from '../hero/HeroScene'
import { getBookCover } from '../../lib/bookCovers'
import type { LibraryBook } from '../../types/domain'

export interface LibraryBookStats {
  partsCount: number
  chaptersCount: number
  totalPages: number
  chaptersRead: number
  totalCards: number
  dueToday: number
  pctRead: number
}

interface BookSwitcherProps {
  books: LibraryBook[]
  stats: Record<string, LibraryBookStats>
  selectedBookId: string
  onSelect: (id: string) => void
  dailyGoal: number
  todayPages: number
  streak: number
  onEditGoal: () => void
}

const TABLET_MIN = 768
// The page shell (.np-page) caps content width at 1100px total, so a
// container here never reaches 1100px on its own -- this picks the sidebar
// layout once the container is comfortably wide (iPad landscape and up),
// while narrower containers (iPad portrait, phones) keep the carousel.
const DESKTOP_MIN = 860

export function BookSwitcher(props: BookSwitcherProps) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>()
  const layout = width === 0 ? 'phone' : width < TABLET_MIN ? 'phone' : width < DESKTOP_MIN ? 'tablet' : 'desktop'

  if (props.books.length === 0) return null

  return (
    <div className="bsw" data-layout={layout} ref={wrapRef}>
      {layout === 'desktop' ? <DesktopSwitcher {...props} /> : <CarouselSwitcher {...props} peek={layout === 'tablet'} />}
    </div>
  )
}

function emptyStats(): LibraryBookStats {
  return { partsCount: 0, chaptersCount: 0, totalPages: 0, chaptersRead: 0, totalCards: 0, dueToday: 0, pctRead: 0 }
}

interface HeroCardProps {
  book: LibraryBook
  stat: LibraryBookStats
  active: boolean
  dailyGoal: number
  todayPages: number
  streak: number
  onEditGoal: () => void
  onTitleClick?: () => void
}

function BookHeroCard({ book, stat, active, dailyGoal, todayPages, streak, onEditGoal, onTitleClick }: HeroCardProps) {
  const goalPct = Math.min(100, Math.round((todayPages / Math.max(1, dailyGoal)) * 100))
  const coverSrc = getBookCover(book.title)
  return (
    <section className="np-hero np-fade" style={{ gap: 18 }}>
      {active && <HeroScene scene="glomerulus" page="library" className="hero-scene" />}
      <div className="hero-scrim" />
      <div className="libhero">
        {coverSrc ? (
          <div className="bsw-cover" aria-hidden="true">
            <div className="bsw-cover-float">
              <img className="bsw-cover-img" src={coverSrc} alt="" loading="lazy" />
            </div>
          </div>
        ) : (
          <div className="cover" aria-hidden="true">
            <i>{book.edition} ed.</i>
            <b>{book.title}</b>
          </div>
        )}
        <div className="np-txt">
          <span className="eyebrow">ACADEMY · LIBRARY</span>
          {onTitleClick ? (
            <button type="button" className="bsw-title-btn" onClick={onTitleClick} aria-label={`Switch book, currently ${book.title}`}>
              <h1 style={{ fontSize: 24, lineHeight: 1.2 }}>{book.title}</h1>
              <svg className="bsw-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          ) : (
            <h1 style={{ fontSize: 24, lineHeight: 1.2 }}>{book.title}</h1>
          )}
          <p className="np-sub">
            {book.edition} ed. · {stat.partsCount} parts · {stat.chaptersCount} chapters
            {stat.totalPages > 0 ? ` · ${stat.totalPages.toLocaleString()} pages` : ''} · {stat.pctRead}% read
          </p>
        </div>
      </div>
      <div className="lstats" style={{ '--n': 3 } as CSSProperties}>
        <div>
          <b>
            {stat.chaptersRead}
            <span style={{ fontSize: 14, color: '#A9C6FF' }}> / {stat.chaptersCount}</span>
          </b>
          <span>chapters read</span>
        </div>
        <div>
          <b>{stat.totalCards}</b>
          <span>cards made</span>
        </div>
        <div>
          <b style={{ color: '#FFC46B' }}>{stat.dueToday}</b>
          <span>due today</span>
        </div>
      </div>
      <div className="goal">
        <div className="np-head">
          <b style={{ fontSize: 13 }}>Today's goal</b>
          <span style={{ fontSize: 12, color: '#C9DAF8', display: 'flex', alignItems: 'center', gap: 6 }}>
            {todayPages} / {dailyGoal} pages · {streak}-day streak
            <button type="button" onClick={onEditGoal} className="bsw-goal-edit">
              Edit
            </button>
          </span>
        </div>
        <div className="gbar">
          <i style={{ width: `${goalPct}%` }} />
        </div>
      </div>
    </section>
  )
}

interface CarouselProps extends BookSwitcherProps {
  peek: boolean
}

function CarouselSwitcher({ books, stats, selectedBookId, onSelect, dailyGoal, todayPages, streak, onEditGoal, peek }: CarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const slideRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [sheetOpen, setSheetOpen] = useState(false)
  const scrollTimer = useRef<number | null>(null)
  const programmaticScroll = useRef(false)

  useEffect(() => {
    if (programmaticScroll.current) return
    const el = slideRefs.current[selectedBookId]
    if (el) {
      programmaticScroll.current = true
      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
      window.setTimeout(() => {
        programmaticScroll.current = false
      }, 350)
    }
  }, [selectedBookId])

  function handleScroll() {
    if (scrollTimer.current) window.clearTimeout(scrollTimer.current)
    scrollTimer.current = window.setTimeout(() => {
      const track = trackRef.current
      if (!track) return
      const trackCenter = track.scrollLeft + track.clientWidth / 2
      let nearestId: string | null = null
      let nearestDist = Infinity
      for (const b of books) {
        const el = slideRefs.current[b.id]
        if (!el) continue
        const center = el.offsetLeft + el.clientWidth / 2
        const dist = Math.abs(center - trackCenter)
        if (dist < nearestDist) {
          nearestDist = dist
          nearestId = b.id
        }
      }
      if (nearestId && nearestId !== selectedBookId) {
        programmaticScroll.current = true
        onSelect(nearestId)
        window.setTimeout(() => {
          programmaticScroll.current = false
        }, 350)
      }
    }, 120)
  }

  return (
    <>
      <div className="bsw-track" ref={trackRef} onScroll={handleScroll} data-peek={peek || undefined}>
        {books.map((b) => (
          <div
            className="bsw-slide"
            key={b.id}
            ref={(el) => {
              slideRefs.current[b.id] = el
            }}
          >
            <BookHeroCard
              book={b}
              stat={stats[b.id] ?? emptyStats()}
              active={b.id === selectedBookId}
              dailyGoal={dailyGoal}
              todayPages={todayPages}
              streak={streak}
              onEditGoal={onEditGoal}
              onTitleClick={books.length > 1 ? () => setSheetOpen(true) : undefined}
            />
          </div>
        ))}
      </div>
      {books.length > 1 && (
        <div className="bsw-dots" role="tablist" aria-label="Books">
          {books.map((b) => (
            <button
              key={b.id}
              type="button"
              role="tab"
              aria-selected={b.id === selectedBookId}
              aria-label={b.title}
              className={b.id === selectedBookId ? 'bsw-dot on' : 'bsw-dot'}
              onClick={() => onSelect(b.id)}
            />
          ))}
        </div>
      )}
      {sheetOpen && (
        <BookPickerSheet books={books} stats={stats} selectedBookId={selectedBookId} onSelect={(id) => { onSelect(id); setSheetOpen(false) }} onClose={() => setSheetOpen(false)} />
      )}
    </>
  )
}

interface SheetProps {
  books: LibraryBook[]
  stats: Record<string, LibraryBookStats>
  selectedBookId: string
  onSelect: (id: string) => void
  onClose: () => void
}

function BookPickerSheet({ books, stats, selectedBookId, onSelect, onClose }: SheetProps) {
  return (
    <>
      <div className="more-sheet-backdrop" onClick={onClose} />
      <div className="more-sheet" role="dialog" aria-label="Choose book">
        <div className="more-sheet-handle" />
        <h2 style={{ fontSize: 16, margin: '0 0 12px' }}>Your books</h2>
        <div className="bsw-sheet-list">
          {books.map((b) => {
            const s = stats[b.id] ?? emptyStats()
            return (
              <button
                key={b.id}
                type="button"
                className={b.id === selectedBookId ? 'bsw-sheet-row on' : 'bsw-sheet-row'}
                aria-label={b.title}
                onClick={() => onSelect(b.id)}
              >
                <span className="cover" aria-hidden="true" style={{ transform: 'none', width: 40, height: 56 }}>
                  <i>{b.edition} ed.</i>
                </span>
                <span className="bsw-sheet-info">
                  <span className="bsw-sheet-title">{b.title}</span>
                  <span className="bsw-sheet-meta">
                    {s.pctRead}% read{s.dueToday > 0 ? ` · ${s.dueToday} due` : ''}
                  </span>
                  <span className="bsw-sheet-bar">
                    <i style={{ width: `${s.pctRead}%` }} />
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}

function DesktopSwitcher({ books, stats, selectedBookId, onSelect, dailyGoal, todayPages, streak, onEditGoal }: BookSwitcherProps) {
  const rowRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const selected = books.find((b) => b.id === selectedBookId) ?? books[0]

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    const idx = books.findIndex((b) => b.id === selectedBookId)
    if (idx === -1) return
    const nextIdx = e.key === 'ArrowDown' ? (idx + 1) % books.length : (idx - 1 + books.length) % books.length
    const next = books[nextIdx]
    onSelect(next.id)
    rowRefs.current[next.id]?.focus()
  }

  return (
    <div className="bsw-desktop">
      <nav className="bsw-sidebar" aria-label="Books" onKeyDown={handleKeyDown}>
        {books.map((b) => {
          const s = stats[b.id] ?? emptyStats()
          const isActive = b.id === selectedBookId
          return (
            <button
              key={b.id}
              type="button"
              ref={(el) => {
                rowRefs.current[b.id] = el
              }}
              className={isActive ? 'bsw-sidebar-row on' : 'bsw-sidebar-row'}
              aria-label={b.title}
              aria-current={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onSelect(b.id)}
            >
              <span className="cover" aria-hidden="true" style={{ transform: 'none', width: 36, height: 50 }}>
                <i>{b.edition} ed.</i>
              </span>
              <span className="bsw-sidebar-info">
                <span className="bsw-sidebar-title">{b.title}</span>
                <span className="bsw-sidebar-meta">
                  {s.pctRead}% read{s.dueToday > 0 ? ` · ${s.dueToday} due` : ''}
                </span>
                <span className="bsw-sidebar-bar">
                  <i style={{ width: `${s.pctRead}%` }} />
                </span>
              </span>
            </button>
          )
        })}
      </nav>
      <div className="bsw-main">
        {selected && (
          <BookHeroCard
            book={selected}
            stat={stats[selected.id] ?? emptyStats()}
            active
            dailyGoal={dailyGoal}
            todayPages={todayPages}
            streak={streak}
            onEditGoal={onEditGoal}
          />
        )}
      </div>
    </div>
  )
}
