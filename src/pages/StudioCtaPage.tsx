import '../styles/studioCta.css'
import { StudioCtaFooter } from '../components/StudioCtaFooter'

// Standalone demo page for the cinematic CTA+Footer section. Self-contained
// on purpose (own black background, own fonts/Tailwind import) since this
// section's look (and copy) is unrelated to the rest of the clinical app.
export function StudioCtaPage() {
  return (
    <div style={{ background: '#000' }}>
      <StudioCtaFooter />
    </div>
  )
}
