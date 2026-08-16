import Link from 'next/link'
import { ArrowUpRight, Check, Mail, MessageCircle, Search, Send, UserRoundCheck, UsersRound } from 'lucide-react'
import { and, eq } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { claims, orgs, tasks, users } from '@/lib/db/schema'
import { createVolunteerGroupAction, sendRosterMessageAction, verifyClaimAction } from '@/app/actions'
import { getRoster, getVolunteerGroups } from '@/lib/services/roster'
import { participantDisplayName } from '@/lib/participant-name'
import { getLabWorkspace } from '../../lab-workspace'
import { LabHeader } from '../../LabHeader'
import { LabNotice } from '../../LabNotice'
import { IssuerLabSidebar } from '../IssuerLabSidebar'
import styles from '../../prototype.module.css'

export const dynamic = 'force-dynamic'

function stateCopy(status: 'active' | 'committed' | 'needs-waiver' | 'inactive') {
  if (status === 'committed') return { label: 'Committed', tone: 'confirmed' }
  if (status === 'active') return { label: 'Active', tone: 'confirmed' }
  if (status === 'needs-waiver') return { label: 'Needs waiver', tone: 'waiting' }
  return { label: 'Inactive', tone: 'new' }
}

export default async function IssuerVolunteersLabPage({ searchParams }: { searchParams: { q?: string; ok?: string; error?: string } }) {
  const session = await requireRole('issuer')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const orgId = session.orgId!
  const query = searchParams.q?.trim() ?? ''
  const [org, roster, groups, pendingClaims] = await Promise.all([
    db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1).then((rows) => rows[0] ?? null),
    getRoster(orgId, query),
    getVolunteerGroups(orgId),
    city
      ? db.select({ claim: claims, task: tasks, participant: users }).from(claims).innerJoin(tasks, eq(claims.taskId, tasks.id)).innerJoin(users, eq(claims.userId, users.id)).where(and(eq(tasks.orgId, orgId), eq(tasks.cityId, city.id), eq(claims.status, 'submitted')))
      : Promise.resolve([]),
  ])
  const committed = roster.volunteers.filter((volunteer) => volunteer.status === 'committed')
  const newParticipants = roster.volunteers.filter((volunteer) => volunteer.completedCount === 0)

  return <main className={styles.app}>
    <LabHeader activeSection="issuer-volunteers" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
    <div className={styles.issuerLayout}><IssuerLabSidebar active="volunteers" organizationName={org?.name} cityName={city?.name} />
      <section className={styles.issuerMain} aria-label="Volunteer roster">
        <section className={styles.issuerPageHero}><div><p className={styles.eyebrow}>Volunteer roster</p><h1>See people, not sign-ups.</h1><p>A practical view of who is expected, who is new, and where a timely nudge could make a difference.</p></div><Link href="#message" className={styles.issuerPrimaryAction}><Send size={17} /> Message volunteers</Link></section>
        <LabNotice ok={searchParams.ok} error={searchParams.error} />
        <section className={styles.rosterMetricGrid}><article><UsersRound size={19} /><div><b>{roster.counts.active} active volunteer{roster.counts.active === 1 ? '' : 's'}</b><span>{roster.counts.total} in your full roster</span></div></article><article><Check size={19} /><div><b>{committed.length} commitment{committed.length === 1 ? '' : 's'} in progress</b><span>People with an active sign-up</span></div></article><article><MessageCircle size={19} /><div><b>{roster.counts.needsWaiver} need a waiver</b><span>Resolve this before their shift</span></div></article></section>
        <section className={styles.rosterWorkspaceCard}><div className={styles.issuerPanelHeading}><div><p className={styles.eyebrow}>Full roster</p><h2>People signed up with your organization</h2></div></div><form action="/aesthetic-lab/issuer/volunteers" method="get" className={styles.rosterToolbar}><label><Search size={16} /><input type="search" name="q" defaultValue={query} placeholder="Search volunteers" /></label><button className={styles.labButton} type="submit">Search</button></form><div className={styles.volunteerRows}>{roster.volunteers.length === 0 ? <p className={styles.emptyCopy}>People appear here when they claim one of your opportunities.</p> : roster.volunteers.map((volunteer) => { const state = stateCopy(volunteer.status); return <article key={volunteer.userId}><span className={styles.volunteerAvatar}>{volunteer.name.slice(0, 2).toUpperCase()}</span><div className={styles.volunteerIdentity}><h3>{volunteer.name}</h3><a href={`mailto:${volunteer.email}`}><Mail size={13} /> {volunteer.email}</a></div><div className={styles.volunteerActivity}><b>{volunteer.activeClaims ? `${volunteer.activeClaims} active commitment${volunteer.activeClaims === 1 ? '' : 's'}` : 'No current commitment'}</b><span>{volunteer.completedCount ? `${volunteer.completedCount} verified contribution${volunteer.completedCount === 1 ? '' : 's'}` : 'New to your organization'}</span></div><span className={`${styles.volunteerState} ${styles[state.tone]}`}>{state.label}</span><a href={`mailto:${volunteer.email}`} aria-label={`Email ${volunteer.name}`}><MessageCircle size={17} /></a></article> })}</div></section>
        {pendingClaims.length ? <section className={`${styles.labPanel} ${styles.labStack}`}><div><p className={styles.eyebrow}>Completion review</p><h2>{pendingClaims.length} submitted contribution{pendingClaims.length === 1 ? '' : 's'} awaiting verification</h2></div><div className={styles.labChoiceList}>{pendingClaims.map(({ claim, task, participant }) => <article className={styles.labChoice} key={claim.id}><div><p><strong>{participantDisplayName(participant)} · {task.title}</strong></p><small>{claim.note || 'Participant submitted completion for verification.'}</small></div><form action={verifyClaimAction}><input type="hidden" name="claimId" value={claim.id} /><input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer/volunteers" /><button className={styles.labButton} type="submit">Verify completion</button></form></article>)}</div></section> : null}
        <section className={styles.rosterActionGrid} id="message"><section className={`${styles.rosterMessageCard} ${styles.labPanel}`}><span><Send size={19} /></span><div><p className={styles.eyebrow}>Message volunteers</p><h2>Send a well-timed note.</h2><p>Choose a roster, a saved grouping, or a set of specific people.</p></div><form action={sendRosterMessageAction} className={styles.labForm}><input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer/volunteers" /><label>Audience<select name="audience"><option value="roster">Full roster</option>{groups.map((group) => <option value={`group:${group.id}`} key={group.id}>{group.name}</option>)}</select></label><div className={styles.labFormGrid}><label><span><input type="radio" name="recipientMode" value="all" defaultChecked /> Everyone in audience</span></label><label><span><input type="radio" name="recipientMode" value="selected" /> Selected volunteers</span></label></div><div className={styles.labCheckList}>{roster.volunteers.map((volunteer) => <label key={volunteer.userId}><input type="checkbox" name="memberId" value={volunteer.userId} /> {volunteer.name}</label>)}</div><label>Subject<input name="subject" required placeholder="A brief, clear subject" /></label><label>Message<textarea name="body" required placeholder="Write a helpful update for your volunteers." /></label><div className={styles.labFormActions}><button className={styles.labButton} type="submit">Send message</button></div></form></section><section className={`${styles.rosterOnboardingCard} ${styles.labPanel}`}><span><UserRoundCheck size={19} /></span><div><p className={styles.eyebrow}>New participants</p><h2>{newParticipants.length} people are beginning with you.</h2><p>They become City Members after completing their onboarding session.</p></div><Link href="/aesthetic-lab/issuer/catalog">Manage onboarding <ArrowUpRight size={14} /></Link></section></section>
        <section className={`${styles.labPanel} ${styles.labStack}`}><div><p className={styles.eyebrow}>Volunteer groupings</p><h2>Create a group you can message again.</h2></div>{groups.length ? <div className={styles.labChoiceList}>{groups.map((group) => <div className={styles.labChoice} key={group.id}><p><strong>{group.name}</strong><small>{group.memberIds.length} member{group.memberIds.length === 1 ? '' : 's'}</small></p></div>)}</div> : null}<form action={createVolunteerGroupAction} className={styles.labForm}><input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer/volunteers" /><label>Grouping name<input name="name" required placeholder="e.g. Saturday crew" /></label><div className={styles.labCheckList}>{roster.volunteers.map((volunteer) => <label key={volunteer.userId}><input type="checkbox" name="memberId" value={volunteer.userId} /> {volunteer.name}</label>)}</div><div className={styles.labFormActions}><button className={styles.labButton} type="submit">Create grouping</button></div></form></section>
      </section>
    </div>
  </main>
}
