import { toJalaali } from 'jalaali-js'
import { SHAMSI_MONTHS, SHAMSI_WEEKDAYS, todayJalaali, toPersianDigits } from '../../lib/shamsi'
import { CalendarIcon } from '../icons'

interface WeekDay {
  weekday: string
  day: string
  isToday: boolean
  isHoliday: boolean
}

function currentWeekDays(): WeekDay[] {
  const now = new Date()
  const today = todayJalaali()
  const weekdayIndex = (now.getDay() + 1) % 7 // 0 = Saturday … 6 = Friday, matching SHAMSI_WEEKDAYS
  const days: WeekDay[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(now)
    d.setDate(now.getDate() - weekdayIndex + i)
    const { jy, jm, jd } = toJalaali(d)
    days.push({
      weekday: SHAMSI_WEEKDAYS[i],
      day: toPersianDigits(jd),
      isToday: jy === today.jy && jm === today.jm && jd === today.jd,
      isHoliday: i === 6, // Friday
    })
  }
  return days
}

export function WeekStrip({ onExpand }: { onExpand: () => void }) {
  const today = todayJalaali()
  const days = currentWeekDays()

  return (
    <div className="dash-card">
      <div className="dash-card-header week-strip-header">
        <button type="button" className="link-button" onClick={onExpand}>
          ماه کامل
        </button>
        <h2 className="dash-card-title">
          <span className="icon-chip">
            <CalendarIcon />
          </span>
          تقویم {toPersianDigits(today.jy)} · {SHAMSI_MONTHS[today.jm - 1]}
        </h2>
      </div>
      <div className="week-strip-grid" dir="rtl">
        {days.map((d, i) => (
          <span
            key={i}
            className={`week-strip-day ${d.isHoliday ? 'week-strip-day--holiday' : ''} ${
              d.isToday ? 'week-strip-day--today' : ''
            }`}
          >
            <span>{d.weekday}</span>
            <strong>{d.day}</strong>
          </span>
        ))}
      </div>
    </div>
  )
}
