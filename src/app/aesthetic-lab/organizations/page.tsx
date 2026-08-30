import Link from 'next/link'
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Compass,
  Heart,
  MapPin,
  Search,
  Sparkles,
  UsersRound,
} from 'lucide-react'
import { requireRole } from '@/lib/auth/session'
import { listPublicIssuers } from '@/lib/services/profile'
import { getLabWorkspace } from '../lab-workspace'
import { LabHeader } from '../LabHeader'
import styles from '../prototype.module.css'

export const dynamic = 'force-dynamic'

function initials(name: string) {
  return name.split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase()
}

export default async function OrganizationsLabPage({ searchParams }: { searchParams: { q?: string; cause?: string } }) {
  const session = await requireRole('participant')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const search = searchParams.q?.trim() ?? ''
  const cause = searchParams.cause?.trim() ?? ''
  const organizations = await listPublicIssuers({ cityId: city?.id, search, cause })
  const causes = Array.from(new Set(organizations.flatMap((organization) => organization.causes))).slice(0, 5)

  return (
    <main className={styles.app}>
      <LabHeader activeSection="organizations" session={session} city={city} cities={cities} contexts={contexts} />

      <div className={styles.detailLayout}>
        <aside className={styles.leftRail}>
          <section className={styles.cityCard}>
            <div className={styles.cityCardTop}><span className={styles.cityOverline}>Discover in</span></div>
            <div className={styles.cityName}><MapPin size={17} /><span>{city?.name ?? 'Choose a city'}</span></div>
            <p>Every organization here is part of the local City/Sync network.</p>
          </section>

          <section className={styles.filterCard}>
            <div className={styles.sectionHeading}><p className={styles.eyebrow}>Causes nearby</p><Compass size={16} /></div>
            <div className={styles.filterStack}>
              <Link className={!cause ? styles.filterSelected : undefined} href="/aesthetic-lab/organizations">All organizations</Link>
              {causes.map((item) => <Link className={cause === item ? styles.filterSelected : undefined} href={`/aesthetic-lab/organizations?cause=${encodeURIComponent(item)}`} key={item}>{item}</Link>)}
            </div>
          </section>
        </aside>

        <section className={styles.primaryColumn} aria-label="Discover organizations">
          <div className={styles.pageIntro}>
            <p className={styles.eyebrow}>Discover organizations</p>
            <h1>Find the people moving your city forward.</h1>
            <p>Explore organizations close to home, learn what they are working on, and find a meaningful way to take part.</p>
          </div>

          <form action="/aesthetic-lab/organizations" method="get" className={styles.organizationSearch}>
            {cause ? <input type="hidden" name="cause" value={cause} /> : null}
            <Search size={18} aria-hidden="true" />
            <input type="search" name="q" defaultValue={search} placeholder={`Search ${city?.name ?? ''} organizations`} aria-label="Search organizations" />
          </form>

          <div className={styles.listHeading}><div><p className={styles.eyebrow}>Organizations in {city?.name ?? 'your network'}</p><h2>{organizations.length} local partner{organizations.length === 1 ? '' : 's'}</h2></div><span>Featured first</span></div>
          <div className={styles.organizationList}>
            {organizations.length === 0 ? <section className={styles.calendarEmpty}><Building2 size={20} /><div><b>No organizations match this view.</b><p>Try another cause or check back as more local partners join your city network.</p></div></section> : organizations.map((organization, index) => (
              <article className={styles.organizationCard} key={organization.org.id}>
                <div className={`${styles.organizationArt} ${styles[index % 3 === 0 ? 'foodArt' : index % 3 === 1 ? 'toolArt' : 'creekArt']}`}><span>{initials(organization.org.name)}</span><i /><i /><i /></div>
                <div className={styles.organizationDetails}>
                  <p className={styles.organizationCause}>{organization.causes[0] ?? 'Community organization'}</p>
                  <h3>{organization.org.name} <CheckCircle2 size={15} /></h3>
                  <p>{organization.tagline || organization.org.description || 'A City/Sync organization helping its local community.'}</p>
                  <div><span><UsersRound size={14} /> {organization.openCount} open opportunit{organization.openCount === 1 ? 'y' : 'ies'}</span><Link href={`/aesthetic-lab/organizations/${organization.org.slug}`}>Visit organization <ArrowUpRight size={14} /></Link></div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className={styles.rightRail}>
          <section className={styles.discoveryAside}>
            <span className={styles.discoveryIcon}><Sparkles size={20} /></span>
            <p className={styles.eyebrow}>Start locally</p>
            <h2>One onboarding session opens a city.</h2>
            <p>Get to know an organization before you take on regular opportunities.</p>
            <Link href="/aesthetic-lab/opportunities">Find onboarding <ArrowUpRight size={14} /></Link>
          </section>
          <section className={styles.organizationNote}><Building2 size={18} /><p><b>Organizations set their own opportunities.</b><br />You can browse first and sign up when a shift is right for you.</p></section>
        </aside>
      </div>
    </main>
  )
}
