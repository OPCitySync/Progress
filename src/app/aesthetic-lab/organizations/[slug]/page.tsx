import Link from 'next/link'
import { ArrowLeft, ArrowUpRight, Building2, CheckCircle2, FileText, Heart, MapPin, Sparkles, UsersRound } from 'lucide-react'
import { requireSession } from '@/lib/auth/session'
import { getOpenOpportunities, getPublicProfileBySlug } from '@/lib/services/profile'
import { getPublishedOrganizationResources } from '@/lib/services/organization-resources'
import { organizationFileUrl } from '@/lib/storage/organization-file-url'
import { getLabWorkspace } from '../../lab-workspace'
import { LabHeader } from '../../LabHeader'
import styles from '../../prototype.module.css'

export const dynamic = 'force-dynamic'

export default async function LabOrganizationProfilePage({ params }: { params: { slug: string } }) {
  const session = await requireSession()
  const { city, cities, contexts } = await getLabWorkspace(session)
  const publicProfile = await getPublicProfileBySlug(params.slug)
  const issuerView = session.role === 'issuer'
  const headerProps = { activeSection: issuerView ? 'issuer-profile' as const : 'organizations' as const, workspace: issuerView ? 'issuer' as const : 'participant' as const, session, city, cities, contexts }
  if (!publicProfile) return <main className={styles.app}><LabHeader {...headerProps} /><section className={styles.primaryColumn}><p className={styles.emptyCopy}>This organization is no longer available.</p><Link href="/aesthetic-lab/organizations">Back to organizations</Link></section></main>
  const { org, profile } = publicProfile
  const [opportunities, publishedResources] = await Promise.all([
    getOpenOpportunities(org.id),
    getPublishedOrganizationResources({ orgIds: [org.id], destination: 'profile' }),
  ])
  const causes = profile?.causes.length ? profile.causes.join(' · ') : 'Community organization'
  const onboardingOpportunities = opportunities.filter((opportunity) => opportunity.isOnboarding)
  const regularOpportunities = opportunities.filter((opportunity) => !opportunity.isOnboarding)
  const isNewParticipant = session.role === 'participant' && city?.participation?.status === 'new'
  return <main className={styles.app}>
    <LabHeader {...headerProps} />
    <section className={styles.detailLayout}>
      <aside className={styles.leftRail}><section className={styles.cityCard}><Building2 size={20} /><h2>{org.name}</h2><p>{causes}</p><Link href="/aesthetic-lab/organizations"><ArrowLeft size={14} /> Discover organizations</Link></section></aside>
      <section className={styles.primaryColumn}>
        <div className={styles.pageIntro}><p className={styles.eyebrow}>Approved local organization</p><h1>{org.name} <CheckCircle2 size={19} /></h1><p>{profile?.tagline || org.description || 'A City/Sync organization helping its local community.'}</p></div>
        <section className={`${styles.labPanel} ${styles.labStack}`}><div><p className={styles.eyebrow}>About</p><h2>What they do</h2></div><p>{profile?.mission || org.description || 'This organization has not added its public mission yet.'}</p><div className={styles.labChoiceList}><div className={styles.labChoice}><p><MapPin size={15} /> <strong>Location</strong><small>{profile?.location || city?.name || 'Local City/Sync network'}</small></p><p><Heart size={15} /> <strong>Causes</strong><small>{causes}</small></p></div>{profile?.contactEmail ? <div className={styles.labChoice}><p><strong>Contact</strong><small>{profile.contactEmail}</small></p>{profile.website ? <a className={styles.labLinkButton} href={profile.website} target="_blank" rel="noreferrer">Website <ArrowUpRight size={14} /></a> : null}</div> : null}</div></section>
        {publishedResources.length ? <section className={`${styles.labPanel} ${styles.labStack}`}><div><p className={styles.eyebrow}>Shared resources</p><h2>Useful materials from {org.name}</h2></div><div className={styles.labChoiceList}>{publishedResources.map((resource) => <article className={styles.labChoice} key={`${resource.kind}-${resource.id}`}><div><p><strong><FileText size={15} /> {resource.title}</strong></p><small>{resource.kind === 'waiver' ? 'Liability waiver' : 'Volunteer resource'}{resource.body ? ' · Written guidance available' : ''}</small>{resource.body ? <details><summary>Read guidance</summary><p>{resource.body}</p></details> : null}</div>{resource.documentUrl ? <a className={styles.issuerTextButton} href={organizationFileUrl(resource.kind, resource.id)} target="_blank" rel="noreferrer">Open document</a> : null}</article>)}</div></section> : null}
        {onboardingOpportunities.length ? <section className={styles.organizationStartCard}><div className={styles.organizationStartHeading}><span><Sparkles size={20} /></span><div><p className={styles.eyebrow}>Start with this organization</p><h2>{isNewParticipant ? 'Meet the team before your first volunteer shift.' : `Get to know ${org.name}.`}</h2><p>{isNewParticipant ? 'Choose an introduction session to meet the organization, complete its required materials, and unlock local opportunities once your attendance is verified.' : 'Introduction sessions are a simple way to learn how this organization works before you volunteer.'}</p></div></div><div className={styles.organizationStartSessions}>{onboardingOpportunities.map((opportunity) => <article key={opportunity.id}><div><b>{opportunity.title}</b><small>{opportunity.location || 'Location TBD'} · {opportunity.totalOpenSlots} spot{opportunity.totalOpenSlots === 1 ? '' : 's'} open</small></div><Link href={`/aesthetic-lab/opportunities/${opportunity.id}`}>Choose a session <ArrowUpRight size={14} /></Link></article>)}</div></section> : null}
        <section className={`${styles.labPanel} ${styles.labStack}`}><div><p className={styles.eyebrow}>Ways to participate</p><h2>{isNewParticipant && onboardingOpportunities.length ? 'More work to join after onboarding' : 'Open opportunities'}</h2></div>{regularOpportunities.length ? regularOpportunities.map((opportunity) => <article className={styles.labChoice} key={opportunity.id}><div><p><strong>{opportunity.title}</strong></p><small>{opportunity.location || 'Location TBD'} · {opportunity.totalOpenSlots} spot{opportunity.totalOpenSlots === 1 ? '' : 's'} open</small></div><Link className={styles.labLinkButton} href={`/aesthetic-lab/opportunities/${opportunity.id}`}>{isNewParticipant ? 'Learn more' : 'View sessions'} <ArrowUpRight size={14} /></Link></article>) : <p className={styles.emptyCopy}>{onboardingOpportunities.length ? 'Regular opportunities will appear here when this organization publishes them.' : 'No open opportunities are scheduled right now.'}</p>}</section>
      </section>
      <aside className={styles.rightRail}><section className={styles.discoveryAside}><UsersRound size={20} /><p className={styles.eyebrow}>Showing up</p><h2>Start with a clear next step.</h2><p>Every listed opportunity includes current capacity and location details.</p><Link href="/aesthetic-lab/opportunities">Browse opportunities</Link></section></aside>
    </section>
  </main>
}
