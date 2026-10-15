import { useState, type ComponentType, type SVGProps } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { StudyNotesPanel } from '../components/study/StudyNotesPanel'
import { FlashcardsPanel } from '../components/study/FlashcardsPanel'
import { ReasoningCasesPanel } from '../components/study/ReasoningCasesPanel'
import { LabChallengesPanel } from '../components/study/LabChallengesPanel'
import { ImagingChallengesPanel } from '../components/study/ImagingChallengesPanel'
import { KnowledgeGapsPanel } from '../components/study/KnowledgeGapsPanel'
import { PersonalCasesPanel } from '../components/study/PersonalCasesPanel'
import { ReadingReviewPanel } from '../components/study/ReadingReviewPanel'
import { BoardQuestionsPanel } from '../components/study/BoardQuestionsPanel'
import { AttendingConsultsPanel } from '../components/study/AttendingConsultsPanel'
import {
  CalendarIcon,
  ConsultIcon,
  FlashcardsIcon,
  ImagingIcon,
  KnowledgeGapIcon,
  LabsIcon,
  NotesIcon,
  PersonalCaseIcon,
  QuizIcon,
  ReasoningIcon,
} from '../components/icons'
import { HeroScene } from '../components/hero/HeroScene'

type Tab =
  | 'notes'
  | 'flashcards'
  | 'reasoning'
  | 'labChallenges'
  | 'imagingChallenges'
  | 'boardQuestions'
  | 'consults'
  | 'gaps'
  | 'cases'
  | 'reading'

const TABS: Array<{ id: Tab; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }> = [
  { id: 'notes', label: 'Study Notes', icon: NotesIcon },
  { id: 'flashcards', label: 'Flashcards', icon: FlashcardsIcon },
  { id: 'reasoning', label: 'Reasoning Cases', icon: ReasoningIcon },
  { id: 'labChallenges', label: 'Lab Challenges', icon: LabsIcon },
  { id: 'imagingChallenges', label: 'Imaging Challenges', icon: ImagingIcon },
  { id: 'boardQuestions', label: 'Board Questions', icon: QuizIcon },
  { id: 'consults', label: 'Attending Consults', icon: ConsultIcon },
  { id: 'gaps', label: 'Knowledge Gaps', icon: KnowledgeGapIcon },
  { id: 'cases', label: 'Personal Cases', icon: PersonalCaseIcon },
  { id: 'reading', label: 'Reading Reviews', icon: CalendarIcon },
]

export function StudyHubPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const initialTab = (params.get('tab') as Tab | null) ?? 'notes'
  const [tab, setTab] = useState<Tab>(TABS.some((t) => t.id === initialTab) ? initialTab : 'notes')
  const chapterIdParam = params.get('chapterId')

  return (
    <div className="np-page">
      <button type="button" className="np-backlink" onClick={() => navigate(-1)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
          <path d="m15 6-6 6 6 6" />
        </svg>
        Back
      </button>

      <section className="np-hero np-fade">
        <HeroScene scene="system" page="studyhub" className="hero-scene" />
        <div className="hero-scrim" />
        <div className="np-hrow">
          <div className="np-txt">
            <h1>Study Hub</h1>
            <p className="np-sub">Notes, cases, challenges and questions — all linked.</p>
          </div>
        </div>
      </section>

      <div className="sh-modes np-fade" style={{ animationDelay: '.08s' }}>
        {TABS.map((t) => {
          const TabIcon = t.icon
          return (
            <button key={t.id} type="button" className={t.id === tab ? 'sh-mode on' : 'sh-mode'} onClick={() => setTab(t.id)}>
              <TabIcon width={18} height={18} />
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="np-card np-fade" style={{ animationDelay: '.16s' }}>
        {tab === 'notes' && <StudyNotesPanel />}
        {tab === 'flashcards' && <FlashcardsPanel />}
        {tab === 'reasoning' && <ReasoningCasesPanel />}
        {tab === 'labChallenges' && <LabChallengesPanel />}
        {tab === 'imagingChallenges' && <ImagingChallengesPanel />}
        {tab === 'boardQuestions' && <BoardQuestionsPanel initialChapterId={chapterIdParam} />}
        {tab === 'consults' && <AttendingConsultsPanel />}
        {tab === 'gaps' && <KnowledgeGapsPanel />}
        {tab === 'cases' && <PersonalCasesPanel />}
        {tab === 'reading' && <ReadingReviewPanel />}
      </div>
    </div>
  )
}
