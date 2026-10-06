// Decision tree for differentiating RTA type in a child with non-anion-gap
// (hyperchloremic) metabolic acidosis: serum K+ splits off type 4, then
// urine pH splits proximal (type 2) from distal (type 1).
export function RtaDifferentiationDiagram() {
  return (
    <svg
      viewBox="0 0 820 440"
      role="img"
      aria-label="RTA differentiation: non-anion-gap metabolic acidosis, branching on serum potassium then urine pH to reach type 4, type 2 (proximal), or type 1 (distal) RTA"
    >
      <defs>
        <marker id="rta-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill="var(--text-muted)" />
        </marker>
      </defs>

      {/* top box */}
      <rect x="200" y="16" width="360" height="50" rx="10" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1.5" />
      <text x="380" y="36" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--accent-dark)">
        Non-anion-gap (hyperchloremic)
      </text>
      <text x="380" y="54" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--accent-dark)">
        metabolic acidosis
      </text>

      <path d="M380 66 V96" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" markerEnd="url(#rta-arrow)" />

      {/* decision 1 */}
      <rect x="280" y="96" width="200" height="48" rx="10" fill="var(--surface-tint)" stroke="var(--accent)" strokeWidth="1.5" />
      <text x="380" y="125" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--accent-dark)">
        Serum potassium?
      </text>

      {/* branch to type 4 */}
      <path d="M330 144 L150 210" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" markerEnd="url(#rta-arrow)" />
      <rect x="206" y="160" width="76" height="20" rx="4" fill="var(--surface)" />
      <text x="244" y="174" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--danger)">
        High K+
      </text>

      {/* branch to decision 2 */}
      <path d="M430 144 L610 210" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" markerEnd="url(#rta-arrow)" />
      <rect x="455" y="160" width="130" height="20" rx="4" fill="var(--surface)" />
      <text x="520" y="174" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--text-muted)">
        Low / normal K+
      </text>

      {/* type 4 outcome box */}
      <rect x="20" y="210" width="260" height="96" rx="10" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5" />
      <text x="150" y="235" textAnchor="middle" fontSize="13.5" fontWeight="700" fill="var(--text)">
        Type 4 RTA
      </text>
      <text x="150" y="253" textAnchor="middle" fontSize="11.5" fill="var(--text-muted)">
        Hyporeninemic
      </text>
      <text x="150" y="267" textAnchor="middle" fontSize="11.5" fill="var(--text-muted)">
        hypoaldosteronism
      </text>
      <text x="150" y="288" textAnchor="middle" fontSize="10.5" fill="var(--text-muted)">
        ↓ aldosterone effect → ↓ H+/K+ secretion
      </text>

      {/* decision 2 */}
      <rect x="500" y="210" width="220" height="48" rx="10" fill="var(--surface-tint)" stroke="var(--accent)" strokeWidth="1.5" />
      <text x="610" y="239" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--accent-dark)">
        Urine pH?
      </text>

      {/* branch to type 2 */}
      <path d="M560 258 L500 330" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" markerEnd="url(#rta-arrow)" />
      <rect x="440" y="282" width="100" height="20" rx="4" fill="var(--surface)" />
      <text x="490" y="296" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--text-muted)">
        pH &lt; 5.5
      </text>

      {/* branch to type 1 */}
      <path d="M660 258 L720 330" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" markerEnd="url(#rta-arrow)" />
      <rect x="665" y="282" width="110" height="20" rx="4" fill="var(--surface)" />
      <text x="720" y="296" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--text-muted)">
        pH ≥ 5.5
      </text>

      {/* type 2 outcome box */}
      <rect x="400" y="330" width="200" height="96" rx="10" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5" />
      <text x="500" y="355" textAnchor="middle" fontSize="13.5" fontWeight="700" fill="var(--text)">
        Type 2 RTA
      </text>
      <text x="500" y="373" textAnchor="middle" fontSize="11.5" fill="var(--text-muted)">
        Proximal — bicarbonate
      </text>
      <text x="500" y="387" textAnchor="middle" fontSize="11.5" fill="var(--text-muted)">
        wasting
      </text>
      <text x="500" y="408" textAnchor="middle" fontSize="10.5" fill="var(--text-muted)">
        ↓ proximal HCO3– reabsorption
      </text>

      {/* type 1 outcome box */}
      <rect x="610" y="330" width="200" height="96" rx="10" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5" />
      <text x="710" y="355" textAnchor="middle" fontSize="13.5" fontWeight="700" fill="var(--text)">
        Type 1 RTA
      </text>
      <text x="710" y="373" textAnchor="middle" fontSize="11.5" fill="var(--text-muted)">
        Distal — impaired
      </text>
      <text x="710" y="387" textAnchor="middle" fontSize="11.5" fill="var(--text-muted)">
        acidification
      </text>
      <text x="710" y="408" textAnchor="middle" fontSize="10.5" fill="var(--text-muted)">
        urine pH inappropriately high
      </text>
    </svg>
  )
}
