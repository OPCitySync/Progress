import Link from 'next/link'
import { ArrowUpRight, Building2, FileText, MapPin } from 'lucide-react'
import { requireRole } from '@/lib/auth/session'
import { listPublicIssuers } from '@/lib/services/profile'
import { getPublishedOrganizationResources } from '@/lib/services/organization-resources'
import { organizationFileUrl } from '@/lib/storage/organization-file-url'
import { getLabWorkspace } from '../lab-workspace'
import { LabHeader } from '../LabHeader'
import styles from '../prototype.module.css'

export const dynamic = 'force-dynamic'

export default async function VolunteerResourcesPage() {
  const session = await requireRole('participant')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const organizations = await listPublicIssuers({ cityId: city?.id })
  const resources = await getPublishedOrganizationResources({
    orgIds: organizations.map(({ org }) => org.id),
    destination: 'volunteer_resources',
  })
  const organizationById = new Map(organizations.map(({ org }) => [org.id, org]))

  return <main className={styles.app}>
    <LabHeader activeSection="resources" session={session} city={city} cities={cities} contexts={contexts} />
    <section className={styles.detailLayout}>
      <aside className={styles.leftRail}><section className={styles.cityCard}><MapPin size={20} /><h2>{city?.name ?? 'Your city network'}</h2><p>Resources deliberately shared by organizations in your current City/Sync network.</p><Link href="/aesthetic-lab/organizations">Discover organizations <ArrowUpRight size={14} /></Link></section></aside>
      <section className={styles.primaryColumn} aria-label="Volunteer Resources">
        <div className={styles.pageIntro}><p className={styles.eyebrow}>Volunteer resources</p><h1>Prepared by organizations, ready when you are.</h1><p>Find guides, safety materials, planning tools, and other resources local organizations have chosen to share.</p></div>
        <section className={`${styles.labPanel} ${styles.labStack}`}>
          <div><p className={styles.eyebrow}>Shared locally</p><h2>{resources.length} resource{resources.length === 1 ? '' : 's'} available</h2></div>
          {resources.length ? <div className={styles.labChoiceList}>{resources.map((resource) => {
            const organization = organizationById.get(resource.orgId)
            return <article className={styles.labChoice} key={`${resource.kind}-${resource.id}`}>
              <div><p><strong><FileText size={15} /> {resource.title}</strong></p><small>{organization?.name ?? 'Local organization'} · {resource.kind === 'waiver' ? 'Liability waiver' : 'Volunteer resource'}</small>{resource.body ? <details><summary>Read guidance</summary><p>{resource.body}</p></details> : null}</div>
              <div className={styles.resourceCardActions}>{organization ? <Link className={styles.issuerTextButton} href={`/aesthetic-lab/organizations/${organization.slug}`}><Building2 size={14} /> Organization</Link> : null}{resource.documentUrl ? <a className={styles.issuerTextButton} href={organizationFileUrl(resource.kind, resource.id)} target="_blank" rel="noreferrer">Open document</a> : null}</div>
            </article>
          })}</div> : <p className={styles.emptyCopy}>No organizations have shared resources in this city yet. Check back as local partners add materials.</p>}
        </section>
      </section>
      <aside className={styles.rightRail}><section className={styles.discoveryAside}><FileText size={20} /><p className={styles.eyebrow}>Use what helps</p><h2>Resources are optional.</h2><p>Each organization decides what to share; choose the materials that help you prepare for a shift or learn about its work.</p></section></aside>
    </section>
  </main>
}
