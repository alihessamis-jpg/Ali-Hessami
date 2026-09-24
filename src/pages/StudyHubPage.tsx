import { useState, type ComponentType, type SVGProps } from 'react'
import { StudyNotesPanel } from '../components/study/StudyNotesPanel'
import { FlashcardsPanel } from '../components/study/FlashcardsPanel'
import { ReasoningCasesPanel } from '../components/study/ReasoningCasesPanel'
import { LabChallengesPanel } from '../components/study/LabChallengesPanel'
import { ImagingChallengesPanel } from '../components/study/ImagingChallengesPanel'
import { KnowledgeGapsPanel } from '../components/study/KnowledgeGapsPanel'
import { PersonalCasesPanel } from '../components/study/PersonalCasesPanel'
import { ReadingReviewPanel } from '../components/study/ReadingReviewPanel'
import { BoardQuestionsPanel } from '../components/study/BoardQuestionsPanel'
import {
  CalendarIcon,
  FlashcardsIcon,
  ImagingIcon,
  KnowledgeGapIcon,
  LabsIcon,
  NotesIcon,
  PersonalCaseIcon,
  QuizIcon,
  ReasoningIcon,
  StudyHubIcon,
} from '../components/icons'

type Tab =
  | 'notes'
  | 'flashcards'
  | 'reasoning'
  | 'labChallenges'
  | 'imagingChallenges'
  | 'boardQuestions'
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
  { id: 'gaps', label: 'Knowledge Gaps', icon: KnowledgeGapIcon },
  { id: 'cases', label: 'Personal Cases', icon: PersonalCaseIcon },
  { id: 'reading', label: 'Reading Reviews', icon: CalendarIcon },
]

export function StudyHubPage() {
  const [tab, setTab] = useState<Tab>('notes')

  return (
    <div>
      <h1 className="page-title">
        <span className="page-title-icon">
          <StudyHubIcon />
        </span>
        Study Hub
      </h1>
      <nav className="tab-bar">
        {TABS.map((t) => {
          const TabIcon = t.icon
          return (
            <button key={t.id} className={t.id === tab ? 'tab active' : 'tab'} onClick={() => setTab(t.id)}>
              <TabIcon />
              {t.label}
            </button>
          )
        })}
      </nav>
      <div className="tab-panel">
        {tab === 'notes' && <StudyNotesPanel />}
        {tab === 'flashcards' && <FlashcardsPanel />}
        {tab === 'reasoning' && <ReasoningCasesPanel />}
        {tab === 'labChallenges' && <LabChallengesPanel />}
        {tab === 'imagingChallenges' && <ImagingChallengesPanel />}
        {tab === 'boardQuestions' && <BoardQuestionsPanel />}
        {tab === 'gaps' && <KnowledgeGapsPanel />}
        {tab === 'cases' && <PersonalCasesPanel />}
        {tab === 'reading' && <ReadingReviewPanel />}
      </div>
    </div>
  )
}
