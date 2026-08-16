import Link from 'next/link'
import {
  ArrowUpRight,
  BadgeCheck,
  Building2,
  Check,
  Edit3,
  Globe2,
  Heart,
  MapPin,
  Share2,
  Sparkles,
  UsersRound,
} from 'lucide-react'
import { eq } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { orgs } from '@/lib/db/schema'
import { getOrgImpact, getEditorProfile } from '@/lib/services/profile'
import { LabHeader } from '../../LabHeader'
import { getLabWorkspace } from '../../lab-workspace'
import { IssuerLabSidebar } from '../IssuerLabSidebar'
import styles from '../../prototype.module.css'

export const dynamic = 'force-dynamic'

export default async function IssuerProfileLabPage() {
  const session = await requireRole('issuer')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const orgId = session.orgId!
  const org = (await db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1))[0]
  if (!org) return null
  const [profile, impact] = await Promise.all([getEditorProfile(org), getOrgImpact(org.id)])
  const checks = [
    { label: 'Mission and cause areas', ready: Boolean(profile.mission.trim() && profile.causes.length) },
    { label: 'Primary location and contact path', ready: Boolean(profile.location.trim() || profile.contactEmail.trim()) },
    { label: 'Active opportunities and onboarding', ready: impact.openOpportunities > 0 },
    { label: 'Published public profile', ready: profile.published },
  ]
  const causes = profile.causes.length ? profile.causes.join(' · ') : 'Add cause areas'
  const location = profile.location || city?.name || 'Location not added'
  const initials = org.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()

  return (
    <main className={styles.app}>
      <LabHeader activeSection="issuer-profile" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
      <div className={styles.issuerLayout}>
        <IssuerLabSidebar active="profile" organizationName={org.name} cityName={city?.name} />

        <section className={styles.issuerMain} aria-label="Public Profile">
          <section className={styles.issuerPageHero}>
            <div><p className={styles.eyebrow}>Public profile</p><h1>Let people recognize the work.</h1><p>This is the first page a potential volunteer sees before deciding whether to join your organization.</p></div>
            <Link href="/aesthetic-lab/issuer/profile/edit" className={styles.issuerPrimaryAction}><Edit3 size={17} /> Edit profile</Link>
          </section>

          <section className={styles.profilePreviewCard}>
            <div className={styles.publicProfileCover}><span><Building2 size={24} /></span><i /><i /><i /></div>
            <div className={styles.publicProfileBody}>
              <div className={styles.publicOrgMark}>{initials}</div>
              <div className={styles.publicProfileTopline}><p className={styles.eyebrow}>{causes} · {location}</p><span>{profile.published ? <><BadgeCheck size={16} /> Published organization</> : 'Draft profile'}</span></div>
              <h2>{org.name}</h2>
              <p className={styles.publicProfileMission}>{profile.mission || org.description || 'Add a public mission so prospective volunteers can understand your work.'}</p>
              <div className={styles.publicProfileMeta}><span><MapPin size={15} /> {location}</span><span><UsersRound size={15} /> {impact.volunteers} verified volunteer{impact.volunteers === 1 ? '' : 's'}</span><span><Heart size={15} /> {causes}</span></div>
              <div className={styles.publicProfileActions}><Link href={`/aesthetic-lab/organizations/${org.slug}`}><Share2 size={15} /> Share profile</Link><Link href={`/aesthetic-lab/organizations/${org.slug}`}><Globe2 size={15} /> View as public</Link></div>
            </div>
          </section>

          <section className={styles.profileEditorGrid}>
            <section className={styles.profileEditCard}>
              <div className={styles.issuerPanelHeading}><div><p className={styles.eyebrow}>Profile information</p><h2>What your page communicates</h2></div><Edit3 size={18} /></div>
              <div className={styles.profileFieldList}>
                <article><span>Mission</span><p>{profile.mission || 'Add a mission statement.'}</p><Link href="/aesthetic-lab/issuer/profile/edit" aria-label="Edit mission"><Edit3 size={15} /></Link></article>
                <article><span>Cause areas</span><p>{causes}</p><Link href="/aesthetic-lab/issuer/profile/edit" aria-label="Edit causes"><Edit3 size={15} /></Link></article>
                <article><span>Location</span><p>{location}</p><Link href="/aesthetic-lab/issuer/profile/edit" aria-label="Edit location"><Edit3 size={15} /></Link></article>
              </div>
            </section>
            <section className={styles.profileReadyCard}><span><Sparkles size={20} /></span><p className={styles.eyebrow}>Profile readiness</p><h2>{checks.every((check) => check.ready) ? 'Ready to welcome new people.' : 'A few details remain.'}</h2><p>Keep your public information current so people understand how to get involved.</p><div>{checks.map((check) => <span key={check.label}><Check size={14} /> {check.label}{check.ready ? '' : ' — incomplete'}</span>)}</div></section>
          </section>

          <section className={styles.profilePublicCard}>
            <div><p className={styles.eyebrow}>Public experience</p><h2>What happens next for someone visiting your page.</h2></div>
            <ol><li><b>1</b><span>They understand your mission and current local work.</span></li><li><b>2</b><span>They see an onboarding session or open opportunity.</span></li><li><b>3</b><span>They join with clear expectations and verified context.</span></li></ol>
            <Link href={`/aesthetic-lab/organizations/${org.slug}`}>Preview public profile <ArrowUpRight size={15} /></Link>
          </section>
        </section>
      </div>
    </main>
  )
}
