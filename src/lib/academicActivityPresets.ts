export const ACADEMIC_ACTIVITY_CATEGORIES = [
  'Conference',
  'Journal Club',
  'Presentation',
  'Poster',
  'Manuscript',
  'Course / Workshop',
  'Committee / Guideline work',
  'Other',
]

export const ACADEMIC_ACTIVITY_ROLES: Array<{ value: string; label: string }> = [
  { value: 'presenter', label: 'Presenter' },
  { value: 'author', label: 'Author' },
  { value: 'co_author', label: 'Co-author' },
  { value: 'attendee', label: 'Attendee' },
  { value: 'organizer', label: 'Organizer' },
  { value: 'reviewer', label: 'Reviewer' },
]

export const ACADEMIC_ACTIVITY_STATUSES: Array<{ value: string; label: string }> = [
  { value: 'planned', label: 'Planned' },
  { value: 'completed', label: 'Completed' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under review' },
  { value: 'revision_requested', label: 'Revision requested' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'published', label: 'Published' },
  { value: 'rejected', label: 'Rejected' },
]

// Statuses that count as an in-progress manuscript for the summary strip.
export const MANUSCRIPT_IN_PROGRESS_STATUSES = ['submitted', 'under_review', 'revision_requested']
