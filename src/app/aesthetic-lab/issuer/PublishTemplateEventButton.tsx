'use client'

import { CalendarPlus, Repeat2, X } from 'lucide-react'
import { useState } from 'react'
import { publishTemplateEventAction } from '@/app/actions'
import styles from '../prototype.module.css'

function localDateTimeValue(timestamp: number) {
  const value = new Date(timestamp)
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset())
  return value.toISOString().slice(0, 16)
}

export function PublishTemplateEventButton({
  templates,
  redirectTo,
  suggestedStartsAt,
}: {
  templates: Array<{ id: string; title: string }>
  redirectTo: string
  suggestedStartsAt: number
}) {
  const [open, setOpen] = useState(false)
  const hasTemplates = templates.length > 0

  return <>
    <button
      type="button"
      className={styles.catalogWorkspaceAction}
      disabled={!hasTemplates}
      title={hasTemplates ? 'Publish an event from a saved template' : 'Create an opportunity template first'}
      onClick={() => setOpen(true)}
    ><CalendarPlus size={15} /> Publish event</button>
    {open ? <div className={styles.issuerCalendarModalBackdrop} role="presentation" onMouseDown={() => setOpen(false)}>
      <section className={styles.issuerCalendarModal} role="dialog" aria-modal="true" aria-labelledby="publish-template-event-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.issuerCalendarModalHeading}>
          <div><p className={styles.eyebrow}>Published schedule</p><h2 id="publish-template-event-title">Publish an event.</h2><p>Choose a saved opportunity and the time volunteers can join. The template supplies capacity; the event uses its most recent session length, or two hours for a new template.</p></div>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        <form action={publishTemplateEventAction} className={styles.issuerCalendarForm}>
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <label>Opportunity template
            <select name="taskId" required defaultValue="">
              <option value="" disabled>Select a template</option>
              {templates.map((template) => <option key={template.id} value={template.id}>{template.title}</option>)}
            </select>
          </label>
          <label>Date and time<input name="startsAt" type="datetime-local" required defaultValue={localDateTimeValue(suggestedStartsAt)} /></label>
          <label className={styles.onboardingRecurringChoice}><span><input type="checkbox" name="recurring" value="true" /> <Repeat2 size={15} /> Set up as recurring</span><small>City/Sync keeps one event public at a time. After it ends, the next weekly event will publish automatically.</small></label>
          <div className={styles.issuerCalendarFormActions}><button type="button" onClick={() => setOpen(false)}>Cancel</button><button type="submit"><CalendarPlus size={15} /> Publish event</button></div>
        </form>
      </section>
    </div> : null}
  </>
}
