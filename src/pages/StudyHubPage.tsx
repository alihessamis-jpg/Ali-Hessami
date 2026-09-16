import { useState } from 'react'
import { StudyNotesPanel } from '../components/study/StudyNotesPanel'
import { FlashcardsPanel } from '../components/study/FlashcardsPanel'
import { ReasoningCasesPanel } from '../components/study/ReasoningCasesPanel'
import { LabChallengesPanel } from '../components/study/LabChallengesPanel'
import { ImagingChallengesPanel } from '../components/study/ImagingChallengesPanel'
import { KnowledgeGapsPanel } from '../components/study/KnowledgeGapsPanel'
import { PersonalCasesPanel } from '../components/study/PersonalCasesPanel'

type Tab = 'notes' | 'flashcards' | 'reasoning' | 'labChallenges' | 'imagingChallenges' | 'gaps' | 'cases'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'notes', label: 'Study Notes' },
  { id: 'flashcards', label: 'Flashcards' },
  { id: 'reasoning', label: 'Reasoning Cases' },
  { id: 'labChallenges', label: 'Lab Challenges' },
  { id: 'imagingChallenges', label: 'Imaging Challenges' },
  { id: 'gaps', label: 'Knowledge Gaps' },
  { id: 'cases', label: 'Personal Cases' },
]

export function StudyHubPage() {
  const [tab, setTab] = useState<Tab>('notes')

  return (
    <div>
      <h1>Study Hub</h1>
      <nav className="tab-bar">
        {TABS.map((t) => (
          <button key={t.id} className={t.id === tab ? 'tab active' : 'tab'} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      <div className="tab-panel">
        {tab === 'notes' && <StudyNotesPanel />}
        {tab === 'flashcards' && <FlashcardsPanel />}
        {tab === 'reasoning' && <ReasoningCasesPanel />}
        {tab === 'labChallenges' && <LabChallengesPanel />}
        {tab === 'imagingChallenges' && <ImagingChallengesPanel />}
        {tab === 'gaps' && <KnowledgeGapsPanel />}
        {tab === 'cases' && <PersonalCasesPanel />}
      </div>
    </div>
  )
}
