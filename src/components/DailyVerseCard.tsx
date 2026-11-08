import { Link } from 'react-router-dom'
import { shamsiWeekdayLabel } from '../lib/dailyVerse'
import { toPersianDigits } from '../lib/shamsi'

export function DailyVerseCard({
  date,
  poet,
  line1,
  line2,
  source,
  savedCount,
  notice,
}: {
  date: string
  poet: string
  line1: string
  line2: string
  source?: string | null
  savedCount: number
  notice?: string | null
}) {
  return (
    <section className="np-card np-fade vs-today" style={{ animationDelay: '0.05s' }} dir="rtl">
      <div className="np-head">
        <div className="np-head-l">
          <span className="vs-quill" aria-hidden="true">
            ❦
          </span>
          <h2 className="np-fa">بیت امروز</h2>
        </div>
        <span className="np-pill np-fa" style={{ color: '#7A4A0B', background: '#FBEFD9' }}>
          {shamsiWeekdayLabel(date)}
        </span>
      </div>

      <div className="vs-beyt">
        <p className="vs-mesra">{line1}</p>
        <p className="vs-mesra vs-mesra-2">{line2}</p>
      </div>

      <p className="vs-poet np-fa">
        — {poet}
        {source ? <span className="np-small"> · {source}</span> : null}
      </p>

      {notice && <p className="np-small np-fa">{notice}</p>}

      <Link to="/verses" className="td-outline np-fa">
        دفتر ابیات{savedCount > 0 ? ` · ${toPersianDigits(savedCount)} بیت` : ''}
      </Link>
    </section>
  )
}
