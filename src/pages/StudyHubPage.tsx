import { useState, type ComponentType, type SVGProps } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const [tab, setTab] = useState<Tab>('notes')

  return (
    <div className="np-page">
      <button type="button" className="np-backlink" onClick={() => navigate(-1)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
          <path d="m15 6-6 6 6 6" />
        </svg>
        Back
      </button>

      <section className="np-hero np-fade">
        <div className="np-glow blue" />
        <div className="np-hrow">
          <div className="np-txt">
            <h1>Study Hub</h1>
            <p className="np-sub">Notes, cases, challenges and questions — all linked.</p>
          </div>
          <svg className="np-art sh-net" viewBox="0 0 220 120" fill="none" aria-hidden="true">
            <g stroke="#2F5FB8" strokeWidth={2}>
              <path d="M110 60 40 22M110 60 34 100M110 60 180 18M110 60 192 96M110 60 110 8M40 22 34 100M180 18 192 96" />
            </g>
            <g className="sh-flow" stroke="#7FD4FF" strokeWidth={2} strokeDasharray="4 8" strokeLinecap="round">
              <path d="M110 60 40 22M110 60 34 100M110 60 180 18M110 60 192 96M110 60 110 8" />
            </g>
            <circle cx="110" cy="60" r="15" fill="#1E5BD8" stroke="#9CC2FF" strokeWidth={2} />
            <g className="sh-node"><circle cx="40" cy="22" r="7" fill="#FFC46B" /></g>
            <g className="sh-node" style={{ animationDelay: '.4s' }}><circle cx="34" cy="100" r="7" fill="#7FD4FF" /></g>
            <g className="sh-node" style={{ animationDelay: '.8s' }}><circle cx="180" cy="18" r="7" fill="#7FD4FF" /></g>
            <g className="sh-node" style={{ animationDelay: '1.2s' }}><circle cx="192" cy="96" r="7" fill="#FFC46B" /></g>
            <g className="sh-node" style={{ animationDelay: '1.6s' }}><circle cx="110" cy="8" r="5" fill="#9CC2FF" /></g>
          </svg>
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
        {tab === 'boardQuestions' && <BoardQuestionsPanel />}
        {tab === 'consults' && <AttendingConsultsPanel />}
        {tab === 'gaps' && <KnowledgeGapsPanel />}
        {tab === 'cases' && <PersonalCasesPanel />}
        {tab === 'reading' && <ReadingReviewPanel />}
      </div>
    </div>
  )
}
