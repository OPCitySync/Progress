'use client'

import { useState } from 'react'
import { ChevronDown, Cloud, CloudRain, CloudSun, Sun, Wind, X } from 'lucide-react'
import styles from './prototype.module.css'

const forecast = [
  { day: 'Today', high: '68°', low: '54°', label: 'Mostly sunny', icon: CloudSun },
  { day: 'Thu', high: '66°', low: '53°', label: 'Morning fog', icon: Cloud },
  { day: 'Fri', high: '69°', low: '55°', label: 'Clear and mild', icon: Sun },
  { day: 'Sat', high: '70°', low: '56°', label: 'Bright skies', icon: Sun },
  { day: 'Sun', high: '67°', low: '54°', label: 'Coastal clouds', icon: CloudSun },
  { day: 'Mon', high: '65°', low: '53°', label: 'Light rain', icon: CloudRain },
  { day: 'Tue', high: '67°', low: '54°', label: 'Clearing late', icon: Wind },
]

export function WeatherWidget() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className={styles.weatherWidget}>
      <button
        className={styles.weatherTrigger}
        type="button"
        aria-label="Open Berkeley weather forecast"
        aria-expanded={isOpen}
        aria-controls="weekly-forecast"
        onClick={() => setIsOpen((open) => !open)}
      >
        <CloudSun size={20} />
        <span className={styles.weatherInfo}><b>Wed, Aug 12</b><small>Berkeley · 68°</small></span>
        <span className={styles.weatherCompact}>Aug 12 · 68°</span>
        <ChevronDown className={isOpen ? styles.weatherChevronOpen : undefined} size={15} />
      </button>

      {isOpen && (
        <section className={styles.weatherPopover} id="weekly-forecast" aria-label="Seven-day Berkeley forecast">
          <div className={styles.weatherPopoverTop}>
            <div><p className={styles.eyebrow}>Berkeley forecast</p><h2>This week</h2></div>
            <button type="button" aria-label="Close forecast" onClick={() => setIsOpen(false)}><X size={16} /></button>
          </div>
          <div className={styles.weatherNow}><CloudSun size={27} /><div><strong>68°</strong><span>Mostly sunny · H 68° / L 54°</span></div></div>
          <div className={styles.forecastList}>
            {forecast.map((day) => {
              const Icon = day.icon
              return <div key={day.day}><span>{day.day}</span><Icon size={17} /><small>{day.label}</small><b>{day.high}</b><em>{day.low}</em></div>
            })}
          </div>
        </section>
      )}
    </div>
  )
}
