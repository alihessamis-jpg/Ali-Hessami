import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import JSZip from 'jszip'
import {
  addLibraryCard,
  addLibraryCards,
  addLibraryChapterFigure,
  addLibraryHighlight,
  approveLibraryCard,
  approveLibraryCards,
  deleteLibraryChapterFigure,
  ensureLibraryBookSeeded,
  getLibraryChapter,
  importChapterNote,
  listLibraryCardsForChapter,
  listLibraryChapterFigures,
  listLibraryChapterParts,
  listLibraryHighlights,
  listTopicIdsForChapter,
  logPagesRead,
  updateLibraryCardFsrs,
  updateLibraryChapter,
  updateLibraryChapterPart,
  type ChapterNoteImageInput,
} from '../lib/api/library'
import { deleteChapterFigureFile } from '../lib/storage'
import { cacheChapterBundle, evictCachedFigure, getCachedChapterBundle, resolveFigureUrl } from '../lib/offlineCache'
import { listAcademyTopics } from '../lib/api/academy'
import { listPatientIdsForTopic } from '../lib/api/academyTopicPatients'
import { listPatients } from '../lib/api/patients'
import { ChapterProse, type MakeCardPayload, type MakeCardsFromTablePayload } from '../components/library/ChapterProse'
import { PatientCaseCardForm } from '../components/library/PatientCaseCardForm'
import { splitNoteBlocks, type NoteBlock } from '../lib/chapterNoteBlocks'
import { describeError } from '../lib/describeError'
import { parseSections, estimateMinutesLeft } from '../lib/libraryNote'
import { scheduleFsrs, isCardMastered } from '../lib/fsrs'
import { AcademyIcon, CalendarIcon, PatientsIcon, QuizIcon } from '../components/icons'
import { HeroScene } from '../components/hero/HeroScene'
import { requestChapterSuggestions } from '../lib/api/aiSuggestions'
import { approveBoardQuestionSuggestion, listPendingBoardQuestions, rejectBoardQuestionSuggestion } from '../lib/api/boardQuestions'
import type {
  AcademyTopic,
  BoardQuestion,
  FsrsRating,
  LibraryCard,
  LibraryChapter,
  LibraryChapterFigure,
  LibraryChapterPart,
  LibraryHighlight,
  McqOptions,
  Patient,
} from '../types/domain'

const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp)$/i

const QUICK_CHECK_SIZE = 4

interface QuickCheckQuestion {
  card: LibraryCard
  options: string[]
  correctIndex: number
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function isMcqOptions(o: LibraryCard['options']): o is McqOptions {
  return !!o && 'choices' in o
}

// v1.2: the chapter's own board-style MCQs make a better quick check than a
// generated one (real distractors, a real explanation) -- use them first and
// only fall back to picking-and-faking-options-from-other-cards if the
// chapter has none.
function buildQuickCheck(cards: LibraryCard[]): QuickCheckQuestion[] {
  const mcqPool = cards.filter((c) => c.kind === 'mcq' && isMcqOptions(c.options) && c.options.choices.length > 0)
  if (mcqPool.length > 0) {
    const picked = shuffle(mcqPool).slice(0, QUICK_CHECK_SIZE)
    return picked.map((card) => {
      const choices = (card.options as McqOptions).choices
      const options = choices.map((c) => c.text)
      const correctIndex = Math.max(0, choices.findIndex((c) => c.correct))
      return { card, options, correctIndex }
    })
  }
  const pool = cards.filter((c) => c.kind !== 'patient_case' && c.kind !== 'table_cell' && c.kind !== 'mcq')
  const picked = shuffle(pool).slice(0, QUICK_CHECK_SIZE)
  const allBacks = cards.map((c) => c.back)
  return picked.map((card) => {
    const distractorPool = allBacks.filter((b) => b !== card.back)
    const distractors = shuffle(distractorPool).slice(0, 3)
    const options = shuffle([card.back, ...distractors])
    return { card, options, correctIndex: options.indexOf(card.back) }
  })
}

// v1.3: one row in the "Add figure images" panel -- a figure the chapter
// note references that has no uploaded image yet, with its own file picker
// so the reader can go through several one by one.
function MissingFigureRow({
  figureKey,
  file,
  caption,
  onUpload,
}: {
  figureKey: string
  file: string
  caption: string
  onUpload: (figureKey: string, file: File) => Promise<void>
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(picked: File) {
    setUploading(true)
    setError(null)
    try {
      await onUpload(figureKey, picked)
    } catch (err) {
      setError(describeError(err, 'Upload failed'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="figrow">
      <div>
        <b>{file.split('/').pop() ?? file}</b>
        {caption && <span className="np-small"> · {caption}</span>}
        {error && <span className="bookfig-err"> · {error}</span>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const picked = e.target.files?.[0]
          e.target.value = ''
          if (picked) void handleFile(picked)
        }}
      />
      <button type="button" className="np-btn ghost sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
        {uploading ? 'Uploading…' : 'Add image'}
      </button>
    </div>
  )
}

export function ReaderPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [chapter, setChapter] = useState<LibraryChapter | null>(null)
  const [cards, setCards] = useState<LibraryCard[]>([])
  const [highlights, setHighlights] = useState<LibraryHighlight[]>([])
  const [figureUrls, setFigureUrls] = useState<Record<string, string>>({})
  const [figureRecords, setFigureRecords] = useState<LibraryChapterFigure[]>([])
  const [linkedTopics, setLinkedTopics] = useState<AcademyTopic[]>([])
  const [linkedPatients, setLinkedPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [chapterNumberToId, setChapterNumberToId] = useState<Record<number, string>>({})
  const [offlineFallback, setOfflineFallback] = useState(false)

  // v1.4: a chapter with chapter_part imports (see NEPHRON_CHAPTER_FORMAT.md
  // section 7) holds several independent notes here instead of one on the
  // chapter itself; empty for every chapter that only ever got a legacy
  // single-note import, which keeps reading chapter.note directly below.
  const [parts, setParts] = useState<LibraryChapterPart[]>([])
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null)
  const selectedPart = parts.find((p) => p.id === selectedPartId) ?? null

  const [quickCheck, setQuickCheck] = useState<QuickCheckQuestion[]>([])
  const [qcIndex, setQcIndex] = useState(0)
  const [qcAnswer, setQcAnswer] = useState<number | null>(null)

  const [importing, setImporting] = useState(false)
  const [reviewQueue, setReviewQueue] = useState<string[] | null>(null)
  const [reviewIndex, setReviewIndex] = useState(0)
  const [pendingQuestions, setPendingQuestions] = useState<BoardQuestion[]>([])
  const [suggesting, setSuggesting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [figurePanelOpen, setFigurePanelOpen] = useState(false)

  const articleRef = useRef<HTMLDivElement>(null)
  const bottomSentinelRef = useRef<HTMLDivElement>(null)
  const furthestSectionIndexRef = useRef(-1)
  const [furthestSectionIndex, setFurthestSectionIndex] = useState(-1)
  const [currentSectionIndex, setCurrentSectionIndex] = useState(-1)
  const selectedPartIdRef = useRef<string | null>(null)
  selectedPartIdRef.current = selectedPartId

  // The note actually being read -- the selected part's, if this chapter
  // has parts, otherwise the chapter's own (the v1-v1.3 behavior, for every
  // chapter that only ever got a legacy single-note import).
  const activeNote = selectedPart ? selectedPart.note : chapter?.note
  const activeReadingPct = selectedPart ? selectedPart.readingPct : (chapter?.readingPct ?? 0)
  const activeStatus = selectedPart ? selectedPart.status : chapter?.status

  const sections = useMemo(() => parseSections(activeNote), [activeNote])

  // v1.3: every `.figure` the chapter note references, vs. the ones that
  // actually have an uploaded image (figureUrls) -- the gap is what "Add
  // figure images" lets the reader fill in one by one.
  const noteFigures = useMemo(
    () => splitNoteBlocks(activeNote ?? '').filter((b): b is Extract<NoteBlock, { kind: 'figure' }> => b.kind === 'figure'),
    [activeNote]
  )
  const missingFigures = noteFigures.filter((f) => !figureUrls[f.id])

  function markSectionsReadUpTo(idx: number) {
    if (idx <= furthestSectionIndexRef.current) return
    furthestSectionIndexRef.current = idx
    setFurthestSectionIndex(idx)
  }

  function selectPart(part: LibraryChapterPart) {
    if (part.id === selectedPartId) return
    setSelectedPartId(part.id)
    const freshSections = parseSections(part.note)
    const initialIdx = freshSections.findIndex((s) => s.number === part.lastSection)
    furthestSectionIndexRef.current = initialIdx
    setFurthestSectionIndex(initialIdx)
    setCurrentSectionIndex(initialIdx)
  }

  // Renders a chapter's core reading state (note/cards/highlights/figures)
  // from whichever source reload() found -- Supabase or the offline cache --
  // so both paths drive the same section/quick-check setup exactly once.
  async function applyChapterCore(
    chapterRow: LibraryChapter,
    cardRows: LibraryCard[],
    highlightRows: LibraryHighlight[],
    figureRows: LibraryChapterFigure[],
    partRows: LibraryChapterPart[] = []
  ) {
    setChapter(chapterRow)
    setCards(cardRows)
    setHighlights(highlightRows)
    setFigureRecords(figureRows)
    setParts(partRows)
    // Keep whichever part was already open across a reload/re-import; fall
    // back to the first part for a first load.
    const nextPart = partRows.find((p) => p.id === selectedPartIdRef.current) ?? partRows[0] ?? null
    setSelectedPartId(nextPart?.id ?? null)
    const urlEntries = await Promise.all(
      figureRows.map(async (f) => [f.figureKey, await resolveFigureUrl(f.figureKey, f.storagePath)] as const)
    )
    setFigureUrls(Object.fromEntries(urlEntries.filter((e): e is [string, string] => e[1] !== null)))
    const initialNote = nextPart ? nextPart.note : chapterRow.note
    const initialLastSection = nextPart ? nextPart.lastSection : chapterRow.lastSection
    const freshSections = parseSections(initialNote)
    const initialIdx = freshSections.findIndex((s) => s.number === initialLastSection)
    furthestSectionIndexRef.current = initialIdx
    setFurthestSectionIndex(initialIdx)
    setCurrentSectionIndex(initialIdx)
    setQuickCheck(buildQuickCheck(cardRows.filter((c) => c.status === 'approved')))
    setQcIndex(0)
    setQcAnswer(null)
  }

  // Read-only offline support for Academy: a successful load caches this
  // chapter's note/cards/highlights/figures (src/lib/offlineCache.ts); if
  // the network fetch then fails (no connection), reload() falls back to
  // that cache instead of leaving the Reader blank. Nothing written while
  // offline (highlights, approvals, FSRS grades) is queued -- the next
  // successful online load just overwrites the cache again.
  async function reload() {
    if (!id) return
    try {
      const [chapterRow, cardRows, highlightRows, topicIds, seeded, figureRows, pendingQuestionRows, partRows] = await Promise.all([
        getLibraryChapter(id),
        listLibraryCardsForChapter(id),
        listLibraryHighlights(id),
        listTopicIdsForChapter(id),
        ensureLibraryBookSeeded().catch(() => null),
        listLibraryChapterFigures(id).catch(() => []),
        listPendingBoardQuestions(id).catch(() => []),
        listLibraryChapterParts(id).catch(() => []),
      ])
      setOfflineFallback(false)
      setPendingQuestions(pendingQuestionRows)
      if (!chapterRow) {
        setChapter(null)
        setCards([])
        setHighlights([])
        setFigureUrls({})
        setFigureRecords([])
        setParts([])
        return
      }
      await applyChapterCore(chapterRow, cardRows, highlightRows, figureRows, partRows)
      void cacheChapterBundle({ chapterId: id, chapter: chapterRow, cards: cardRows, highlights: highlightRows, figures: figureRows })
      if (seeded) {
        setChapterNumberToId(Object.fromEntries(seeded.chapters.map((c) => [c.chapterNumber, c.id])))
      }
      if (topicIds.length > 0) {
        const allTopics = await listAcademyTopics()
        setLinkedTopics(allTopics.filter((t) => topicIds.includes(t.id)))
        const patientIdSets = await Promise.all(topicIds.map((tid) => listPatientIdsForTopic(tid)))
        const patientIds = Array.from(new Set(patientIdSets.flat()))
        if (patientIds.length > 0) {
          const allPatients = await listPatients()
          setLinkedPatients(allPatients.filter((p) => patientIds.includes(p.id)))
        } else {
          setLinkedPatients([])
        }
      } else {
        setLinkedTopics([])
        setLinkedPatients([])
      }
    } catch (err) {
      const cached = await getCachedChapterBundle(id)
      if (!cached) throw err
      await applyChapterCore(cached.chapter, cached.cards, cached.highlights, cached.figures)
      setChapterNumberToId({})
      setLinkedTopics([])
      setLinkedPatients([])
      setOfflineFallback(true)
    }
  }

  useEffect(() => {
    setLoading(true)
    reload()
      .catch((err) => setError(describeError(err, 'Failed to load chapter')))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Track reading progress per section instead of raw scroll fraction: a
  // section only counts as read once the reader scrolls past its heading
  // into the next one (or reaches the end of the article, for the last
  // section) -- not merely because the chapter was imported or opened.
  useEffect(() => {
    if (sections.length === 0) return
    const headingEls = sections
      .map((s) => document.getElementById(s.anchor))
      .filter((el): el is HTMLElement => el !== null)
    if (headingEls.length === 0) return

    const headingObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const idx = headingEls.indexOf(entry.target as HTMLElement)
          if (idx < 0) continue
          setCurrentSectionIndex(idx)
          if (idx > 0) markSectionsReadUpTo(idx - 1)
        }
      },
      { rootMargin: '0px 0px -75% 0px', threshold: 0 }
    )
    headingEls.forEach((el) => headingObserver.observe(el))

    let bottomObserver: IntersectionObserver | null = null
    const sentinel = bottomSentinelRef.current
    if (sentinel) {
      bottomObserver = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) markSectionsReadUpTo(sections.length - 1)
        },
        { threshold: 0 }
      )
      bottomObserver.observe(sentinel)
    }

    return () => {
      headingObserver.disconnect()
      bottomObserver?.disconnect()
    }
  }, [sections, chapter?.id])

  // Persist the furthest section reached as reading_pct/last_section --
  // never regresses, and logs the equivalent page count toward the daily
  // goal. Targets the selected part's own row when this chapter has parts
  // (each part tracks its own progress independently), otherwise the
  // chapter's, exactly as before v1.4.
  useEffect(() => {
    if (!chapter || sections.length === 0 || furthestSectionIndex < 0) return
    const pct = Math.round(((furthestSectionIndex + 1) / sections.length) * 100)
    if (pct <= activeReadingPct) return
    const lastSection = sections[furthestSectionIndex].number
    const promotesToReading = activeStatus === 'unread'

    if (selectedPart) {
      updateLibraryChapterPart(selectedPart.id, {
        readingPct: pct,
        lastSection,
        status: promotesToReading ? 'reading' : undefined,
      })
        .then((updated) => {
          setParts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
        })
        .catch(() => {
          // best-effort — reading progress isn't critical path
        })
      return
    }

    const deltaPages = chapter.pages ? Math.round(((pct - chapter.readingPct) / 100) * chapter.pages) : 0
    updateLibraryChapter(chapter.id, {
      readingPct: pct,
      lastSection,
      status: promotesToReading ? 'reading' : undefined,
    })
      .then((updated) => {
        setChapter(updated)
        if (deltaPages > 0) return logPagesRead(deltaPages)
      })
      .catch(() => {
        // best-effort — reading progress isn't critical path
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [furthestSectionIndex])

  async function handleMakeCard(payload: MakeCardPayload) {
    if (!id) return
    try {
      const card = await addLibraryCard({
        chapterId: id,
        kind: 'cloze',
        front: payload.front,
        back: payload.back,
        options: null,
        sectionNumber: payload.sectionNumber,
        page: chapter?.startPage ?? null,
        sourceText: payload.sourceText,
        patientId: null,
      })
      setCards((prev) => [...prev, card])
      setMessage(`Card added: …${payload.sourceText.length > 28 ? payload.sourceText.slice(0, 28) + '…' : payload.sourceText}…`)
      setTimeout(() => setMessage(null), 2400)
    } catch (err) {
      setError(describeError(err, 'Failed to create card'))
    }
  }

  async function handleHighlight(payload: { sectionNumber: string | null; text: string }) {
    if (!id) return
    try {
      const h = await addLibraryHighlight({ chapterId: id, sectionNumber: payload.sectionNumber, kind: 'highlight', text: payload.text, noteText: null })
      setHighlights((prev) => [...prev, h])
    } catch (err) {
      setError(describeError(err, 'Failed to save highlight'))
    }
  }

  async function handleMakeCardsFromTable(payload: MakeCardsFromTablePayload) {
    if (!id) return
    try {
      const created = await addLibraryCards(
        payload.cards.map((c) => ({
          chapterId: id,
          kind: 'table_cell' as const,
          front: c.front,
          back: c.back,
          options: null,
          sectionNumber: payload.sectionNumber,
          page: chapter?.startPage ?? null,
          sourceText: null,
          patientId: null,
        }))
      )
      setCards((prev) => [...prev, ...created])
      setMessage(`${created.length} cards from table`)
      setTimeout(() => setMessage(null), 2400)
    } catch (err) {
      setError(describeError(err, 'Failed to create cards'))
    }
  }

  // "Import note" takes a single file: the .md itself, or a .zip holding
  // the .md plus a figures/ folder. A plain .md with no bundled images
  // leaves its figures to the separate "Add figure images" flow below --
  // that single-file, single-purpose picker is the one that reliably opens
  // on mobile; the earlier version that asked for a combined multi-select
  // of the .md with its image files at once did not (iOS Safari in
  // particular can route a multi-select accept list that mixes extensions
  // and image types straight to the Photos picker, with no way to also
  // reach the .md in Files), so it was dropped in favor of this plus the
  // per-figure uploader.
  async function handleImportFile(file: File) {
    setImporting(true)
    setError(null)
    try {
      let raw: string
      let images: ChapterNoteImageInput[] = []

      if (file.name.toLowerCase().endsWith('.zip')) {
        const zip = await JSZip.loadAsync(file)
        const entries = Object.values(zip.files).filter((f) => !f.dir)
        const mdEntry = entries.find((f) => f.name.toLowerCase().endsWith('.md'))
        if (!mdEntry) throw new Error('Zip has no .md file')
        raw = await mdEntry.async('text')
        const imageEntries = entries.filter((f) => IMAGE_EXT_RE.test(f.name))
        images = await Promise.all(
          imageEntries.map(async (entry) => {
            const blob = await entry.async('blob')
            const filename = entry.name.split('/').pop() ?? entry.name
            return { filename, file: new File([blob], filename, { type: blob.type }) }
          })
        )
      } else {
        raw = await file.text()
      }

      const result = await importChapterNote(raw, images)
      let msg = result.part
        ? `Imported note · chapter ${result.chapter.chapterNumber} part ${result.part.partNumber} · ${result.suggestedCardCount} suggested cards`
        : `Imported note · chapter ${result.chapter.chapterNumber} · ${result.suggestedCardCount} suggested cards`
      if (result.missingFigures.length > 0) {
        msg += ` · missing figure${result.missingFigures.length > 1 ? 's' : ''}: ${result.missingFigures.join(', ')} — use "Add figure images"`
      }
      setMessage(msg)
      setTimeout(() => setMessage(null), 5000)
      await reload()
    } catch (err) {
      setError(describeError(err, 'Failed to import chapter note'))
    } finally {
      setImporting(false)
    }
  }

  // v1.3: uploads one figure's image (from the per-figure "Add image" button
  // on a missing-figure card, the "Add figure images" panel, or "Replace
  // image" on an existing figure) and shows it immediately -- no re-import
  // needed. addLibraryChapterFigure upserts by (chapter, figureKey), so a
  // replace overwrites the same storage path/row in place rather than
  // duplicating. Errors are surfaced by the caller (FigureCard /
  // MissingFigureRow own their upload state), not here.
  async function handleUploadFigure(figureKey: string, file: File) {
    if (!chapter) return
    const caption = noteFigures.find((f) => f.id === figureKey)?.caption ?? null
    const figure = await addLibraryChapterFigure(chapter.id, chapter.chapterNumber, figureKey, caption, file)
    // The offline cache is keyed by figureKey and never expires on its own --
    // without evicting it first, a replace would keep showing the old image
    // (resolveFigureUrl returns the cached blob before ever touching storage).
    await evictCachedFigure(figureKey)
    const url = await resolveFigureUrl(figureKey, figure.storagePath)
    if (url) setFigureUrls((prev) => ({ ...prev, [figureKey]: url }))
    setFigureRecords((prev) => (prev.some((f) => f.figureKey === figureKey) ? prev.map((f) => (f.figureKey === figureKey ? figure : f)) : [...prev, figure]))
  }

  // "Remove image": deletes the storage file and the figure row, evicts the
  // cached blob, and drops it from figureUrls -- ChapterProse then renders
  // that block as a "Missing figure" card again (the note's `.figure`
  // reference itself is untouched, so "Add image" still works afterward).
  async function handleRemoveFigure(figureKey: string) {
    const record = figureRecords.find((f) => f.figureKey === figureKey)
    if (!record) return
    await deleteChapterFigureFile(record.storagePath)
    await deleteLibraryChapterFigure(record.id)
    await evictCachedFigure(figureKey)
    setFigureUrls((prev) => {
      const next = { ...prev }
      delete next[figureKey]
      return next
    })
    setFigureRecords((prev) => prev.filter((f) => f.figureKey !== figureKey))
  }

  // Step 4: asks the suggest-chapter-content Edge Function for new
  // AI-suggested board questions/flashcards/high-yield points for this
  // chapter. Everything it writes lands pending/suggested -- reload()
  // picks up the new pending board questions here, and the new suggested
  // library_cards flow into the existing suggested-cards review below
  // (tagged source: 'ai_suggested', same approve/reject actions).
  async function handleSuggestWithAi() {
    if (!chapter) return
    setSuggesting(true)
    try {
      const result = await requestChapterSuggestions(chapter.id)
      setMessage(`AI suggested ${result.questions} questions · ${result.flashcards} flashcards · ${result.highYield} high-yield points — review below`)
      setTimeout(() => setMessage(null), 6000)
      await reload()
    } catch (err) {
      setError(describeError(err, 'Failed to generate AI suggestions'))
    } finally {
      setSuggesting(false)
    }
  }

  async function handleApproveQuestionSuggestion(questionId: string) {
    try {
      await approveBoardQuestionSuggestion(questionId)
      setPendingQuestions((prev) => prev.filter((q) => q.id !== questionId))
    } catch (err) {
      setError(describeError(err, 'Failed to approve question'))
    }
  }

  async function handleRejectQuestionSuggestion(questionId: string) {
    try {
      await rejectBoardQuestionSuggestion(questionId)
      setPendingQuestions((prev) => prev.filter((q) => q.id !== questionId))
    } catch (err) {
      setError(describeError(err, 'Failed to reject question'))
    }
  }

  async function handleApproveAllSuggested(cardIds: string[]) {
    try {
      await approveLibraryCards(cardIds)
      setCards((prev) => prev.map((c) => (cardIds.includes(c.id) ? { ...c, status: 'approved' } : c)))
      setMessage(`${cardIds.length} cards approved`)
      setTimeout(() => setMessage(null), 2400)
    } catch (err) {
      setError(describeError(err, 'Failed to approve cards'))
    }
  }

  function handleReviewSuggestedOneByOne(cardIds: string[]) {
    setReviewQueue(cardIds)
    setReviewIndex(0)
  }

  async function handleReviewDecision(approve: boolean) {
    if (!reviewQueue) return
    const cardId = reviewQueue[reviewIndex]
    if (approve) {
      try {
        const updated = await approveLibraryCard(cardId)
        setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      } catch (err) {
        setError(describeError(err, 'Failed to approve card'))
      }
    }
    if (reviewIndex + 1 < reviewQueue.length) {
      setReviewIndex((i) => i + 1)
    } else {
      setReviewQueue(null)
      setReviewIndex(0)
    }
  }

  function handleQcAnswer(optionIndex: number) {
    setQcAnswer(optionIndex)
    const q = quickCheck[qcIndex]
    const correct = optionIndex === q.correctIndex
    const next = scheduleFsrs(q.card, correct ? 'good' : 'again')
    void updateLibraryCardFsrs(q.card.id, next.next).then((updated) => {
      setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
    })
  }

  function handleQcNext() {
    setQcIndex((i) => i + 1)
    setQcAnswer(null)
  }

  async function handleFinishChapter(rating: FsrsRating) {
    if (!chapter) return
    try {
      const results = await Promise.all(
        cards
          .filter((c) => c.status === 'approved')
          .map(async (c) => {
            const next = scheduleFsrs(c, rating)
            return updateLibraryCardFsrs(c.id, next.next)
          })
      )
      const byId = new Map(results.map((c) => [c.id, c]))
      setCards((prev) => prev.map((c) => byId.get(c.id) ?? c))
    } catch (err) {
      setError(describeError(err, 'Failed to update cards'))
    }
  }

  async function handleMarkRead() {
    if (!chapter) return
    try {
      const scored = cards.filter((c) => c.status === 'approved')
      const allMastered = scored.length > 0 && scored.every((c) => isCardMastered(c))
      const nextStatus = allMastered ? 'mastered' : scored.length > 0 ? 'carded' : 'read'
      if (selectedPart) {
        const updated = await updateLibraryChapterPart(selectedPart.id, { status: nextStatus, readingPct: 100 })
        setParts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
        return
      }
      const updated = await updateLibraryChapter(chapter.id, { status: nextStatus, readingPct: 100 })
      setChapter(updated)
    } catch (err) {
      setError(describeError(err, 'Failed to update chapter'))
    }
  }

  const minutesLeft = useMemo(() => estimateMinutesLeft(activeNote, activeReadingPct), [activeNote, activeReadingPct])
  const approvedCards = cards.filter((c) => c.status === 'approved')
  const suggestedCount = cards.length - approvedCards.length
  const dueCount = approvedCards.filter((c) => c.reps > 0 && new Date(c.due) <= new Date()).length
  const newCount = approvedCards.filter((c) => c.reps === 0).length
  const masteredCount = approvedCards.filter((c) => isCardMastered(c)).length
  const masteryPct = approvedCards.length > 0 ? Math.round((masteredCount / approvedCards.length) * 100) : null

  if (!id) return null
  if (loading) return <p>Loading…</p>
  // Once the chapter has loaded once, a later action failure (import,
  // approve, etc.) is shown as an inline banner below instead of replacing
  // the whole page -- only an error before any chapter ever loaded is fatal.
  if (error && !chapter) return <p className="form-error">{error}</p>
  if (!chapter) return <p className="empty-state">Chapter not found.</p>

  return (
    <div className="np-page">
      <div className="rd">
        <header className="rhead np-fade">
          <div className="crumb" style={{ justifyContent: 'space-between', width: '100%' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Link to="/academy">Library</Link>
              <span>›</span>
              <span>
                Part {chapter.partRoman} · {chapter.partTitle}
              </span>
            </span>
            <span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".md,.zip"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) void handleImportFile(file)
                }}
              />
              <button
                type="button"
                className="np-btn ghost sm"
                disabled={importing}
                onClick={() => fileInputRef.current?.click()}
                title="Select the .md file, or a .zip with the .md and its figures/ images"
              >
                {importing ? 'Importing…' : 'Import note'}
              </button>
              {noteFigures.length > 0 && (
                <button
                  type="button"
                  className="np-btn ghost sm"
                  disabled={missingFigures.length === 0}
                  onClick={() => setFigurePanelOpen((v) => !v)}
                  title={missingFigures.length === 0 ? 'Every figure in this chapter has an image' : 'Upload the missing figure images one by one'}
                  style={{ marginInlineStart: 8 }}
                >
                  Add figure images{missingFigures.length > 0 ? ` (${missingFigures.length})` : ''}
                </button>
              )}
              <button
                type="button"
                className="np-btn ghost sm"
                disabled={suggesting}
                onClick={() => void handleSuggestWithAi()}
                title="Generate AI-suggested questions/flashcards/high-yield points for this chapter -- all go to review before counting anywhere"
                style={{ marginInlineStart: 8 }}
              >
                {suggesting ? 'Generating…' : 'Suggest with AI'}
              </button>
            </span>
          </div>
          <div className="rhead-title">
            <HeroScene scene="microvilli" page="reader" className="hero-scene" opacity={0.35} />
            <div className="hero-scrim-light" />
            <span
              style={{
                position: 'relative',
                zIndex: 2,
                width: 56,
                height: 56,
                borderRadius: 16,
                background: 'var(--navy-800)',
                color: '#fff',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                lineHeight: 1,
              }}
            >
              <span style={{ fontSize: 9, color: '#A9C6FF', fontWeight: 700, letterSpacing: '.08em' }}>CH</span>
              <b style={{ fontSize: 20 }}>{chapter.chapterNumber}</b>
            </span>
            <h1 style={{ position: 'relative', zIndex: 2 }}>{chapter.title}</h1>
          </div>
          <div className="rmeta">
            <span className="chip2">
              p. {chapter.startPage}–{chapter.endPage} · {chapter.pages} pp
            </span>
            <span className="chip2">
              <CalendarIcon width={14} height={14} />≈ {minutesLeft} min left
            </span>
            {approvedCards.length > 0 && (
              <span className="chip2" style={{ color: '#5131B5', borderColor: '#E2D9FB' }}>
                <QuizIcon width={14} height={14} />
                {approvedCards.length} cards · {dueCount} due
              </span>
            )}
            {suggestedCount > 0 && (
              <span className="chip2" style={{ color: '#5131B5', borderColor: '#E2D9FB' }}>
                {suggestedCount} suggested · {approvedCards.length} approved
              </span>
            )}
            {pendingQuestions.length > 0 && (
              <span className="chip2" style={{ color: '#93590B', borderColor: '#F3E0B8' }}>
                {pendingQuestions.length} AI question{pendingQuestions.length > 1 ? 's' : ''} awaiting review
              </span>
            )}
            {masteryPct != null && (
              <span className="chip2" style={{ color: '#17663A', borderColor: '#CDEBD9' }}>
                Mastery {masteryPct}%
              </span>
            )}
            {chapter.noteFormat && (
              <span className="chip2" style={{ color: '#0B6670', borderColor: '#CDEBE7' }}>
                Imported note · {chapter.language ?? 'fa'}
              </span>
            )}
          </div>
          <div className="prog" aria-label={`${activeReadingPct}% read`}>
            <i style={{ width: `${activeReadingPct}%` }} />
          </div>
          {currentSectionIndex >= 0 && currentSectionIndex > furthestSectionIndex && (
            <button
              type="button"
              className="np-btn ghost"
              style={{ fontSize: 12, padding: '4px 10px', alignSelf: 'flex-start' }}
              onClick={() => markSectionsReadUpTo(currentSectionIndex)}
            >
              Mark section {sections[currentSectionIndex]?.number} read
            </button>
          )}
        </header>

        {parts.length > 0 && (
          <div className="chapter-parts np-fade" role="tablist" aria-label="Chapter parts">
            {parts.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={p.id === selectedPartId}
                className={p.id === selectedPartId ? 'on' : undefined}
                onClick={() => selectPart(p)}
              >
                بخش {p.partNumber}
                {p.title ? `: ${p.title}` : ''}
              </button>
            ))}
          </div>
        )}

        {sections.length > 0 && (
          <>
            <nav className="toc np-fade" aria-label="Sections">
              <h2>Sections</h2>
              {sections.map((s, i) => (
                <a key={s.number} href={`#${s.anchor}`} className={i === currentSectionIndex ? 'now' : undefined}>
                  <span className="n">{s.number}</span>
                  <span className="np-fa" dir="rtl">
                    {s.title}
                  </span>
                  <span className="st">{i <= furthestSectionIndex ? '✓' : ''}</span>
                </a>
              ))}
              {quickCheck.length > 0 && (
                <div style={{ borderTop: '1px solid #EDF1F7', marginTop: 8, paddingTop: 8 }}>
                  <a href="#qc">
                    <span className="n">✓</span>
                    <span>Quick check</span>
                    <span />
                  </a>
                </div>
              )}
            </nav>
            <nav className="tocchips" aria-label="Sections">
              {sections.map((s) => (
                <a key={s.number} href={`#${s.anchor}`} dir="rtl">
                  <b style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>{s.number}</b> {s.title}
                </a>
              ))}
              {quickCheck.length > 0 && <a href="#qc">✓ Quick check</a>}
            </nav>
          </>
        )}

        <div className="stack">
          <article className="art-card np-fade" ref={articleRef}>
            {offlineFallback && (
              <p className="np-small" style={{ color: '#93590B', background: '#FDF0D5', padding: '8px 12px', borderRadius: 10 }}>
                Offline — showing the last downloaded version of this chapter. Import, approving cards, and new figures need a
                connection.
              </p>
            )}
            {error && (
              <p className="form-error" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span>{error}</span>
                <button type="button" className="np-btn ghost sm" onClick={() => setError(null)}>
                  Dismiss
                </button>
              </p>
            )}
            {message && <p className="patient-meta">{message}</p>}
            {activeNote ? (
              <ChapterProse
                note={activeNote}
                cards={cards}
                highlights={highlights}
                onMakeCard={handleMakeCard}
                onHighlight={handleHighlight}
                onMakeCardsFromTable={handleMakeCardsFromTable}
                onApproveAllSuggested={(ids) => void handleApproveAllSuggested(ids)}
                onReviewSuggestedOneByOne={handleReviewSuggestedOneByOne}
                chapterNumberToId={chapterNumberToId}
                figures={figureUrls}
                onUploadFigure={handleUploadFigure}
                onRemoveFigure={handleRemoveFigure}
              />
            ) : (
              <p className="empty-state">No content written for this chapter yet.</p>
            )}
            <div ref={bottomSentinelRef} style={{ height: 1 }} />
          </article>

          {figurePanelOpen && missingFigures.length > 0 && (
            <section className="np-card np-fade" style={{ gap: 12 }}>
              <div className="np-head">
                <h2>Add figure images</h2>
                <span className="np-small">{missingFigures.length} missing</span>
              </div>
              {missingFigures.map((f) => (
                <MissingFigureRow key={f.id} figureKey={f.id} file={f.file} caption={f.caption} onUpload={handleUploadFigure} />
              ))}
            </section>
          )}

          {reviewQueue && (
            <section className="np-card np-fade" style={{ gap: 12 }}>
              <div className="np-head">
                <h2>Review suggested cards</h2>
                <span className="np-small">
                  {reviewIndex + 1} / {reviewQueue.length}
                </span>
              </div>
              {(() => {
                const card = cards.find((c) => c.id === reviewQueue[reviewIndex])
                if (!card) return <p className="empty-state">Card not found.</p>
                return (
                  <>
                    <p dir="rtl" style={{ lineHeight: 1.9 }}>
                      {card.front}
                    </p>
                    <p dir="rtl" className="np-small" style={{ lineHeight: 1.7 }}>
                      {card.back}
                    </p>
                  </>
                )
              })()}
              <div className="endrow">
                <button type="button" className="np-btn ghost" onClick={() => void handleReviewDecision(false)}>
                  Skip
                </button>
                <button type="button" className="np-btn" onClick={() => void handleReviewDecision(true)}>
                  Approve
                </button>
              </div>
            </section>
          )}

          {pendingQuestions.length > 0 && (
            <section className="np-card np-fade" style={{ gap: 12 }}>
              <div className="np-head">
                <h2>AI-suggested questions</h2>
                <span className="np-small">{pendingQuestions.length} awaiting review</span>
              </div>
              {pendingQuestions.map((q) => (
                <div key={q.id} style={{ borderTop: '1px solid #EDF1F7', paddingTop: 12 }}>
                  <p dir="rtl" style={{ lineHeight: 1.9, whiteSpace: 'pre-line' }}>
                    {q.question}
                  </p>
                  <ul dir="rtl" className="np-small" style={{ lineHeight: 1.7, paddingInlineStart: 18 }}>
                    {q.options.map((o, i) => (
                      <li key={i} style={i === q.correctIndex ? { fontWeight: 700, color: '#17663A' } : undefined}>
                        {o}
                      </li>
                    ))}
                  </ul>
                  {q.explanation && (
                    <p dir="rtl" className="np-small" style={{ color: '#5B6B82' }}>
                      {q.explanation}
                    </p>
                  )}
                  <div className="endrow">
                    <button type="button" className="np-btn ghost sm" onClick={() => void handleRejectQuestionSuggestion(q.id)}>
                      Reject
                    </button>
                    <button type="button" className="np-btn sm" onClick={() => void handleApproveQuestionSuggestion(q.id)}>
                      Approve
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}

          {quickCheck.length > 0 && qcIndex < quickCheck.length && (
            <section className="qc np-fade" id="qc">
              <div className="head" style={{ position: 'relative' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="eyebrow" style={{ color: '#B9A6F5' }}>
                    QUICK CHECK
                  </span>
                  <h2>
                    Question {qcIndex + 1} of {quickCheck.length}
                  </h2>
                </div>
                <div className="qdots">
                  {quickCheck.map((_, i) => (
                    <i key={i} className={i === qcIndex ? 'on' : ''} />
                  ))}
                </div>
              </div>
              <p className="qq" dir="rtl">
                {quickCheck[qcIndex].card.front.replace(/_____/g, '؟')}
              </p>
              <div className="opts" dir="rtl">
                {quickCheck[qcIndex].options.map((opt, i) => (
                  <button
                    key={i}
                    className={qcAnswer == null ? 'opt' : i === quickCheck[qcIndex].correctIndex ? 'opt right' : i === qcAnswer ? 'opt wrong' : 'opt'}
                    disabled={qcAnswer != null}
                    onClick={() => handleQcAnswer(i)}
                  >
                    <span className="k">{String.fromCharCode(65 + i)}</span>
                    {opt}
                  </button>
                ))}
              </div>
              {qcAnswer != null && (
                <button className="np-btn white" onClick={handleQcNext}>
                  {qcIndex + 1 < quickCheck.length ? 'Next question' : 'Done'}
                </button>
              )}
            </section>
          )}

          <section className="np-card np-fade">
            <h2>Finish this chapter</h2>
            <span className="np-small">Rate how well you understood it — card intervals for this chapter adjust accordingly.</span>
            <div className="diff">
              <button type="button" onClick={() => void handleFinishChapter('hard')}>
                Difficult
              </button>
              <button type="button" onClick={() => void handleFinishChapter('good')}>
                Moderate
              </button>
              <button type="button" onClick={() => void handleFinishChapter('easy')}>
                Easy
              </button>
            </div>
            <div className="endrow">
              <button type="button" className="np-btn ghost" onClick={() => void handleMarkRead()}>
                Mark chapter read
              </button>
              <button
                type="button"
                className="np-btn"
                onClick={() => navigate(`/academy/review?chapter=${chapter.id}`)}
                disabled={dueCount === 0 && newCount === 0}
              >
                Review {dueCount} due cards
              </button>
            </div>
          </section>
        </div>

        <aside className="side-r">
          {approvedCards.length > 0 && (
            <section className="np-card np-fade" style={{ gap: 10 }}>
              <h2>Cards from this chapter</h2>
              <div className="fcount">
                <b>{approvedCards.length}</b>
                <span className="np-small">
                  cards · {dueCount} due today
                  <br />
                  Highlight text to add one
                </span>
              </div>
            </section>
          )}
          {(linkedTopics.length > 0 || linkedPatients.length > 0) && (
            <section className="np-card np-fade" style={{ gap: 8 }}>
              <h2>Linked</h2>
              {linkedTopics.map((t) => (
                <Link className="chip2" to={`/academy/${t.id}`} key={t.id} style={{ textDecoration: 'none' }}>
                  <AcademyIcon width={14} height={14} />
                  Academy: {t.name}
                </Link>
              ))}
              {linkedPatients.map((p) => (
                <Link className="chip2" to={`/patients/${p.id}`} key={p.id} style={{ textDecoration: 'none' }}>
                  <PatientsIcon width={14} height={14} />
                  <span className="np-fa">{p.name}</span>
                </Link>
              ))}
            </section>
          )}
          {linkedPatients.length > 0 && (
            <PatientCaseCardForm chapterId={chapter.id} patients={linkedPatients} onCreated={(card) => setCards((prev) => [...prev, card])} />
          )}
        </aside>
      </div>
    </div>
  )
}
