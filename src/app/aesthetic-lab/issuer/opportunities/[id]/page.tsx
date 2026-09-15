import Link from 'next/link'
import type { CSSProperties } from 'react'
import { CalendarDays, Plus, UsersRound } from 'lucide-react'
import { and, eq } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { orgs, tasks } from '@/lib/db/schema'
import { createShiftAction, updateTaskAction } from '@/app/actions'
import { getShiftsWithCounts } from '@/lib/services/opportunities'
import { getVolunteerPrograms } from '@/lib/services/volunteer-programs'
import { getProfile } from '@/lib/services/profile'
import { organizationBannerPalette } from '@/lib/profile/organization-appearance'
import { getLabWorkspace } from '../../../lab-workspace'
import { LabHeader } from '../../../LabHeader'
import { HistoryBackButton } from '../../../HistoryBackButton'
import { LabNotice } from '../../../LabNotice'
import { IssuerLabSidebar } from '../../IssuerLabSidebar'
import styles from '../../../prototype.module.css'

export const dynamic = 'force-dynamic'

type ManageEventPaletteVariables = CSSProperties & {
  '--program-palette-deep': string
  '--program-palette-mid': string
  '--program-palette-accent': string
  '--program-palette-accent-deep': string
}

function formatSessionDate(timestamp: number | null) {
  if (!timestamp) return 'Date and time to be confirmed'
  return new Date(timestamp).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export default async function ManageLabOpportunityPage({ params, searchParams }: { params: { id: string }; searchParams: { ok?: string; error?: string } }) {
  const session = await requireRole('issuer')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const orgId = session.orgId!
  const [org, task, volunteerPrograms, profile] = await Promise.all([
    db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1).then((rows) => rows[0] ?? null),
    db.select().from(tasks).where(and(eq(tasks.id, params.id), eq(tasks.orgId, orgId))).limit(1).then((rows) => rows[0] ?? null),
    getVolunteerPrograms(orgId),
    getProfile(orgId),
  ])
  const returnToCalendar = '/aesthetic-lab/issuer'
  const organizationPalette = organizationBannerPalette(profile?.bannerPalette)
  const manageEventPalette: ManageEventPaletteVariables = {
    '--program-palette-deep': organizationPalette.colors[0],
    '--program-palette-mid': organizationPalette.colors[1],
    '--program-palette-accent': organizationPalette.colors[2],
    '--program-palette-accent-deep': organizationPalette.colors[3],
  }

  if (!task) {
    return (
      <main className={styles.app}>
        <LabHeader activeSection="issuer-catalog" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
        <div className={styles.issuerLayout}>
          <IssuerLabSidebar organizationId={org?.id} organizationName={org?.name} cityName={city?.name} />
          <section className={styles.issuerMain} aria-label="Manage event">
            <div className={styles.programControlCenterShell} style={manageEventPalette}>
              <section className={`${styles.programControlCenterCard} ${styles.manageEventHeaderCard}`}>
                <div className={styles.programControlCenterHeading}>
                  <div><p className={styles.eyebrow}>{org?.name ?? 'Organization'} · Manage Event</p><h1>Event unavailable</h1><p>This event may have been removed or belongs to another organization.</p></div>
                  <div className={styles.programControlCenterActions}><HistoryBackButton fallback={returnToCalendar} /></div>
                </div>
              </section>
            </div>
          </section>
        </div>
      </main>
    )
  }

  const sessions = await getShiftsWithCounts(task.id)
  const redirectTo = `/aesthetic-lab/issuer/opportunities/${task.id}`
  const now = Date.now()
  const publicSessions = sessions.filter(({ shift }) => shift.status === 'open' && (!shift.endsAt || shift.endsAt >= now))
  const canPublish = task.status === 'open'

  return (
    <main className={styles.app}>
      <LabHeader activeSection="issuer-catalog" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
      <div className={styles.issuerLayout}>
        <IssuerLabSidebar organizationId={org?.id} organizationName={org?.name} cityName={city?.name} />
        <section className={`${styles.issuerMain} ${styles.manageEventMain}`} aria-label="Manage event" style={manageEventPalette}>
          <div className={styles.programControlCenterShell}>
            <section className={`${styles.programControlCenterCard} ${styles.manageEventHeaderCard}`}>
              <div className={styles.programControlCenterHeading}>
                <div><p className={styles.eyebrow}>{org?.name ?? 'Organization'} · Manage Event</p><h1>{task.title}</h1><p>Update the event details, review its scheduled sessions, and publish another time when your team is ready.</p></div>
                <div className={styles.programControlCenterActions}><HistoryBackButton fallback={returnToCalendar} /></div>
              </div>
            </section>
          </div>

          <LabNotice ok={searchParams.ok} error={searchParams.error} />

          <section className={`${styles.paletteTreatmentCard} ${styles.manageEventCard}`}>
            <form action={updateTaskAction} className={`${styles.labForm} ${styles.manageEventForm}`}>
              <input type="hidden" name="taskId" value={task.id} />
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <div className={`${styles.opportunityFormHeading} ${styles.paletteTreatmentHeader} ${styles.manageEventCardHeader}`}>
                <div><p className={styles.eyebrow}>Event Details</p></div>
                <span>{canPublish ? 'Active' : 'Closed'}</span>
              </div>
              <div className={`${styles.paletteTreatmentBody} ${styles.manageEventCardBody}`}>
                <div className={styles.manageEventCardLead}><h2>{task.title}</h2><p>Changes here update the reusable event details connected to every scheduled session.</p></div>
                <div className={styles.labFormGrid}>
                  <label>Event title<input name="title" required defaultValue={task.title} /></label>
                  <label>Default location<input name="location" required defaultValue={task.location} /></label>
                </div>
                <label>Volunteer program <span>(optional)</span><select name="programId" defaultValue={task.programId ?? ''}><option value="">Not assigned to a program</option>{volunteerPrograms.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</select><small>Keep this event connected to the program it supports.</small></label>
                <label>Description<textarea name="description" required defaultValue={task.description} /></label>
                <div className={styles.labFormActions}>
                  <Link className={`${styles.labLinkButton} ${styles.labLinkButtonSecondary}`} href={returnToCalendar}>Cancel</Link>
                  <button className={styles.labButton} type="submit">Save event details</button>
                </div>
              </div>
            </form>
          </section>

          <section className={`${styles.paletteTreatmentCard} ${styles.manageEventCard}`}>
            <div className={`${styles.opportunitySectionHeading} ${styles.paletteTreatmentHeader} ${styles.manageEventCardHeader}`}>
              <div><p className={styles.eyebrow}>Scheduled Sessions</p></div>
              <span>{publicSessions.length} live</span>
            </div>
            <div className={`${styles.paletteTreatmentBody} ${styles.manageEventCardBody}`}>
              <div className={styles.manageEventCardLead}><h2>Sessions connected to this event</h2><p>Review live, closed, and completed dates without leaving the event workspace.</p></div>
              {sessions.length ? <div className={styles.opportunitySessionList}>{sessions.map(({ shift, taken, slotsLeft }) => {
                const isLive = shift.status === 'open' && canPublish && (!shift.endsAt || shift.endsAt >= now)
                return <article className={styles.labChoice} key={shift.id}><div><p><strong><CalendarDays size={15} /> {formatSessionDate(shift.startsAt)}</strong></p><small>{shift.label || 'Scheduled session'} · {taken} reserved · {isLive ? `${slotsLeft} open` : 'closed or completed'}</small></div><div className={styles.opportunitySessionMeta}><span className={isLive ? styles.opportunityStatusOpen : styles.opportunityStatusClosed}>{isLive ? 'Published' : 'Closed'}</span><em><UsersRound size={15} /> {shift.capacity}</em></div></article>
              })}</div> : <div className={styles.opportunityEmptySchedule}><CalendarDays size={20} /><div><b>No session is published yet.</b><p>Save the event details now and publish a date below whenever volunteers can sign up.</p></div></div>}
            </div>
          </section>

          <section className={`${styles.paletteTreatmentCard} ${styles.manageEventCard}`}>
            <form action={createShiftAction} className={`${styles.labForm} ${styles.manageEventForm}`}>
              <input type="hidden" name="taskId" value={task.id} />
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <div className={`${styles.opportunitySectionHeading} ${styles.paletteTreatmentHeader} ${styles.manageEventCardHeader}`}>
                <div><p className={styles.eyebrow}>Schedule Another Session</p></div>
                <span>{canPublish ? 'Ready to publish' : 'Unavailable'}</span>
              </div>
              <div className={`${styles.paletteTreatmentBody} ${styles.manageEventCardBody}`}>
                <div className={styles.manageEventCardLead}><h2>Publish a time for volunteers</h2><p>Each session has its own date and capacity and appears on the participant board as soon as it is published.</p></div>
                <fieldset disabled={!canPublish} className={styles.opportunitySessionForm}>
                  <div className={styles.labFormGrid}><label>Starts<input type="datetime-local" name="shiftStartsAt" required /></label><label>Ends<input type="datetime-local" name="shiftEndsAt" required /></label></div>
                  <div className={styles.labFormGrid}><label>Capacity<input type="number" name="capacity" min="1" defaultValue={task.slots} required /></label><label>Session label<input name="shiftLabel" placeholder="Optional label" /></label></div>
                  <div className={styles.labFormActions}><button className={styles.labButton} type="submit"><Plus size={15} /> Publish session</button></div>
                </fieldset>
              </div>
            </form>
          </section>
        </section>
      </div>
    </main>
  )
}
