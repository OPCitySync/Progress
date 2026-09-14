import {
  Check,
  Globe2,
  Heart,
  MapPin,
  UsersRound,
} from 'lucide-react'
import { eq } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { orgs } from '@/lib/db/schema'
import { getOpenOpportunities, getOrgImpact, getEditorProfile, getPublicApplications } from '@/lib/services/profile'
import { LabHeader } from '../../LabHeader'
import { getLabWorkspace } from '../../lab-workspace'
import { IssuerLabSidebar } from '../IssuerLabSidebar'
import { IssuerProfileInformationCard } from './IssuerProfileInformationCard'
import { WebsiteSharingCard } from './WebsiteSharingCard'
import { OrganizationAppearanceButton } from '../OrganizationAppearanceButton'
import { OrganizationBanner } from '@/components/profile/OrganizationBanner'
import { organizationInitials } from '@/lib/profile/organization-appearance'
import styles from '../../prototype.module.css'

export const dynamic = 'force-dynamic'

export default async function IssuerProfileLabPage() {
  const session = await requireRole('issuer')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const orgId = session.orgId!
  const org = (await db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1))[0]
  if (!org) return null
  const [profile, impact, applications, opportunities] = await Promise.all([
    getEditorProfile(org),
    getOrgImpact(org.id),
    getPublicApplications(org.id),
    getOpenOpportunities(org.id),
  ])
  const checks = [
    { label: 'Mission and cause areas', ready: Boolean(profile.mission.trim() && profile.causes.length) },
    { label: 'Primary location and contact path', ready: Boolean(profile.location.trim() || profile.contactEmail.trim()) },
    { label: 'A current way to volunteer', ready: applications.length > 0 || opportunities.length > 0 },
  ]
  const causes = profile.causes.length ? profile.causes.join(' · ') : 'Add cause areas'
  const location = profile.location || city?.name || 'Location not added'
  const initials = organizationInitials(org.name)
  const publicSlug = org.slug ?? ''

  return (
    <main className={styles.app}>
      <LabHeader activeSection="issuer-profile" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
      <div className={styles.issuerLayout}>
        <IssuerLabSidebar organizationId={org.id} organizationName={org.name} cityName={city?.name} />

        <section className={styles.issuerMain} aria-label="Public Profile">
          <section className={styles.profilePreviewCard}>
            <OrganizationBanner bannerStyle={profile.bannerStyle} bannerPalette={profile.bannerPalette} coverUrl={profile.coverUrl} className={styles.publicProfileCover} />
            <div className={styles.publicProfileBody}>
              <OrganizationAppearanceButton organizationName={org.name} initials={initials} profile={profile} placement="profile" />
              <div className={styles.publicProfileTopline}><p className={styles.eyebrow}>{causes} · {location}</p></div>
              <h2>{org.name}</h2>
              <p className={styles.publicProfileMission}>{profile.mission || org.description || 'Add a public mission so prospective volunteers can understand your work.'}</p>
              <div className={styles.publicProfileMeta}><span><MapPin size={15} /> {location}</span><span><UsersRound size={15} /> {impact.volunteers} verified volunteer{impact.volunteers === 1 ? '' : 's'}</span><span><Heart size={15} /> {causes}</span></div>
              <div className={styles.publicProfileActions}><a href={publicSlug ? `/orgs/${publicSlug}` : '/orgs'} target="_blank" rel="noopener noreferrer"><Globe2 size={15} /> View Public Profile</a></div>
            </div>
          </section>

          <section className={styles.profileEditorGrid}>
            <IssuerProfileInformationCard profile={profile} />
            {publicSlug ? <WebsiteSharingCard slug={publicSlug} organizationName={org.name} /> : null}
          </section>

          {!checks.every((check) => check.ready) ? <section className={styles.profileCompletionNote}><p className={styles.eyebrow}>Profile Suggestions</p>{checks.filter((check) => !check.ready).map((check) => <span key={check.label}><Check size={14} /> {check.label}</span>)}</section> : null}
        </section>
      </div>
    </main>
  )
}
