import { Link } from 'react-router-dom'
import { CalculatorIcon, ChecklistIcon, ReferenceIcon } from '../icons'

const TOOLS = [
  { to: '/calculators', label: 'Calculators', icon: CalculatorIcon },
  { to: '/checklists', label: 'Checklists', icon: ChecklistIcon },
  { to: '/reference', label: 'Reference', icon: ReferenceIcon },
]

export function QuickTools() {
  return (
    <section className="np-fade" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h2 style={{ margin: 0, padding: '0 4px', fontSize: 16, fontWeight: 700, color: '#0E1F3D' }}>Quick tools</h2>
      <div className="dh-tools">
        {TOOLS.map((tool) => {
          const ToolIcon = tool.icon
          return (
            <Link key={tool.to} to={tool.to} className="dh-tool">
              <ToolIcon width={22} height={22} />
              {tool.label}
            </Link>
          )
        })}
      </div>
    </section>
  )
}
