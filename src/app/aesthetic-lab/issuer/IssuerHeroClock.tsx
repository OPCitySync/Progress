'use client'

import { useEffect, useState } from 'react'

function formattedLocalTime() {
  const now = new Date()
  const hour = now.getHours() % 12 || 12
  return [hour, now.getMinutes(), now.getSeconds()]
    .map((part) => String(part).padStart(2, '0'))
    .join(':')
}

export function IssuerHeroClock({ className }: { className: string }) {
  // Start at zero so the server and browser render the same first frame, then
  // move to the visitor's local clock once the component is mounted.
  const [time, setTime] = useState('00:00:00')

  useEffect(() => {
    let interval: number | undefined
    const update = () => setTime(formattedLocalTime())
    const start = window.setTimeout(() => {
      update()
      interval = window.setInterval(update, 1000)
    }, 1000 - new Date().getMilliseconds())

    update()
    return () => {
      window.clearTimeout(start)
      if (interval) window.clearInterval(interval)
    }
  }, [])

  return <div className={className} role="timer" aria-label={`Current local time: ${time}`}><span>{time}</span></div>
}
