import Link from 'next/link'
import { and, desc, eq } from 'drizzle-orm'
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Copy,
  Edit3,
  MapPin,
  MoreHorizontal,
  Plus,
  Repeat2,
  UsersRound,
} from 'lucide-react'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { orgs, tasks } from '@/lib/db/schema'
import { getShiftsWithCounts } from '@/lib/services/opportunities'
import { aggregateOpportunities, getEditorProfile } from '@/lib/services/profile'
import { LabHeader } from '../../LabHeader'
import { getLabWorkspace } from '../../lab-workspace'
import { IssuerLabSidebar } from '../IssuerLabSidebar'
import styles from '../../prototype.module.css'

export const dynamic = 'force-dynamic'

function duration(from: number | null, to: number | null) {
  if (!from || !to || to <= from) return 'Time TBD'
  const minutes = Math.round((to - from) / 60_000)
  return minutes % 60 === 0 ? `${minutes / 60} hour${minutes === 60 ? '' : 's'}` : `${minutes} minutes`
}

export default async function IssuerCatalogLabPage() {
  const session = await requireRole('issuer')
  const { city, contexts } = await getLabWorkspace(session)
  const orgId = session.orgId!
  const [org, taskRows] = await Promise.all([
    db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1).then((rows) => rows[0] ?? null),
    city
      ? db.select().from(tasks).where(and(eq(tasks.orgId, orgId), eq(tasks.cityId, city.id))).orderBy(desc(tasks.createdAt))
      : Promise.resolve([]),
  ])
  const profile = org ? await getEditorProfile(org) : null
  const aggregate = await aggregateOpportunities(taskRows)
  const taskShifts = await Promise.all(taskRows.map(async (task) => ({ task, sessions: await getShiftsWithCounts(task.id) })))
  const onboarding = profile?.onboardingTaskId ? taskShifts.find(({ task }) => task.id === profile.onboardingTaskId) : taskShifts.find(({ task }) => /onboard|orientation/i.test(task.title))

  return (
    <main className={styles.app}>
      <LabHeader activeSection="issuer-catalog" workspace="issuer" session={session} city={city} contexts={contexts} />
      <div className={styles.issuerLayout}>
        <IssuerLabSidebar active="catalog" organizationName={org?.name} cityName={city?.name} />

        <section className={styles.issuerMain} aria-label="Opportunity Catalog">
          <section className={styles.issuerPageHero}>
            <div><p className={styles.eyebrow}>Opportunity catalog</p><h1>Make it easy to say yes.</h1><p>Turn repeatable work into clear, shareable opportunities your volunteers can confidently claim.</p></div>
            <Link href="/issuer/catalog" className={styles.issuerPrimaryAction}><Plus size={18} /> New opportunity</Link>
          </section>

          <section className={styles.onboardingWorkspaceCard}>
            <div className={styles.onboardingWorkspaceHeading}><span><Repeat2 size={20} /></span><div><p className={styles.eyebrow}>Recurring onboarding</p><h2>{onboarding?.task.title ?? 'No onboarding session yet'}</h2><p>{onboarding ? 'This is the first step for prospective City Members.' : 'Create a recurring orientation so new participants have a clear first step.'}</p></div><Link href="/issuer/catalog"><Edit3 size={15} /> {onboarding ? 'Edit session' : 'Create session'}</Link></div>
            {onboarding ? <>
              <div className={styles.onboardingSessionGrid}>
                <div><span>Schedule</span><b>{onboarding.sessions[0]?.shift.startsAt ? new Date(onboarding.sessions[0].shift.startsAt).toLocaleString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit' }) : 'Time TBD'}</b></div>
                <div><span>Weekly capacity</span><b>{onboarding.sessions[0]?.shift.capacity ?? onboarding.task.slots} participants</b></div>
                <div><span>Default location</span><b>{onboarding.task.location || profile?.location || 'Location TBD'}</b></div>
              </div>
              <div className={styles.upcomingSessions}>
                {onboarding.sessions.slice(0, 3).map(({ shift, taken }) => <article key={shift.id}><CalendarDays size={16} /><b>{shift.startsAt ? new Date(shift.startsAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase() : 'TBD'}</b><span>{shift.startsAt ? new Date(shift.startsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'Time TBD'}</span><em>{taken} of {shift.capacity} reserved</em><Link href={`/issuer/tasks/${onboarding.task.id}`} aria-label={`Manage ${onboarding.task.title}`}><MoreHorizontal size={19} /></Link></article>)}
              </div>
            </> : null}
          </section>

          <section className={styles.catalogWorkspaceCard}>
            <div className={styles.issuerPanelHeading}>
              <div><p className={styles.eyebrow}>Your opportunities</p><h2>Build once, schedule when ready.</h2></div>
              <Link href="/issuer/catalog" className={styles.issuerTextButton}><Plus size={15} /> New opportunity</Link>
            </div>
            <div className={styles.templateGrid}>
              {taskShifts.length === 0 ? <p className={styles.emptyCopy}>Your opportunities will appear here once you publish them.</p> : taskShifts.map(({ task, sessions }) => {
                const card = aggregate.get(task.id)
                const isOnboarding = task.id === onboarding?.task.id
                const first = sessions[0]?.shift
                return <article key={task.id} className={styles.templateCard}>
                  <div className={`${styles.templateGlyph} ${styles[isOnboarding ? 'gold' : 'blue']}`}>{isOnboarding ? <CheckCircle2 size={18} /> : <UsersRound size={18} />}</div>
                  <div className={styles.templateTitle}><span>{isOnboarding ? 'Onboarding' : task.status === 'open' ? 'Volunteer shift' : task.status}</span><Link href={`/issuer/tasks/${task.id}`} aria-label={`Manage ${task.title}`}><MoreHorizontal size={19} /></Link></div>
                  <h3>{task.title}</h3><p>{task.description || 'No description has been added yet.'}</p>
                  <div className={styles.templateMeta}><span><MapPin size={13} /> {task.location || profile?.location || 'Location TBD'}</span><span><Clock3 size={13} /> {duration(first?.startsAt ?? null, first?.endsAt ?? null)}</span></div>
                  <div className={styles.templateActions}><Link href={`/issuer/tasks/${task.id}`}><Copy size={14} /> Manage</Link><Link href={`/issuer/tasks/${task.id}`}><CalendarDays size={14} /> {card?.openShiftCount ?? 0} sessions</Link></div>
                </article>
              })}
            </div>
          </section>

          <section className={styles.catalogFootnote}>
            <div><p className={styles.eyebrow}>Ready to publish</p><h2>Every scheduled opportunity carries the right context.</h2><p>Location, capacity, onboarding requirements, and your current waiver travel with the listing automatically.</p></div>
            <Link href="/issuer/catalog">Review public opportunities <ArrowUpRight size={15} /></Link>
          </section>
        </section>
      </div>
    </main>
  )
}
