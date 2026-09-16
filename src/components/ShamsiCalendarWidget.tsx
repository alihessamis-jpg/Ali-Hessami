import { useState } from 'react'
import { jalaaliMonthGrid, SHAMSI_MONTHS, SHAMSI_WEEKDAYS, todayJalaali, toPersianDigits } from '../lib/shamsi'
import { CalendarIcon } from './icons'

export function ShamsiCalendarWidget() {
  const today = todayJalaali()
  const [jy, setJy] = useState(today.jy)
  const [jm, setJm] = useState(today.jm)

  function prevMonth() {
    if (jm === 1) {
      setJm(12)
      setJy((y) => y - 1)
    } else {
      setJm((m) => m - 1)
    }
  }

  function nextMonth() {
    if (jm === 12) {
      setJm(1)
      setJy((y) => y + 1)
    } else {
      setJm((m) => m + 1)
    }
  }

  const days = jalaaliMonthGrid(jy, jm)

  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <h2 className="dash-card-title">
          <span className="icon-chip">
            <CalendarIcon />
          </span>
          تقویم
        </h2>
        <span className="patient-meta">
          امروز: {toPersianDigits(today.jd)} {SHAMSI_MONTHS[today.jm - 1]} {toPersianDigits(today.jy)}
        </span>
      </div>

      <div className="shamsi-cal-nav">
        <button type="button" className="button-secondary" onClick={prevMonth} aria-label="ماه قبل">
          ‹
        </button>
        <strong>
          {SHAMSI_MONTHS[jm - 1]} {toPersianDigits(jy)}
        </strong>
        <button type="button" className="button-secondary" onClick={nextMonth} aria-label="ماه بعد">
          ›
        </button>
      </div>

      <div className="shamsi-cal-grid">
        {SHAMSI_WEEKDAYS.map((w) => (
          <span key={w} className="shamsi-cal-weekday">
            {w}
          </span>
        ))}
        {days.map((d, i) => {
          const isToday = d != null && jy === today.jy && jm === today.jm && d === today.jd
          return (
            <span
              key={i}
              className={`shamsi-cal-day ${d == null ? 'shamsi-cal-day--empty' : ''} ${
                isToday ? 'shamsi-cal-day--today' : ''
              }`}
            >
              {d != null ? toPersianDigits(d) : ''}
            </span>
          )
        })}
      </div>
    </div>
  )
}
