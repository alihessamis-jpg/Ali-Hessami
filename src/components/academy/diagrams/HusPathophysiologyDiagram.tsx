// Schematic of HUS pathophysiology: the two trigger pathways converging on
// endothelial injury / microthrombi, which produces the classic triad.
// Pure inline SVG (no external assets) so it stays crisp at any size and
// follows the app's existing color tokens.
export function HusPathophysiologyDiagram() {
  return (
    <svg
      viewBox="0 0 640 300"
      role="img"
      aria-label="HUS pathophysiology: triggers lead to endothelial injury and microthrombi, producing the triad of hemolytic anemia, thrombocytopenia, and acute kidney injury"
    >
      <defs>
        <marker id="hus-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill="var(--text-muted)" />
        </marker>
      </defs>

      {/* trigger boxes */}
      <rect x="20" y="16" width="280" height="56" rx="10" fill="var(--danger-soft)" stroke="var(--danger)" strokeWidth="1.5" />
      <text x="160" y="39" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--danger)">
        Typical (diarrhea-associated)
      </text>
      <text x="160" y="57" textAnchor="middle" fontSize="12" fill="var(--danger)">
        Shiga toxin — E. coli O157:H7
      </text>

      <rect x="340" y="16" width="280" height="56" rx="10" fill="var(--warning-soft)" stroke="var(--warning)" strokeWidth="1.5" />
      <text x="480" y="39" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--warning)">
        Atypical (aHUS)
      </text>
      <text x="480" y="57" textAnchor="middle" fontSize="12" fill="var(--warning)">
        Complement dysregulation
      </text>

      {/* converging arrows into central box */}
      <path d="M160 72 V92 Q160 100 180 100 H300" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" markerEnd="url(#hus-arrow)" />
      <path d="M480 72 V92 Q480 100 460 100 H340" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" markerEnd="url(#hus-arrow)" />

      {/* central mechanism box */}
      <rect x="180" y="110" width="280" height="56" rx="10" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1.5" />
      <text x="320" y="133" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--accent-dark)">
        Endothelial injury
      </text>
      <text x="320" y="151" textAnchor="middle" fontSize="12" fill="var(--accent-dark)">
        Microthrombi (thrombotic microangiopathy)
      </text>

      {/* connector down to triad */}
      <path d="M320 166 V190" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" />
      <path d="M110 190 H530" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" />
      <path d="M110 190 V204" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" markerEnd="url(#hus-arrow)" />
      <path d="M320 190 V204" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" markerEnd="url(#hus-arrow)" />
      <path d="M530 190 V204" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" markerEnd="url(#hus-arrow)" />

      {/* triad boxes: MAHA, thrombocytopenia, AKI — consistent icon-top/title/subtitle layout */}
      <rect x="20" y="208" width="180" height="76" rx="10" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5" />
      {/* fragmented RBCs (schistocytes) — irregular shards, not whole cells */}
      <polygon points="99,221 109,219 105,231" fill="var(--danger)" opacity="0.85" />
      <polygon points="113,218 122,224 114,229" fill="var(--danger)" opacity="0.65" />
      <polygon points="104,233 115,235 108,240" fill="var(--danger)" opacity="0.5" />
      <text x="110" y="251" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="var(--text)">
        Microangiopathic
      </text>
      <text x="110" y="265" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="var(--text)">
        hemolytic anemia
      </text>
      <text x="110" y="279" textAnchor="middle" fontSize="10.5" fill="var(--text-muted)">
        schistocytes
      </text>

      <rect x="230" y="208" width="180" height="76" rx="10" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5" />
      <circle cx="313" cy="226" r="5.5" fill="var(--warning)" />
      <circle cx="326" cy="231" r="5.5" fill="var(--warning)" opacity="0.55" />
      <circle cx="316" cy="236" r="5.5" fill="var(--warning)" opacity="0.25" />
      <text x="320" y="258" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="var(--text)">
        Thrombocytopenia
      </text>
      <text x="320" y="272" textAnchor="middle" fontSize="10.5" fill="var(--text-muted)">
        platelets consumed in microthrombi
      </text>

      <rect x="440" y="208" width="180" height="76" rx="10" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5" />
      <svg x="518" y="216" width="24" height="24" viewBox="0 0 64 64" fill="none" stroke="var(--accent)" strokeWidth="5">
        <path d="M32 5c15 0 26 13 26 28S47 61 33 61c-8 0-15-4-19-11-2-4-1-8 3-10 5-3 5-9 0-12-4-2-5-6-3-10 4-7 11-13 18-13z" />
      </svg>
      <text x="530" y="258" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="var(--text)">
        Acute kidney injury
      </text>
      <text x="530" y="272" textAnchor="middle" fontSize="10.5" fill="var(--text-muted)">
        glomerular microthrombi
      </text>
    </svg>
  )
}
