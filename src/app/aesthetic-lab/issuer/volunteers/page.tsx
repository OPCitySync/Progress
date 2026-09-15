import Link from 'next/link'
import type { CSSProperties } from 'react'
import { Link2, Mail, MessageCircle, Search } from 'lucide-react'
import { createVolunteerRosterInviteAction } from '@/app/actions'
import { eq } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { orgs } from '@/lib/db/schema'
import { organizationBannerPalette } from '@/lib/profile/organization-appearance'
import { getEditorProfile } from '@/lib/services/profile'
import { getRoster, getVolunteerGroups } from '@/lib/services/roster'
import { getLabWorkspace } from '../../lab-workspace'
import { LabHeader } from '../../LabHeader'
import { LabNotice } from '../../LabNotice'
import { OrganizationManagementSettings } from '../../settings/OrganizationManagementSettings'
import { IssuerLabSidebar } from '../IssuerLabSidebar'
import { VolunteerGroupingManager } from '../VolunteerGroupingManager'
import { VolunteerRosterInviteLink } from '../VolunteerRosterInviteLink'
import { VolunteerWorkspaceMenu } from '../VolunteerWorkspaceMenu'
import styles from '../../prototype.module.css'

export const dynamic = 'force-dynamic'

type VolunteerHeaderPaletteVariables = CSSProperties & {
  '--program-palette-deep': string
  '--program-palette-mid': string
  '--program-palette-accent': string
  '--program-palette-accent-deep': string
}

export default async function IssuerVolunteersLabPage({ searchParams }: { searchParams: { q?: string; view?: string; ok?: string; error?: string; rosterInvite?: string; invite?: string; inviteRole?: string } }) {
  const session = await requireRole('issuer')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const orgId = session.orgId!
  const query = searchParams.q?.trim() ?? ''
  const [org, roster, groups] = await Promise.all([
    db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1).then((rows) => rows[0] ?? null),
    getRoster(orgId, query),
    getVolunteerGroups(orgId),
  ])
  const profile = org ? await getEditorProfile(org) : null
  const organizationPalette = organizationBannerPalette(profile?.bannerPalette)
  const headerPalette: VolunteerHeaderPaletteVariables = {
    '--program-palette-deep': organizationPalette.colors[0],
    '--program-palette-mid': organizationPalette.colors[1],
    '--program-palette-accent': organizationPalette.colors[2],
    '--program-palette-accent-deep': organizationPalette.colors[3],
  }
  // Group membership should remain complete even while the main roster is
  // filtered by a search query.
  const groupVolunteers = query ? (await getRoster(orgId)).volunteers : roster.volunteers

  const volunteers = <>
    <LabNotice ok={searchParams.ok} error={searchParams.error} />
    <section className={`${styles.rosterWorkspaceCard} ${styles.paletteTreatmentCard}`}>
      <div className={`${styles.issuerPanelHeading} ${styles.paletteTreatmentHeader}`}>
        <div><p className={styles.eyebrow}>Full roster</p></div>
        <form action={createVolunteerRosterInviteAction}>
          <input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer/volunteers" />
          <button className={`${styles.catalogWorkspaceAction} ${styles.opportunityWorkspaceButton}`} type="submit"><Link2 size={15} /> Invite Link</button>
        </form>
      </div>
      <div className={styles.paletteTreatmentBody}>
        {searchParams.rosterInvite ? <VolunteerRosterInviteLink code={searchParams.rosterInvite} /> : null}
        <form action="/aesthetic-lab/issuer/volunteers" method="get" className={styles.rosterToolbar}>
          <label><Search size={16} /><input type="search" name="q" defaultValue={query} placeholder="Search volunteers" /></label>
          <button className={styles.rosterManageButton} type="submit">Search</button>
        </form>
        <div className={styles.volunteerRows}>{roster.volunteers.length === 0 ? null : roster.volunteers.map((volunteer) => <article key={volunteer.userId}><Link className={styles.volunteerProfileLink} href={`/aesthetic-lab/issuer/volunteers/${volunteer.userId}`}><span className={styles.volunteerAvatar}>{volunteer.name.slice(0, 2).toUpperCase()}</span><div className={styles.volunteerIdentity}><h3>{volunteer.name}</h3><span><Mail size={13} /> {volunteer.email}</span></div></Link><div className={styles.volunteerActivity}><b>{volunteer.activeClaims ? `${volunteer.activeClaims} active commitment${volunteer.activeClaims === 1 ? '' : 's'}` : 'No current commitment'}</b><span>{volunteer.completedCount ? `${volunteer.completedCount} verified contribution${volunteer.completedCount === 1 ? '' : 's'}` : 'New to your organization'}</span></div><Link href={`/aesthetic-lab/issuer/notifications?recipient=${encodeURIComponent(volunteer.userId)}#individual-messages`} aria-label={`Message ${volunteer.name}`}><MessageCircle size={17} /></Link></article>)}</div>
      </div>
    </section>
    <VolunteerGroupingManager groups={groups} volunteers={groupVolunteers} />
  </>
  const organizationalStaff = <>
    <LabNotice ok={searchParams.ok} error={searchParams.error} />
    {org && profile ? <OrganizationManagementSettings
      organization={org}
      profile={profile}
      session={session}
      inviteCode={searchParams.invite}
      inviteRoleId={searchParams.inviteRole}
      section="staff"
      redirectTo="/aesthetic-lab/issuer/volunteers?view=staff"
    /> : null}
  </>

  return <main className={styles.app}>
    <LabHeader activeSection="issuer-volunteers" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
    <div className={styles.issuerLayout}><IssuerLabSidebar organizationId={org?.id} organizationName={org?.name} cityName={city?.name} />
      <section className={styles.issuerMain} aria-label="Volunteer workspace">
        <div className={styles.programControlCenterShell} style={headerPalette}>
          <section className={styles.programControlCenterCard}>
            <div className={styles.programControlCenterHeading}>
              <div><p className={styles.eyebrow}>{org?.name ?? 'Organization'}</p><h1>Volunteers &amp; Organizational Staff</h1><p>Manage your volunteer community and the people authorized to operate your organization.</p></div>
            </div>
          </section>
          <VolunteerWorkspaceMenu initialSection={searchParams.view} volunteers={volunteers} staff={organizationalStaff} />
        </div>
      </section>
    </div>
  </main>
}
