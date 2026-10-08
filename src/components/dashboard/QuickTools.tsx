import { Link } from 'react-router-dom'
import { CalculatorIcon, ChecklistIcon, ReferenceIcon } from '../icons'

const TOOLS = [
  { to: '/calculators', label: 'Calculators', icon: CalculatorIcon },
  { to: '/checklists', label: 'Checklists', icon: ChecklistIcon },
  { to: '/reference', label: 'Reference', icon: ReferenceIcon },
]

export function QuickTools() {
  return (
    <div>
      <p className="quick-tools-label">Quick tools</p>
      <div className="quick-tools-grid">
        {TOOLS.map((tool) => {
          const ToolIcon = tool.icon
          return (
            <Link key={tool.to} to={tool.to} className="quick-tool-card">
              <ToolIcon />
              {tool.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
