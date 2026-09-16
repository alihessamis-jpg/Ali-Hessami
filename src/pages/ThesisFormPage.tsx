import { FormBuilderIcon } from '../components/icons'

const FORM_URL = 'https://form.jotform.com/262572154225050'

export function ThesisFormPage() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          <span className="page-title-icon">
            <FormBuilderIcon />
          </span>
          Thesis Data Collection
        </h1>
        <a href={FORM_URL} target="_blank" rel="noreferrer" className="button-link">
          Open in new tab
        </a>
      </div>
      <p className="empty-state">
        Master Pediatric Hemodialysis Volume Assessment — hosted on Jotform. Submissions go straight to your
        Jotform account; this page just embeds it so you don't have to leave the app to collect data.
      </p>
      <iframe
        src={FORM_URL}
        title="Master Pediatric Hemodialysis Volume Assessment"
        style={{
          width: '100%',
          minHeight: '80vh',
          border: '1px solid var(--border)',
          borderRadius: 10,
          background: 'var(--surface)',
        }}
      />
    </div>
  )
}
