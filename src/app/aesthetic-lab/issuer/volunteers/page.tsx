import Link from 'next/link'
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Mail,
  MessageCircle,
  Search,
  Send,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { orgs } from '@/lib/db/schema'
import { getRoster } from '@/lib/services/roster'
import { eq } from 'drizzle-orm'
import { LabHeader } from '../../LabHeader'
import { getLabWorkspace } from '../../lab-workspace'
import { IssuerLabSidebar } from '../IssuerLabSidebar'
import styles from '../../prototype.module.css'

export const dynamic = 'force-dynamic'

function stateCopy(status: 'active' | 'committed' | 'needs-waiver' | 'inactive') {
  if (status === 'committed') return { label: 'Committed', tone: 'confirmed' }
  if (status === 'active') return { label: 'Active', tone: 'confirmed' }
  if (status === 'needs-waiver') return { label: 'Needs waiver', tone: 'waiting' }
  return { label: 'Inactive', tone: 'new' }
}

export default async function IssuerVolunteersLabPage() {
  const session = await requireRole('issuer')
  const { city, contexts } = await getLabWorkspace(session)
  const orgId = session.orgId!
  const [org, roster] = await Promise.all([
    db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1).then((rows) => rows[0] ?? null),
    getRoster(orgId),
  ])
  const committed = roster.volunteers.filter((volunteer) => volunteer.status === 'committed')
  const newParticipants = roster.volunteers.filter((volunteer) => volunteer.completedCount === 0)

  return (
    <main className={styles.app}>
      <LabHeader activeSection="issuer-volunteers" workspace="issuer" session={session} city={city} contexts={contexts} />
      <div className={styles.issuerLayout}>
        <IssuerLabSidebar active="volunteers" organizationName={org?.name} cityName={city?.name} />

        <section className={styles.issuerMain} aria-label="Volunteer roster">
          <section className={styles.issuerPageHero}>
            <div><p className={styles.eyebrow}>Volunteer roster</p><h1>See people, not sign-ups.</h1><p>A practical view of who is expected, who is new, and where a timely nudge could make a difference.</p></div>
            <Link href="/issuer/volunteers" className={styles.issuerPrimaryAction}><Send size={17} /> Message volunteers</Link>
          </section>

          <section className={styles.rosterMetricGrid}>
            <article><UsersRound size={19} /><div><b>{roster.counts.active} active volunteer{roster.counts.active === 1 ? '' : 's'}</b><span>{roster.counts.total} in your full roster</span></div></article>
            <article><Check size={19} /><div><b>{committed.length} commitment{committed.length === 1 ? '' : 's'} in progress</b><span>People with an active sign-up</span></div></article>
            <article><MessageCircle size={19} /><div><b>{roster.counts.needsWaiver} need a waiver</b><span>Resolve this before their shift</span></div></article>
          </section>

          <section className={styles.rosterWorkspaceCard}>
            <div className={styles.issuerPanelHeading}><div><p className={styles.eyebrow}>Full roster</p><h2>People signed up with your organization</h2></div><Link href="/issuer/volunteers" className={styles.issuerTextButton}>Manage roster <ArrowUpRight size={14} /></Link></div>
            <div className={styles.rosterToolbar}><label><Search size={16} /><input type="search" placeholder="Search volunteers" readOnly /></label><button type="button">All shifts <ChevronDown size={15} /></button><button type="button">All statuses <ChevronDown size={15} /></button></div>
            <div className={styles.volunteerRows}>
              {roster.volunteers.length === 0 ? <p className={styles.emptyCopy}>People appear here when they claim one of your opportunities.</p> : roster.volunteers.map((volunteer) => {
                const state = stateCopy(volunteer.status)
                return <article key={volunteer.userId}>
                  <span className={styles.volunteerAvatar}>{volunteer.name.slice(0, 2).toUpperCase()}</span>
                  <div className={styles.volunteerIdentity}><h3>{volunteer.name}</h3><a href={`mailto:${volunteer.email}`}><Mail size={13} /> {volunteer.email}</a></div>
                  <div className={styles.volunteerActivity}><b>{volunteer.activeClaims ? `${volunteer.activeClaims} active commitment${volunteer.activeClaims === 1 ? '' : 's'}` : 'No current commitment'}</b><span>{volunteer.completedCount ? `${volunteer.completedCount} verified contribution${volunteer.completedCount === 1 ? '' : 's'}` : 'New to your organization'}</span></div>
                  <span className={`${styles.volunteerState} ${styles[state.tone]}`}>{state.label}</span>
                  <Link href={`/issuer/volunteers?volunteer=${volunteer.userId}`} aria-label={`View ${volunteer.name}`}><MessageCircle size={17} /></Link>
                </article>
              })}
            </div>
          </section>

          <section className={styles.rosterActionGrid}>
            <section className={styles.rosterMessageCard}><span><Send size={19} /></span><div><p className={styles.eyebrow}>A well-timed note</p><h2>Message a group without losing the human context.</h2><p>Start with an audience, then choose everyone or a few specific volunteers.</p></div><Link href="/issuer/volunteers">Open messages <ArrowUpRight size={14} /></Link></section>
            <section className={styles.rosterOnboardingCard}><span><UserRoundCheck size={19} /></span><div><p className={styles.eyebrow}>New participants</p><h2>{newParticipants.length} people are beginning with you.</h2><p>They become City Members after completing their onboarding session.</p></div><Link href="/issuer/volunteers">View onboarding group <ArrowUpRight size={14} /></Link></section>
          </section>
        </section>
      </div>
    </main>
  )
}
