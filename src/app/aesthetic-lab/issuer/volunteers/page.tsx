import Link from 'next/link'
import type { CSSProperties } from 'react'
import { Link2, Mail, MessageCircle, Search, Settings2 } from 'lucide-react'
import { createVolunteerRosterInviteAction } from '@/app/actions'
import { eq } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { orgs } from '@/lib/db/schema'
import { organizationBannerPalette } from '@/lib/profile/organization-appearance'
import { participantDisplayName } from '@/lib/participant-name'
import { listOrganizationDelegations } from '@/lib/services/identity-access'
import { getProfile } from '@/lib/services/profile'
import { getRoster, getVolunteerGroups } from '@/lib/services/roster'
import { getLabWorkspace } from '../../lab-workspace'
import { LabHeader } from '../../LabHeader'
import { LabNotice } from '../../LabNotice'
import { IssuerLabSidebar } from '../IssuerLabSidebar'
import { VolunteerGroupingManager } from '../VolunteerGroupingManager'
import { VolunteerRosterInviteLink } from '../VolunteerRosterInviteLink'
import styles from '../../prototype.module.css'

export const dynamic = 'force-dynamic'

type OrganizationStaffPaletteVariables = CSSProperties & {
  '--organization-staff-deep': string
  '--organization-staff-mid': string
  '--organization-staff-accent': string
  '--organization-staff-accent-deep': string
}

export default async function IssuerVolunteersLabPage({ searchParams }: { searchParams: { q?: string; ok?: string; error?: string; rosterInvite?: string } }) {
  const session = await requireRole('issuer')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const orgId = session.orgId!
  const query = searchParams.q?.trim() ?? ''
  const [org, roster, groups, delegations, profile] = await Promise.all([
    db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1).then((rows) => rows[0] ?? null),
    getRoster(orgId, query),
    getVolunteerGroups(orgId),
    listOrganizationDelegations(orgId),
    getProfile(orgId),
  ])
  const staff = delegations
    .filter(({ delegation }) => delegation.status === 'active')
    .map(({ delegation, user, role }) => ({
      id: delegation.id,
      name: participantDisplayName(user),
      role: role?.name || (delegation.role === 'owner' ? 'Organization Owner' : delegation.role === 'manager' ? 'Organization Manager' : 'Organization Staff'),
    }))
  const organizationPalette = organizationBannerPalette(profile?.bannerPalette)
  const staffPalette: OrganizationStaffPaletteVariables = {
    '--organization-staff-deep': organizationPalette.colors[0],
    '--organization-staff-mid': organizationPalette.colors[1],
    '--organization-staff-accent': organizationPalette.colors[2],
    '--organization-staff-accent-deep': organizationPalette.colors[3],
  }
  // Group membership should remain complete even while the main roster is
  // filtered by a search query.
  const groupVolunteers = query ? (await getRoster(orgId)).volunteers : roster.volunteers

  return <main className={styles.app}>
    <LabHeader activeSection="issuer-volunteers" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
    <div className={styles.issuerLayout}><IssuerLabSidebar organizationId={org?.id} organizationName={org?.name} cityName={city?.name} />
      <section className={styles.issuerMain} aria-label="Volunteer roster">
        <LabNotice hidden ok={searchParams.ok} error={searchParams.error} />
        <section className={styles.organizationalStaffCard} style={staffPalette}>
          <header className={styles.organizationalStaffHeading}>
            <div><p className={styles.eyebrow}>Organization access</p><h2>Organizational Staff</h2></div>
            <Link href="/aesthetic-lab/settings#staff-access"><Settings2 size={15} /> Manage Staff</Link>
          </header>
          <div className={styles.organizationalStaffList}>
            {staff.length ? staff.map((member) => <article key={member.id}><span>{member.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'S'}</span><div><b>{member.name}</b><small>{member.role}</small></div></article>) : <p>No staff currently have access to this organization.</p>}
          </div>
        </section>
        <section className={styles.rosterWorkspaceCard}><div className={styles.issuerPanelHeading}><div><p className={styles.eyebrow}>Full roster</p><h2>People signed up with your organization</h2></div><form action={createVolunteerRosterInviteAction}><input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer/volunteers" /><button className={`${styles.catalogWorkspaceAction} ${styles.opportunityWorkspaceButton}`} type="submit"><Link2 size={15} /> Invite Link</button></form></div>{searchParams.rosterInvite ? <VolunteerRosterInviteLink code={searchParams.rosterInvite} /> : null}<form action="/aesthetic-lab/issuer/volunteers" method="get" className={styles.rosterToolbar}><label><Search size={16} /><input type="search" name="q" defaultValue={query} placeholder="Search volunteers" /></label><button className={styles.rosterManageButton} type="submit">Search</button></form><div className={styles.volunteerRows}>{roster.volunteers.length === 0 ? null : roster.volunteers.map((volunteer) => <article key={volunteer.userId}><Link className={styles.volunteerProfileLink} href={`/aesthetic-lab/issuer/volunteers/${volunteer.userId}`}><span className={styles.volunteerAvatar}>{volunteer.name.slice(0, 2).toUpperCase()}</span><div className={styles.volunteerIdentity}><h3>{volunteer.name}</h3><span><Mail size={13} /> {volunteer.email}</span></div></Link><div className={styles.volunteerActivity}><b>{volunteer.activeClaims ? `${volunteer.activeClaims} active commitment${volunteer.activeClaims === 1 ? '' : 's'}` : 'No current commitment'}</b><span>{volunteer.completedCount ? `${volunteer.completedCount} verified contribution${volunteer.completedCount === 1 ? '' : 's'}` : 'New to your organization'}</span></div><Link href={`/aesthetic-lab/issuer/notifications?recipient=${encodeURIComponent(volunteer.userId)}#individual-messages`} aria-label={`Message ${volunteer.name}`}><MessageCircle size={17} /></Link></article>)}</div></section>
        <VolunteerGroupingManager groups={groups} volunteers={groupVolunteers} />
      </section>
    </div>
  </main>
}
