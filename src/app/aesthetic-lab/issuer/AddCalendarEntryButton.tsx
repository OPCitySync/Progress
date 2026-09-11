'use client'

import { CalendarDays, CalendarPlus, ChevronDown, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { createOrganizationCalendarEntryAction } from '@/app/actions'
import styles from '../prototype.module.css'

function localInputValue(value: Date) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function initialRange(defaultDate?: number) {
  const start = defaultDate ? new Date(defaultDate) : new Date()
  start.setMinutes(0, 0, 0)
  if (defaultDate) start.setHours(9, 0, 0, 0)
  else start.setHours(start.getHours() + 1)
  return { start, end: new Date(start.getTime() + 60 * 60 * 1000) }
}

const calendarColors = ['blue', 'gold', 'mint', 'coral'] as const
type CalendarColor = typeof calendarColors[number]
const reminderOptions = [
  { value: 'none', label: 'No notification' },
  { value: 'at_start', label: 'At the start time' },
  { value: 'one_hour_before', label: 'One hour before' },
  { value: 'one_day_before', label: 'One day before' },
] as const
type Reminder = typeof reminderOptions[number]['value']
type CalendarDateField = 'start' | 'end'
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const weekdayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const pickerHours = Array.from({ length: 12 }, (_, index) => index + 1)
const pickerMinutes = Array.from({ length: 12 }, (_, index) => index * 5)

function calendarDaysForMonth(month: Date) {
  const gridStart = new Date(month.getFullYear(), month.getMonth(), 1 - new Date(month.getFullYear(), month.getMonth(), 1).getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart)
    day.setDate(gridStart.getDate() + index)
    return day
  })
}

function displayHour(value: Date) {
  return value.getHours() % 12 || 12
}

function displayDateTime(value: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value)
}

function withTime(value: Date, hour: number, minute: number, period: 'AM' | 'PM') {
  const next = new Date(value)
  const hour24 = hour === 12 ? (period === 'PM' ? 12 : 0) : (period === 'PM' ? hour + 12 : hour)
  next.setHours(hour24, minute, 0, 0)
  return next
}

function CalendarTimePart({ label, value, options, onChange }: { label: string, value: string, options: string[], onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false)

  return <div className={styles.issuerCalendarTimePart}>
    <span>{label}</span>
    <button type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}><b>{value}</b><ChevronDown size={12} aria-hidden="true" /></button>
    {open ? <div role="listbox" aria-label={`Choose ${label.toLowerCase()}`}>
      {options.map((option) => <button key={option} type="button" role="option" aria-selected={option === value} onClick={() => { onChange(option); setOpen(false) }}>{option}</button>)}
    </div> : null}
  </div>
}

export function CalendarDateTimePicker({ label, value, onChange, onCancel, onDone, doneLabel = 'Done', pending = false, children }: { label: string, value: Date, onChange: (value: Date) => void, onCancel: () => void, onDone: () => void, doneLabel?: string, pending?: boolean, children?: ReactNode }) {
  const [displayMonth, setDisplayMonth] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1))
  const days = calendarDaysForMonth(displayMonth)
  const hour = displayHour(value)
  const minute = value.getMinutes()
  const period = value.getHours() >= 12 ? 'PM' : 'AM'
  const today = new Date()

  const setTime = (nextHour = hour, nextMinute = minute, nextPeriod: 'AM' | 'PM' = period) => onChange(withTime(value, nextHour, nextMinute, nextPeriod))
  const selectDay = (day: Date) => {
    onChange(withTime(day, displayHour(value), value.getMinutes(), value.getHours() >= 12 ? 'PM' : 'AM'))
    setDisplayMonth(new Date(day.getFullYear(), day.getMonth(), 1))
  }

  return <section className={styles.issuerCalendarPickerPanel} aria-label={`${label} date and time picker`}>
    <div className={styles.issuerCalendarPickerHeader}>
      <button type="button" aria-label="Previous month" onClick={() => setDisplayMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>‹</button>
      <b>{monthNames[displayMonth.getMonth()]} {displayMonth.getFullYear()}</b>
      <button type="button" aria-label="Next month" onClick={() => setDisplayMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>›</button>
    </div>
    <div className={styles.issuerCalendarWeekdays}>{weekdayNames.map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
    <div className={styles.issuerCalendarPickerDays}>
      {days.map((day) => {
        const inMonth = day.getMonth() === displayMonth.getMonth()
        const selected = day.toDateString() === value.toDateString()
        const isToday = day.toDateString() === today.toDateString()
        return <button key={day.toISOString()} type="button" aria-pressed={selected} data-outside={!inMonth || undefined} data-today={isToday || undefined} onClick={() => selectDay(day)}>{day.getDate()}</button>
      })}
    </div>
    <div className={styles.issuerCalendarTimeControls}>
      <CalendarTimePart label="Hour" value={String(hour).padStart(2, '0')} options={pickerHours.map((option) => String(option).padStart(2, '0'))} onChange={(next) => setTime(Number(next))} />
      <CalendarTimePart label="Minute" value={String(minute).padStart(2, '0')} options={pickerMinutes.map((option) => String(option).padStart(2, '0'))} onChange={(next) => setTime(hour, Number(next))} />
      <CalendarTimePart label="Period" value={period} options={['AM', 'PM']} onChange={(next) => setTime(hour, minute, next as 'AM' | 'PM')} />
    </div>
    {children}
    <div className={styles.issuerCalendarPickerFooter}><span>{displayDateTime(value)}</span><div className={styles.issuerCalendarPickerFooterActions}><button type="button" disabled={pending} className={styles.issuerCalendarPickerCancel} onClick={onCancel}>Cancel</button><button type="button" disabled={pending} className={styles.issuerCalendarPickerDone} onClick={onDone}>{pending ? 'Publishing…' : doneLabel}</button></div></div>
  </section>
}

function CalendarColorDropdown() {
  const [color, setColor] = useState<CalendarColor>('blue')
  const [open, setOpen] = useState(false)

  return <div className={styles.issuerCalendarColorDropdown}>
    <span>Color</span>
    <input type="hidden" name="color" value={color} />
    <button type="button" aria-label={`Selected color: ${color}`} aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      <i data-calendar-color={color} aria-hidden="true" />
      <ChevronDown size={14} aria-hidden="true" />
    </button>
    {open ? <div role="listbox" aria-label="Choose event color">
      {calendarColors.map((option) => <button key={option} type="button" role="option" aria-label={option} aria-selected={color === option} onClick={() => { setColor(option); setOpen(false) }}>
        <i data-calendar-color={option} aria-hidden="true" />
      </button>)}
    </div> : null}
  </div>
}

function CalendarReminderDropdown() {
  const [reminder, setReminder] = useState<Reminder>('none')
  const [open, setOpen] = useState(false)
  const selected = reminderOptions.find((option) => option.value === reminder)!

  return <div className={styles.issuerCalendarReminderDropdown}>
    <span>Notification</span>
    <input type="hidden" name="reminder" value={reminder} />
    <button type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      <span>{selected.label}</span>
      <ChevronDown size={14} aria-hidden="true" />
    </button>
    {open ? <div role="listbox" aria-label="Choose event notification">
      {reminderOptions.map((option) => <button key={option.value} type="button" role="option" aria-selected={reminder === option.value} onClick={() => { setReminder(option.value); setOpen(false) }}>
        {option.label}
      </button>)}
    </div> : null}
  </div>
}

/** A compact modal for private, organization-owned planning entries. */
export function AddCalendarEntryButton({ defaultDate }: { defaultDate?: number }) {
  const [open, setOpen] = useState(false)
  const [startAt, setStartAt] = useState(() => initialRange(defaultDate).start)
  const [endAt, setEndAt] = useState(() => initialRange(defaultDate).end)
  const [pickerField, setPickerField] = useState<CalendarDateField | null>(null)
  const [pickerOriginalValue, setPickerOriginalValue] = useState<Date | null>(null)
  const [lastPickedField, setLastPickedField] = useState<CalendarDateField | null>(null)
  const openModal = () => {
    const initial = initialRange(defaultDate)
    setStartAt(initial.start)
    setEndAt(initial.end)
    setPickerField(null)
    setPickerOriginalValue(null)
    setLastPickedField(null)
    setOpen(true)
  }
  const openPicker = (field: CalendarDateField) => {
    setPickerOriginalValue(new Date(field === 'start' ? startAt : endAt))
    setPickerField(field)
  }
  const closePicker = (save: boolean) => {
    if (!pickerField) return
    if (!save && pickerOriginalValue) {
      if (pickerField === 'start') setStartAt(pickerOriginalValue)
      else setEndAt(pickerOriginalValue)
    }
    if (save) setLastPickedField(pickerField)
    setPickerOriginalValue(null)
    setPickerField(null)
  }

  return <>
    <button type="button" className={styles.issuerAddCalendarButton} onClick={openModal}>
      <CalendarPlus size={14} /> <span>Add to Calendar</span>
    </button>
    {open ? <div className={styles.issuerCalendarModalBackdrop} role="presentation" onMouseDown={() => setOpen(false)}>
      <section className={`${styles.issuerCalendarModal} ${pickerField ? styles.issuerCalendarModalPicker : ''}`} role="dialog" aria-modal="true" aria-label={pickerField ? 'Date and time picker' : 'Add an Event'} onMouseDown={(event) => event.stopPropagation()}>
        {pickerField ? null : <div className={styles.issuerCalendarModalHeading}>
          <div><p className={styles.eyebrow}>Organization calendar</p><h2 id="calendar-entry-title">Add Event</h2></div>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>}
        <form action={createOrganizationCalendarEntryAction} className={styles.issuerCalendarForm} onSubmit={() => setOpen(false)}>
          <input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer" />
          <input type="hidden" name="startsAt" value={localInputValue(startAt)} />
          <input type="hidden" name="endsAt" value={localInputValue(endAt)} />
          {pickerField ? <div className={styles.issuerCalendarPickerStage}>
            <CalendarDateTimePicker label={pickerField === 'start' ? 'Starts' : 'Ends'} value={pickerField === 'start' ? startAt : endAt} onChange={pickerField === 'start' ? setStartAt : setEndAt} onCancel={() => closePicker(false)} onDone={() => closePicker(true)} />
          </div> : null}
          <div className={styles.issuerCalendarFormStage} hidden={Boolean(pickerField)}>
            <label>Title<input name="title" required maxLength={140} placeholder="e.g. Confirm supply delivery" /></label>
            <label><span className={styles.issuerCalendarFieldLabel}><span>Details</span><em>(optional)</em></span><textarea name="details" maxLength={500} placeholder="Add context your team will need." /></label>
            <div className={styles.issuerCalendarDateGrid}>
              <div className={styles.issuerCalendarDatePicker} data-selected={lastPickedField === 'start' || undefined}><span>Starts</span><button type="button" className={styles.issuerCalendarDateTrigger} onClick={() => openPicker('start')}><CalendarDays size={14} aria-hidden="true" /><span>{displayDateTime(startAt)}</span><ChevronDown size={14} aria-hidden="true" /></button></div>
              <div className={styles.issuerCalendarDatePicker} data-selected={lastPickedField === 'end' || undefined}><span>Ends</span><button type="button" className={styles.issuerCalendarDateTrigger} onClick={() => openPicker('end')}><CalendarDays size={14} aria-hidden="true" /><span>{displayDateTime(endAt)}</span><ChevronDown size={14} aria-hidden="true" /></button></div>
            </div>
            <div className={styles.issuerCalendarSelectGrid}>
              <CalendarReminderDropdown />
              <CalendarColorDropdown />
            </div>
            <div className={styles.issuerCalendarFormActions}><button type="button" onClick={() => setOpen(false)}>Cancel</button><button type="submit"><CalendarPlus size={15} /> Add to calendar</button></div>
          </div>
        </form>
      </section>
    </div> : null}
  </>
}
