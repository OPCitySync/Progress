import Link from 'next/link'
import {
  ArrowLeft,
  Compass,
  ChevronDown,
} from 'lucide-react'
import styles from '../prototype.module.css'
import { IssuerQuickActions, type IssuerQuickActionScheduleShift } from './IssuerQuickActions'
import { getProfile } from '@/lib/services/profile'
import { OrganizationAppearanceButton } from './OrganizationAppearanceButton'
import { organizationInitials } from '@/lib/profile/organization-appearance'
import { getRoster } from '@/lib/services/roster'
import { listOrganizationDelegations } from '@/lib/services/identity-access'
import { getOrganizationLocations } from '@/lib/services/organization-locations'
import { getOrganizationDocuments, ORGANIZATION_DOCUMENT_CATEGORY_DETAILS } from '@/lib/services/organization-documents'
import { getActiveWaivers } from '@/lib/services/waivers'

export async function IssuerLabSidebar({
  organizationName = 'Issuer organization',
  organizationId,
  cityName,
  isMyCityFeed = false,
  scheduleShift,
}: {
  organizationName?: string
  organizationId?: string
  cityName?: string
  isMyCityFeed?: boolean
  scheduleShift?: IssuerQuickActionScheduleShift
}) {
  const [profile, sidebarScheduleData] = organizationId ? await Promise.all([
    getProfile(organizationId),
    scheduleShift ? Promise.resolve(null) : Promise.all([
      getRoster(organizationId),
      listOrganizationDelegations(organizationId),
      getOrganizationLocations(organizationId),
      getOrganizationDocuments(organizationId),
      getActiveWaivers(organizationId),
    ]),
  ]) : [null, null]
  const resolvedScheduleShift = scheduleShift ?? (sidebarScheduleData ? (() => {
    const [roster, delegations, locations, documents, waivers] = sidebarScheduleData
    return {
      suggestedStartsAt: Date.now() + 24 * 60 * 60 * 1000,
      defaultLocation: locations.find((location) => location.isDefault)?.address || locations[0]?.address || '',
      volunteers: roster.volunteers.map(({ userId, name, email, status }) => ({ userId, name, email, status })),
      staff: delegations
        .filter(({ delegation }) => delegation.status === 'active')
        .map(({ delegation, user, role }) => ({
          userId: user.id,
          name: user.username?.trim() || user.name,
          email: user.email,
          roleLabel: role?.name || (delegation.role === 'owner' ? 'Organization owner' : delegation.role === 'manager' ? 'Organization manager' : 'Organization staff'),
        })),
      documents: documents.map((document) => ({
        id: document.id,
        title: document.title,
        categoryLabel: ORGANIZATION_DOCUMENT_CATEGORY_DETAILS[document.category].label,
      })),
      waivers: waivers.map((waiver) => ({ id: waiver.id, title: waiver.title })),
    }
  })() : undefined)
  const initials = organizationInitials(organizationName)
  return (
    <aside className={styles.issuerContext} aria-label="Organization context">
      <div className={styles.issuerContextIdentity}>
        <OrganizationAppearanceButton organizationName={organizationName} initials={initials} profile={profile} />
        <div><strong>{organizationName}</strong><span>{cityName ?? 'Organization workspace'}</span></div>
      </div>
      <div className={styles.issuerContextActions}>
        <Link href={isMyCityFeed ? '/aesthetic-lab/issuer' : '/aesthetic-lab/issuer/feed'}>
          {isMyCityFeed ? <ArrowLeft size={15} /> : <Compass size={15} />}
          {isMyCityFeed ? 'Overview' : 'MyCity Feed'}
        </Link>
        <details className={styles.issuerContextShortcuts}>
          <summary>Quick actions <ChevronDown size={14} /></summary>
          <IssuerQuickActions organizationId={organizationId ?? organizationName} scheduleShift={resolvedScheduleShift} />
        </details>
      </div>
    </aside>
  )
}
