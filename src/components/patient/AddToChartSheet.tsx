import { LabsIcon, MedicationsIcon, NotesIcon, ImagingIcon, DocumentIcon, RemindersIcon, GrowthIcon } from '../icons'
import type { ComponentType, SVGProps } from 'react'
import type { Tab } from '../../pages/PatientDetailPage'

interface Props {
  open: boolean
  patientName: string
  onClose: () => void
  onNavigate: (tab: Tab) => void
}

const ITEMS: Array<{ tab: Tab; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }> = [
  { tab: 'growth', label: 'Vitals', icon: GrowthIcon },
  { tab: 'labs', label: 'Labs', icon: LabsIcon },
  { tab: 'notes', label: 'Progress note', icon: NotesIcon },
  { tab: 'medications', label: 'Medication', icon: MedicationsIcon },
  { tab: 'imaging', label: 'Imaging', icon: ImagingIcon },
  { tab: 'document', label: 'Document / photo', icon: DocumentIcon },
  { tab: 'reminders', label: 'Reminder', icon: RemindersIcon },
]

export function AddToChartSheet({ open, patientName, onClose, onNavigate }: Props) {
  if (!open) return null

  return (
    <>
      <div className="pc-sheet-bg" onClick={onClose} />
      <div className="pc-sheet" role="dialog" aria-label="Add to chart">
        <div style={{ width: 40, height: 5, borderRadius: 3, background: '#D5DEEB', alignSelf: 'center' }} />
        <div className="np-head">
          <h2 style={{ fontSize: 17 }}>
            Add to <span className="fa">{patientName}</span>
          </h2>
          <button type="button" className="np-btn ghost sm" style={{ width: 44, padding: 0 }} aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="pc-qa">
          {ITEMS.map((item) => {
            const ItemIcon = item.icon
            return (
              <button key={item.tab} type="button" className="pc-qai" onClick={() => onNavigate(item.tab)}>
                <span className="np-ic">
                  <ItemIcon />
                </span>
                {item.label}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
