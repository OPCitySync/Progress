import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  Compass,
  Heart,
  MapPin,
  Search,
  Sparkles,
  UsersRound,
} from 'lucide-react'
import { LabHeader } from '../LabHeader'
import styles from '../prototype.module.css'

const organizations = [
  { name: 'East Bay Food Collective', cause: 'Food access', description: 'A neighborhood-powered pantry building dignified, reliable access to good food.', detail: '6 open opportunities', initials: 'EB', art: 'foodArt' },
  { name: 'Berkeley Tool Library', cause: 'Circular economy', description: 'Sharing tools, skills, and repair knowledge so useful things stay in use longer.', detail: '3 open opportunities', initials: 'BT', art: 'toolArt' },
  { name: 'Friends of Codornices Creek', cause: 'Environment', description: 'Restoring an urban watershed with hands-on care for the creek and its neighbors.', detail: '4 open opportunities', initials: 'FC', art: 'creekArt' },
]

export default function OrganizationsLabPage() {
  return (
    <main className={styles.app}>
      <LabHeader activeSection="organizations" />

      <div className={styles.detailLayout}>
        <aside className={styles.leftRail}>
          <section className={styles.cityCard}>
            <div className={styles.cityCardTop}><span className={styles.cityOverline}>Discover in</span><button type="button" aria-label="Change city"><ChevronDown size={16} /></button></div>
            <div className={styles.cityName}><MapPin size={17} /><span>Berkeley, CA</span></div>
            <p>Every organization here is part of the local City/Sync network.</p>
            <a href="#">Explore city network <ArrowUpRight size={14} /></a>
          </section>

          <section className={styles.filterCard}>
            <div className={styles.sectionHeading}><p className={styles.eyebrow}>Causes nearby</p><Compass size={16} /></div>
            <div className={styles.filterStack}>
              <button type="button" className={styles.filterSelected}>All organizations</button>
              <button type="button">Food access</button>
              <button type="button">Environment</button>
              <button type="button">Youth &amp; learning</button>
              <button type="button">Community care</button>
            </div>
          </section>
        </aside>

        <section className={styles.primaryColumn} aria-label="Discover organizations">
          <div className={styles.pageIntro}>
            <p className={styles.eyebrow}>Discover organizations</p>
            <h1>Find the people moving your city forward.</h1>
            <p>Explore organizations close to home, learn what they are working on, and find a meaningful way to take part.</p>
          </div>

          <label className={styles.organizationSearch}>
            <Search size={18} aria-hidden="true" />
            <input type="search" placeholder="Search Berkeley organizations" aria-label="Search Berkeley organizations" />
          </label>

          <div className={styles.listHeading}><div><p className={styles.eyebrow}>Organizations in Berkeley</p><h2>7 local partners</h2></div><button type="button">Featured first <ChevronDown size={15} /></button></div>
          <div className={styles.organizationList}>
            {organizations.map((organization) => (
              <article className={styles.organizationCard} key={organization.name}>
                <div className={`${styles.organizationArt} ${styles[organization.art]}`}><span>{organization.initials}</span><i /><i /><i /></div>
                <div className={styles.organizationDetails}>
                  <p className={styles.organizationCause}>{organization.cause}</p>
                  <h3>{organization.name} <CheckCircle2 size={15} /></h3>
                  <p>{organization.description}</p>
                  <div><span><UsersRound size={14} /> {organization.detail}</span><a href="#">Visit organization <ArrowUpRight size={14} /></a></div>
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
            <a href="#">Find onboarding <ArrowUpRight size={14} /></a>
          </section>
          <section className={styles.savedCard}>
            <Heart size={19} fill="currentColor" /><div><p className={styles.eyebrow}>Saved organizations</p><strong>2 local partners</strong><span>Keep track of places you care about.</span></div><ArrowUpRight size={16} />
          </section>
          <section className={styles.organizationNote}><Building2 size={18} /><p><b>Organizations set their own opportunities.</b><br />You can browse first and sign up when a shift is right for you.</p></section>
        </aside>
      </div>
    </main>
  )
}
