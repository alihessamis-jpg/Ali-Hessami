// v1.6 (section 10.4): the bottom sheet a "🧩 n" badge opens -- every
// question that links back to one anchored paragraph/table/figure, answered
// one at a time without leaving the Reader. Supports the two question
// shapes the reverse-link index can point to: a board_questions row (any
// type) and an imported mcq library_card (the chapter's own question bank).
import { useState } from 'react'
import type { AnchoredQuestionRef } from '../../lib/reverseLinks'
import type { McqOptions } from '../../types/domain'

interface QuestionSheetProps {
  refs: AnchoredQuestionRef[]
  onClose: () => void
  onOpenInPractice: (chapterId: string) => void
  onRecordBoardAttempt: (questionId: string, isCorrect: boolean, selectedIndex: number) => void
  onGradeCard: (cardId: string, correct: boolean) => void
}

const NO_SELECTED_INDEX = -1

// The sheet's own explanation render: links/chips as plain text -- the
// reader is already on the cited paragraph, so a tappable jump back to it
// would be a no-op at best and confusing at worst.
function plainExplanation(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\[\[#[\w-]+(?:\|([^\]]+))?\]\]/g, (_, label: string | undefined) => label ?? 'منبع')
}

export function QuestionSheet({ refs, onClose, onOpenInPractice, onRecordBoardAttempt, onGradeCard }: QuestionSheetProps) {
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const ref = refs[Math.min(index, refs.length - 1)]

  function reset() {
    setSelected(null)
    setRevealed(false)
    setSubmitted(false)
  }
  function next() {
    setIndex((i) => Math.min(i + 1, refs.length - 1))
    reset()
  }
  function prev() {
    setIndex((i) => Math.max(i - 1, 0))
    reset()
  }

  if (ref.kind === 'card') {
    // Captured outside the nested `submit` so it stays a plain LibraryCard
    // there instead of the AnchoredQuestionRef union TS won't narrow inside
    // a closure.
    const card = ref.card
    const options = card.options as McqOptions
    const correctIndex = options.choices.findIndex((c) => c.correct)
    function submit() {
      if (selected == null) return
      setSubmitted(true)
      onGradeCard(card.id, selected === correctIndex)
    }
    return (
      <SheetFrame index={index} total={refs.length} onClose={onClose} onPrev={prev} onNext={next}>
        <p dir="rtl" className="qq">
          {card.front.replace(/_____/g, '؟')}
        </p>
        <div className="opts" dir="rtl">
          {options.choices.map((c, i) => (
            <button
              key={i}
              type="button"
              className={
                !submitted
                  ? i === selected
                    ? 'opt sel'
                    : 'opt'
                  : i === correctIndex
                    ? 'opt right'
                    : i === selected
                      ? 'opt wrong'
                      : 'opt'
              }
              disabled={submitted}
              onClick={() => setSelected(i)}
            >
              {c.text}
            </button>
          ))}
        </div>
        {!submitted ? (
          <button type="button" className="np-btn" disabled={selected == null} onClick={submit}>
            ثبت پاسخ
          </button>
        ) : (
          options.explanation && <p dir="auto" className="np-small">{plainExplanation(options.explanation)}</p>
        )}
      </SheetFrame>
    )
  }

  const q = ref.question
  if (q.type === 'mcq') {
    const correctIndex = q.correctIndex
    function submit() {
      if (selected == null) return
      setSubmitted(true)
      onRecordBoardAttempt(q.id, selected === correctIndex, selected)
    }
    return (
      <SheetFrame index={index} total={refs.length} onClose={onClose} onPrev={prev} onNext={next}>
        <p dir="rtl" className="qq">
          {q.question}
        </p>
        <div className="opts" dir="rtl">
          {q.options.map((opt, i) => (
            <button
              key={i}
              type="button"
              className={
                !submitted
                  ? i === selected
                    ? 'opt sel'
                    : 'opt'
                  : i === correctIndex
                    ? 'opt right'
                    : i === selected
                      ? 'opt wrong'
                      : 'opt'
              }
              disabled={submitted}
              onClick={() => setSelected(i)}
            >
              {opt}
            </button>
          ))}
        </div>
        {!submitted ? (
          <button type="button" className="np-btn" disabled={selected == null} onClick={submit}>
            ثبت پاسخ
          </button>
        ) : (
          <>
            {q.explanation && <p dir="auto" className="np-small">{plainExplanation(q.explanation)}</p>}
            {q.chapterId && (
              <button type="button" className="np-btn ghost sm" onClick={() => onOpenInPractice(q.chapterId as string)}>
                باز کردن در Practice
              </button>
            )}
          </>
        )}
      </SheetFrame>
    )
  }

  // Any other board_questions type (true_false, fill_blank, matching, essay):
  // no option buttons to pick from here -- reveal, then self-grade, same as
  // Practice's own flow for these types.
  function selfGrade(gotItRight: boolean) {
    setSubmitted(true)
    onRecordBoardAttempt(q.id, gotItRight, NO_SELECTED_INDEX)
  }
  return (
    <SheetFrame index={index} total={refs.length} onClose={onClose} onPrev={prev} onNext={next}>
      <p dir="rtl" className="qq">
        {q.question}
      </p>
      {!revealed ? (
        <button type="button" className="np-btn" onClick={() => setRevealed(true)}>
          نشان بده
        </button>
      ) : (
        <>
          <p dir="rtl" className="np-small">
            {q.type === 'true_false'
              ? q.correctBool ? 'درست' : 'نادرست'
              : q.type === 'fill_blank'
                ? (q.fillAnswers ?? []).join(' · ')
                : q.modelAnswer ?? ''}
          </p>
          {q.explanation && <p dir="auto" className="np-small">{plainExplanation(q.explanation)}</p>}
          {!submitted && (
            <div className="form-actions">
              <button type="button" className="np-btn sm" onClick={() => selfGrade(true)}>
                درست پاسخ دادم
              </button>
              <button type="button" className="np-btn ghost sm" onClick={() => selfGrade(false)}>
                اشتباه پاسخ دادم
              </button>
            </div>
          )}
          {q.chapterId && (
            <button type="button" className="np-btn ghost sm" onClick={() => onOpenInPractice(q.chapterId as string)}>
              باز کردن در Practice
            </button>
          )}
        </>
      )}
    </SheetFrame>
  )
}

function SheetFrame({
  index,
  total,
  onClose,
  onPrev,
  onNext,
  children,
}: {
  index: number
  total: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  children: React.ReactNode
}) {
  return (
    <div className="qsheet-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="qsheet" dir="rtl">
        <div className="qsheet-head">
          <b>
            سؤال {index + 1} از {total}
          </b>
          <button type="button" className="np-btn ghost sm" onClick={onClose}>
            بستن
          </button>
        </div>
        {children}
        <div className="endrow">
          <button type="button" className="np-btn ghost" disabled={index === 0} onClick={onPrev}>
            قبلی
          </button>
          <button type="button" className="np-btn ghost" disabled={index + 1 >= total} onClick={onNext}>
            بعدی
          </button>
        </div>
      </div>
    </div>
  )
}
