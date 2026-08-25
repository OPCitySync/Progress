import Link from 'next/link'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { ArrowUpRight, Bookmark, Building2, CalendarDays, CheckCircle2, Heart, MapPin, Sparkles, UsersRound } from 'lucide-react'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { cities as cityNetworks, claims, orgs, shifts, tasks } from '@/lib/db/schema'
import { getParticipantOrganizations } from '@/lib/services/participant-workspace'
import { getMyResume } from '@/lib/services/resume'
import { getLabWorkspace } from '../lab-workspace'
import { LabHeader } from '../LabHeader'
import styles from '../prototype.module.css'

export const dynamic = 'force-dynamic'

function sessionTime(startsAt: number | null, endsAt: number | null) {
  if (!startsAt) return 'Time to be confirmed'
  const start = new Date(startsAt).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const end = endsAt ? new Date(endsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''
  return end ? `${start}–${end}` : start
}

function commitmentState(status: 'claimed' | 'submitted') {
  return status === 'submitted'
    ? { label: 'Awaiting verification', detail: 'The organization is reviewing your completed shift.' }
    : { label: 'Reserved', detail: 'Your place is held for this scheduled session.' }
}

/** A participant-owned list of every active reservation, across City Networks. */
export default async function CommitmentsPage() {
  const session = await requireRole('participant')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const [resume, joinedOrganizations, commitmentRows] = await Promise.all([
    getMyResume(session.sub),
    getParticipantOrganizations(session.sub),
    db
      .select({ claim: claims, task: tasks, organization: orgs, shift: shifts, city: cityNetworks })
      .from(claims)
      .innerJoin(tasks, eq(claims.taskId, tasks.id))
      .innerJoin(orgs, eq(tasks.orgId, orgs.id))
      .innerJoin(shifts, eq(claims.shiftId, shifts.id))
      .leftJoin(cityNetworks, eq(tasks.cityId, cityNetworks.id))
      .where(and(eq(claims.userId, session.sub), inArray(claims.status, ['claimed', 'submitted'])))
      .orderBy(asc(shifts.startsAt), asc(shifts.createdAt)),
  ])

  const participation = city?.participation?.status
  const cityLabel = city ? (city.id === 'mexico-city' ? 'Mexico City, Mexico' : `${city.name}, California`) : 'Choose a city'

  return <main className={styles.app}>
    <LabHeader activeSection="opportunities" session={session} city={city} cities={cities} contexts={contexts} />

    <section className={`${styles.detailLayout} ${styles.commitmentsLayout}`}>
      <aside className={styles.leftRail}>
        <section className={styles.profileCard}>
          <div className={styles.profileCover}><i /><i /><i /></div>
          <div className={styles.profileBody}>
            <div className={styles.avatarLarge}>{session.name.slice(0, 1).toUpperCase() || 'U'}</div>
            <div className={styles.profileTitle}><p className={styles.eyebrow}>Civic participant</p><h2>{session.name}</h2><p>{cityLabel}</p></div>
            <div className={styles.membershipStatus}>
              <span><Sparkles size={15} /> {participation === 'active' ? 'City Member' : participation === 'barred' ? 'Participation restricted' : 'New participant'}</span>
              <p>{participation === 'active' ? 'Your local participation is verified.' : participation === 'barred' ? 'Your participation is temporarily paused.' : 'Complete one local onboarding session to become a City Member.'}</p>
              <div><i /><i /><i /></div>
              <Link href="/aesthetic-lab/opportunities">Find onboarding <ArrowUpRight size={14} /></Link>
            </div>
          </div>
        </section>

        <section className={styles.quickLinks}>
          <p className={styles.eyebrow}>Quick Actions</p>
          <Link href="/aesthetic-lab/commitments"><CalendarDays size={17} /> My Commitments</Link>
          <Link href="/aesthetic-lab/organizations"><Building2 size={17} /> Discover organizations</Link>
          <Link href="/aesthetic-lab/opportunities?saved=1"><Heart size={17} /> Saved opportunities</Link>
        </section>

        <section className={styles.impactCard}>
          <p className={styles.eyebrow}>My impact</p>
          <div className={styles.impactGrid}>
            <div><strong>{String(commitmentRows.length).padStart(2, '0')}</strong><span>Active shifts</span></div>
            <div><strong>{resume?.totals.hours ?? 0}h</strong><span>Service record</span></div>
            <div><strong>{String(joinedOrganizations.length).padStart(2, '0')}</strong><span>Organizations</span></div>
          </div>
          <Link href="/aesthetic-lab/history"><Bookmark size={15} /> View service history</Link>
        </section>
      </aside>

      <section className={styles.primaryColumn} aria-label="My commitments">
        <div className={styles.pageIntro}>
          <p className={styles.eyebrow}>My Commitments</p>
          <h1>Every shift you have committed to.</h1>
          <p>Open a commitment to see the exact session details, your preparation checklist, related documents, and the organization&apos;s contact information.</p>
        </div>

        <section className={styles.commitmentsWorkspaceCard}>
          <div className={styles.commitmentsWorkspaceHeading}>
            <div><p className={styles.eyebrow}>Current commitments</p><h2>{commitmentRows.length ? `${commitmentRows.length} active commitment${commitmentRows.length === 1 ? '' : 's'}` : 'No active commitments'}</h2></div>
            <CalendarDays size={20} />
          </div>
          <div className={styles.commitmentsList}>
            {commitmentRows.length ? commitmentRows.map(({ claim, task, organization, shift, city: commitmentCity }) => {
              const state = commitmentState(claim.status as 'claimed' | 'submitted')
              return <article key={claim.id}>
                <span className={styles.commitmentDateIcon}><CalendarDays size={18} /></span>
                <div className={styles.commitmentDetails}>
                  <p>{organization.name}{commitmentCity ? ` · ${commitmentCity.name}` : ''}</p>
                  <h3>{task.title}</h3>
                  <small><CalendarDays size={13} /> {sessionTime(shift.startsAt, shift.endsAt)} <i /> <MapPin size={13} /> {task.location || 'Location to be confirmed'}</small>
                  <em>{state.label}</em>
                  <span>{state.detail}</span>
                </div>
                <Link className={styles.commitmentStatusButton} href={`/aesthetic-lab/opportunities/${task.id}/sessions/${shift.id}`}>Open Status Page <ArrowUpRight size={14} /></Link>
              </article>
            }) : <div className={styles.commitmentsEmpty}><UsersRound size={21} /><div><b>You have no current commitments.</b><p>Choose an onboarding session or volunteer shift when you are ready to get involved.</p><Link href="/aesthetic-lab/opportunities">Explore opportunities <ArrowUpRight size={14} /></Link></div></div>}
          </div>
        </section>
      </section>

      <aside className={styles.rightRail}>
        <section className={styles.cityCard}>
          <div className={styles.cityCardTop}><span className={styles.cityOverline}>Your city membership</span><CheckCircle2 size={17} /></div>
          <div className={styles.cityName}><MapPin size={17} /><span>{city?.name ?? 'Choose a city'}</span></div>
          <p>Your active City Network determines which local opportunities and records you see first.</p>
          <Link href="/aesthetic-lab/cities">Explore your city <ArrowUpRight size={14} /></Link>
        </section>
        <section className={styles.historyAsideCard}><p className={styles.eyebrow}>Keep going</p><strong>{participation === 'active' ? 'You are a City Member' : 'Start with onboarding'}</strong><span>{participation === 'active' ? 'Your verified participation opens local opportunities.' : 'One local onboarding session is all that is needed to become a City Member.'}</span><Link href="/aesthetic-lab/opportunities">Find onboarding <ArrowUpRight size={14} /></Link></section>
      </aside>
    </section>
  </main>
}
