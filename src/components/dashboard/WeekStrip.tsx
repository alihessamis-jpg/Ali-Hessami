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
    <section className="np-card np-fade">
      <div className="np-head np-fa" dir="rtl">
        <div className="np-head-l">
          <span className="np-ic">
            <CalendarIcon />
          </span>
          <h2>
            تقویم · {SHAMSI_MONTHS[today.jm - 1]} {toPersianDigits(today.jy)}
          </h2>
        </div>
        <button type="button" className="link-button" onClick={onExpand}>
          ماه کامل
        </button>
      </div>
      <div className="dh-week" dir="rtl">
        {days.map((d, i) => (
          <div key={i} className={d.isToday ? 'now' : ''}>
            <span>{d.weekday}</span>
            <span style={{ fontSize: 15, fontWeight: d.isToday ? 700 : 400, color: !d.isToday && d.isHoliday ? '#B42318' : undefined }}>
              {d.day}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
