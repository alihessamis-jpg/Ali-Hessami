import { useState } from 'react'
import { ShamsiCalendarWidget } from '../ShamsiCalendarWidget'
import { WeekStrip } from './WeekStrip'

// Collapsed by default to a glanceable current-week strip; "ماه کامل"
// expands it to the existing full-month ShamsiCalendarWidget, which gets
// a "نمای هفته" link back to the strip.
export function CalendarWidget() {
  const [expanded, setExpanded] = useState(false)
  return expanded ? (
    <ShamsiCalendarWidget onCollapse={() => setExpanded(false)} />
  ) : (
    <WeekStrip onExpand={() => setExpanded(true)} />
  )
}
