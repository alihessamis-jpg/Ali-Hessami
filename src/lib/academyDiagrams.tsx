import type { ComponentType } from 'react'
import { HusPathophysiologyDiagram } from '../components/academy/diagrams/HusPathophysiologyDiagram'
import type { AcademyTopic } from '../types/domain'

// Matched by name/category substring, the same way husWorkup.ts and
// examReadiness.ts match free-text topic names — there's no fixed taxonomy
// to key off of, so new diagrams just add an entry here.
const DIAGRAM_MATCHERS: Array<{ pattern: RegExp; component: ComponentType }> = [
  { pattern: /hemolytic uremic|\bHUS\b/i, component: HusPathophysiologyDiagram },
]

export function getAcademyDiagram(topic: Pick<AcademyTopic, 'name' | 'category'>): ComponentType | null {
  const haystack = `${topic.name} ${topic.category ?? ''}`
  const match = DIAGRAM_MATCHERS.find((m) => m.pattern.test(haystack))
  return match?.component ?? null
}
