import type { CSSProperties } from 'react'
import { eq } from 'drizzle-orm'
import { requireSession } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { orgs, users } from '@/lib/db/schema'
import { getEditorProfile } from '@/lib/services/profile'
import { normalizeOrganizationBannerPalette, organizationBannerPalette } from '@/lib/profile/organization-appearance'
import { listParticipantActivity } from '@/lib/services/participant-activity'
import { getLabWorkspace } from '../lab-workspace'
import { LabHeader } from '../LabHeader'
import { LabNotice } from '../LabNotice'
import { ParticipantIdentityCard } from '../ParticipantIdentityCard'
import { IssuerLabSidebar } from '../issuer/IssuerLabSidebar'
import { CopyOrganizationIdButton } from './CopyOrganizationIdButton'
import { OrganizationManagementSettings } from './OrganizationManagementSettings'
import { ParticipantAccountIdentityForm } from './ParticipantAccountIdentityForm'
import { ParticipantActivityFeed } from './ParticipantActivityFeed'
import styles from '../prototype.module.css'

export const dynamic = 'force-dynamic'

type SettingsHeaderPaletteVariables = CSSProperties & {
  '--program-palette-deep': string
  '--program-palette-mid': string
  '--program-palette-accent': string
  '--program-palette-accent-deep': string
}

export default async function LabSettingsPage({ searchParams }: { searchParams: { ok?: string; error?: string; invite?: string; inviteRole?: string } }) {
  const session = await requireSession()
  const { city, cities, contexts } = await getLabWorkspace(session)
  const [user, org] = await Promise.all([
    db.select().from(users).where(eq(users.id, session.sub)).limit(1).then((rows) => rows[0] ?? null),
    session.orgId ? db.select().from(orgs).where(eq(orgs.id, session.orgId)).limit(1).then((rows) => rows[0] ?? null) : Promise.resolve(null),
  ])
  const isIssuer = session.role === 'issuer'
  const [profile, participantActivity] = await Promise.all([
    org ? getEditorProfile(org) : Promise.resolve(null),
    isIssuer ? Promise.resolve([]) : listParticipantActivity(session.sub),
  ])
  const selectedPalette = organizationBannerPalette(isIssuer ? profile?.bannerPalette : user?.bannerPalette)
  const settingsHeaderPalette: SettingsHeaderPaletteVariables = {
    '--program-palette-deep': selectedPalette.colors[0],
    '--program-palette-mid': selectedPalette.colors[1],
    '--program-palette-accent': selectedPalette.colors[2],
    '--program-palette-accent-deep': selectedPalette.colors[3],
  }

  if (isIssuer) {
    return <main className={styles.app}>
      <LabHeader activeSection="issuer-utility" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
      <div className={styles.issuerLayout}>
        <IssuerLabSidebar organizationId={org?.id} organizationName={org?.name} cityName={city?.name} />
        <section className={styles.issuerMain} aria-label="Organization settings">
          <div className={styles.programControlCenterShell} style={settingsHeaderPalette}>
            <section className={`${styles.programControlCenterCard} ${styles.organizationSettingsHeaderCard}`}>
              <div className={styles.programControlCenterHeading}>
                <div><p className={styles.eyebrow}>{org?.name ?? 'Organization'}</p><h1>Organization Settings</h1><p>Keep your organization profile current and review its recent activity.</p></div>
                {org ? <CopyOrganizationIdButton value={org.id} /> : null}
              </div>
            </section>
          </div>
          <LabNotice ok={searchParams.ok} error={searchParams.error} />
          {org && profile ? <OrganizationManagementSettings organization={org} profile={profile} session={session} inviteCode={searchParams.invite} inviteRoleId={searchParams.inviteRole} /> : null}
        </section>
      </div>
    </main>
  }

  return <main className={styles.app}>
    <LabHeader activeSection="feed" workspace="participant" session={session} city={city} cities={cities} contexts={contexts} />
    <section className={`${styles.detailLayout} ${styles.opportunitiesLayout}`}>
      <aside className={styles.leftRail}><ParticipantIdentityCard session={session} city={city} redirectTo="/aesthetic-lab/settings" /></aside>
      <section className={`${styles.primaryColumn} ${styles.issuerMain}`} aria-label="Account settings">
        <div className={styles.programControlCenterShell} style={settingsHeaderPalette}>
          <section className={`${styles.programControlCenterCard} ${styles.organizationSettingsHeaderCard}`}>
            <div className={styles.programControlCenterHeading}>
              <div><p className={styles.eyebrow}>{user?.name || user?.username || 'Civic Participant'}</p><h1>Account Settings</h1><p>Keep your participant identity current and review your recent activity.</p></div>
            </div>
          </section>
        </div>
        <LabNotice ok={searchParams.ok} error={searchParams.error} />
        {user ? <>
          <ParticipantAccountIdentityForm
            name={user.name ?? ''}
            email={user.email}
            username={user.username ?? ''}
            avatarUrl={user.avatarUrl}
            bannerPalette={normalizeOrganizationBannerPalette(user.bannerPalette)}
          />
          <ParticipantActivityFeed activity={participantActivity} bannerPalette={normalizeOrganizationBannerPalette(user.bannerPalette)} />
        </> : null}
      </section>
    </section>
  </main>
}
