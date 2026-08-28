import Link from 'next/link'
import { Check, Link2, Mail, MessageCircle, Search, UsersRound } from 'lucide-react'
import { createVolunteerRosterInviteAction } from '@/app/actions'
import { eq } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { orgs } from '@/lib/db/schema'
import { getRoster, getVolunteerGroups } from '@/lib/services/roster'
import { getLabWorkspace } from '../../lab-workspace'
import { LabHeader } from '../../LabHeader'
import { LabNotice } from '../../LabNotice'
import { IssuerLabSidebar } from '../IssuerLabSidebar'
import { VolunteerGroupingManager } from '../VolunteerGroupingManager'
import { VolunteerRosterInviteLink } from '../VolunteerRosterInviteLink'
import styles from '../../prototype.module.css'

export const dynamic = 'force-dynamic'

function stateCopy(status: 'active' | 'committed' | 'needs-waiver' | 'inactive') {
  if (status === 'committed') return { label: 'Committed', tone: 'confirmed' }
  if (status === 'active') return { label: 'Active', tone: 'confirmed' }
  if (status === 'needs-waiver') return { label: 'Needs waiver', tone: 'waiting' }
  return { label: 'Inactive', tone: 'new' }
}

export default async function IssuerVolunteersLabPage({ searchParams }: { searchParams: { q?: string; ok?: string; error?: string; rosterInvite?: string } }) {
  const session = await requireRole('issuer')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const orgId = session.orgId!
  const query = searchParams.q?.trim() ?? ''
  const [org, roster, groups] = await Promise.all([
    db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1).then((rows) => rows[0] ?? null),
    getRoster(orgId, query),
    getVolunteerGroups(orgId),
  ])
  const committed = roster.volunteers.filter((volunteer) => volunteer.status === 'committed')
  // Group membership should remain complete even while the main roster is
  // filtered by a search query.
  const groupVolunteers = query ? (await getRoster(orgId)).volunteers : roster.volunteers

  return <main className={styles.app}>
    <LabHeader activeSection="issuer-volunteers" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
    <div className={styles.issuerLayout}><IssuerLabSidebar organizationId={org?.id} organizationName={org?.name} cityName={city?.name} />
      <section className={styles.issuerMain} aria-label="Volunteer roster">
        <section className={styles.issuerPageHero}><div><p className={styles.eyebrow}>Volunteer roster</p></div></section>
        <LabNotice hidden ok={searchParams.ok} error={searchParams.error} />
        <section className={styles.rosterMetricGrid}><article><UsersRound size={19} /><div><b>{roster.counts.active} active volunteer{roster.counts.active === 1 ? '' : 's'}</b><span>{roster.counts.total} in your full roster</span></div></article><article><Check size={19} /><div><b>{committed.length} commitment{committed.length === 1 ? '' : 's'} in progress</b><span>People with an active sign-up</span></div></article><article><MessageCircle size={19} /><div><b>{roster.counts.needsWaiver} need a waiver</b><span>Resolve this before their shift</span></div></article></section>
        <section className={styles.rosterWorkspaceCard}><div className={styles.issuerPanelHeading}><div><p className={styles.eyebrow}>Full roster</p><h2>People signed up with your organization</h2></div><form action={createVolunteerRosterInviteAction}><input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer/volunteers" /><button className={styles.rosterManageButton} type="submit"><Link2 size={15} /> Invite Link</button></form></div>{searchParams.rosterInvite ? <VolunteerRosterInviteLink code={searchParams.rosterInvite} /> : null}<form action="/aesthetic-lab/issuer/volunteers" method="get" className={styles.rosterToolbar}><label><Search size={16} /><input type="search" name="q" defaultValue={query} placeholder="Search volunteers" /></label><button className={styles.rosterManageButton} type="submit">Search</button></form><div className={styles.volunteerRows}>{roster.volunteers.length === 0 ? null : roster.volunteers.map((volunteer) => { const state = stateCopy(volunteer.status); return <article key={volunteer.userId}><Link className={styles.volunteerProfileLink} href={`/aesthetic-lab/issuer/volunteers/${volunteer.userId}`}><span className={styles.volunteerAvatar}>{volunteer.name.slice(0, 2).toUpperCase()}</span><div className={styles.volunteerIdentity}><h3>{volunteer.name}</h3><span><Mail size={13} /> {volunteer.email}</span></div></Link><div className={styles.volunteerActivity}><b>{volunteer.activeClaims ? `${volunteer.activeClaims} active commitment${volunteer.activeClaims === 1 ? '' : 's'}` : 'No current commitment'}</b><span>{volunteer.completedCount ? `${volunteer.completedCount} verified contribution${volunteer.completedCount === 1 ? '' : 's'}` : 'New to your organization'}</span></div><span className={`${styles.volunteerState} ${styles[state.tone]}`}>{state.label}</span><a href={`mailto:${volunteer.email}`} aria-label={`Email ${volunteer.name}`}><MessageCircle size={17} /></a></article> })}</div></section>
        <VolunteerGroupingManager groups={groups} volunteers={groupVolunteers} />
      </section>
    </div>
  </main>
}
