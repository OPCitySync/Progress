import Link from 'next/link'
import { ArrowLeft, CalendarDays, FileText, FolderKanban, Plus, Repeat2, UsersRound } from 'lucide-react'
import { and, eq } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { orgs, tasks } from '@/lib/db/schema'
import { closeTaskAction, createShiftAction, reopenTaskAction, updateTaskAction } from '@/app/actions'
import { getShiftsWithCounts } from '@/lib/services/opportunities'
import { getVolunteerPrograms } from '@/lib/services/volunteer-programs'
import { getLabWorkspace } from '../../../lab-workspace'
import { LabHeader } from '../../../LabHeader'
import { LabNotice } from '../../../LabNotice'
import { IssuerLabSidebar } from '../../IssuerLabSidebar'
import styles from '../../../prototype.module.css'

export const dynamic = 'force-dynamic'

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
  const [org, task, volunteerPrograms] = await Promise.all([
    db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1).then((rows) => rows[0] ?? null),
    db.select().from(tasks).where(and(eq(tasks.id, params.id), eq(tasks.orgId, orgId))).limit(1).then((rows) => rows[0] ?? null),
    getVolunteerPrograms(orgId),
  ])
  const returnToWorkspace = '/aesthetic-lab/issuer/catalog?workspace=opportunities'

  if (!task) {
    return (
      <main className={styles.app}>
        <LabHeader activeSection="issuer-catalog" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
        <section className={styles.primaryColumn}><p className={styles.emptyCopy}>This opportunity is unavailable.</p><Link href={returnToWorkspace}>Back to Workspace</Link></section>
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
        <section className={styles.issuerMain} aria-label="Workspace">
          <section className={styles.issuerPageHero}>
            <div><p className={styles.eyebrow}>Workspace · Opportunities</p><h1>Manage template.</h1><p>Update the reusable volunteer plan here. Its published sessions and past activity stay connected to it.</p></div>
            <Link href={returnToWorkspace} className={styles.catalogWorkspaceAction}><ArrowLeft size={15} /> Back to Workspace</Link>
          </section>

          <nav className={styles.workspaceSectionNav} aria-label="Workspace navigation">
            <Link href="/aesthetic-lab/issuer/catalog?workspace=programs"><FolderKanban size={15} /> Volunteer Programs</Link>
            <Link href="/aesthetic-lab/issuer/catalog?workspace=documentation"><FileText size={15} /> Documentation</Link>
            <Link href="/aesthetic-lab/issuer/catalog?workspace=onboarding"><Repeat2 size={15} /> Onboarding</Link>
            <Link href={redirectTo} data-active="true" aria-current="page"><UsersRound size={15} /> Opportunities</Link>
          </nav>

          <LabNotice hidden ok={searchParams.ok} error={searchParams.error} />

          <section className={styles.labPanel}>
            <div className={styles.templateManageStatus}>
              <span className={canPublish ? styles.opportunityStatusOpen : styles.opportunityStatusClosed}>{canPublish ? 'Active template' : 'Closed template'}</span>
              {canPublish ? <form action={closeTaskAction}><input type="hidden" name="taskId" value={task.id} /><input type="hidden" name="redirectTo" value={redirectTo} /><button className={`${styles.labLinkButton} ${styles.labLinkButtonSecondary}`} type="submit">Close template</button></form> : <form action={reopenTaskAction}><input type="hidden" name="taskId" value={task.id} /><input type="hidden" name="redirectTo" value={redirectTo} /><button className={`${styles.labLinkButton} ${styles.labLinkButtonSecondary}`} type="submit">Reopen template</button></form>}
            </div>
            <form action={updateTaskAction} className={styles.labForm}>
              <input type="hidden" name="taskId" value={task.id} />
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <div className={styles.opportunityFormHeading}>
                <div><p className={styles.eyebrow}>Template details</p><h2>{task.title}</h2></div>
              </div>
              <div className={styles.labFormGrid}>
                <label>Opportunity title<input name="title" required defaultValue={task.title} /></label>
                <label>Default location<input name="location" required defaultValue={task.location} /></label>
              </div>
              <label>Volunteer program <span>(optional)</span><select name="programId" defaultValue={task.programId ?? ''}><option value="">Not assigned to a program</option>{volunteerPrograms.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</select><small>Keep this template connected to the program it supports.</small></label>
              <label>Description<textarea name="description" required defaultValue={task.description} /></label>
              <div className={styles.labFormActions}>
                <Link className={`${styles.labLinkButton} ${styles.labLinkButtonSecondary}`} href={returnToWorkspace}>Cancel</Link>
                <button className={styles.labButton} type="submit">Save template</button>
              </div>
            </form>
          </section>

          <section className={`${styles.labPanel} ${styles.labStack}`}>
            <div className={styles.opportunitySectionHeading}>
              <div><p className={styles.eyebrow}>Published sessions</p><h2>Sessions volunteers can sign up for.</h2></div>
              <span>{publicSessions.length} live</span>
            </div>
            {sessions.length ? <div className={styles.opportunitySessionList}>{sessions.map(({ shift, taken, slotsLeft }) => {
              const isLive = shift.status === 'open' && canPublish && (!shift.endsAt || shift.endsAt >= now)
              return <article className={styles.labChoice} key={shift.id}><div><p><strong><CalendarDays size={15} /> {formatSessionDate(shift.startsAt)}</strong></p><small>{shift.label || 'Scheduled session'} · {taken} reserved · {isLive ? `${slotsLeft} open` : 'closed or completed'}</small></div><div className={styles.opportunitySessionMeta}><span className={isLive ? styles.opportunityStatusOpen : styles.opportunityStatusClosed}>{isLive ? 'Published' : 'Closed'}</span><em><UsersRound size={15} /> {shift.capacity}</em></div></article>
            })}</div> : <div className={styles.opportunityEmptySchedule}><CalendarDays size={20} /><div><b>No session is published yet.</b><p>Save this template now and publish a date below whenever volunteers can sign up.</p></div></div>}
          </section>

          <section className={styles.labPanel}>
            <form action={createShiftAction} className={styles.labForm}>
              <input type="hidden" name="taskId" value={task.id} />
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <div className={styles.opportunitySectionHeading}>
                <div><p className={styles.eyebrow}>Add a session</p><h2>Publish a time for volunteers.</h2><p>Each session has its own date and capacity. It becomes visible on the participant board as soon as it is published.</p></div>
                <span>{canPublish ? 'Ready to publish' : 'Reopen template first'}</span>
              </div>
              <fieldset disabled={!canPublish} className={styles.opportunitySessionForm}>
                <div className={styles.labFormGrid}><label>Starts<input type="datetime-local" name="shiftStartsAt" required /></label><label>Ends<input type="datetime-local" name="shiftEndsAt" required /></label></div>
                <div className={styles.labFormGrid}><label>Capacity<input type="number" name="capacity" min="1" defaultValue={task.slots} required /></label><label>Session label<input name="shiftLabel" placeholder="Optional label" /></label></div>
                <div className={styles.labFormActions}><button className={styles.labButton} type="submit"><Plus size={15} /> Publish session</button></div>
              </fieldset>
            </form>
          </section>
        </section>
      </div>
    </main>
  )
}
