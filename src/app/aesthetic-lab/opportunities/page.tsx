import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Heart,
  MapPin,
  SlidersHorizontal,
  Sparkles,
  UsersRound,
} from 'lucide-react'
import { LabHeader } from '../LabHeader'
import styles from '../prototype.module.css'

const opportunities = [
  { day: 'SAT', date: '16', title: 'Pantry packing crew', organization: 'East Bay Food Collective', time: '10:00 AM – 1:00 PM', place: 'Berkeley Food Hub', people: '8 of 12 spots open', tone: 'mint' },
  { day: 'SUN', date: '17', title: 'Creek restoration morning', organization: 'Friends of Codornices Creek', time: '9:30 AM – 12:00 PM', place: 'North Berkeley', people: '14 of 20 spots open', tone: 'blue' },
  { day: 'TUE', date: '19', title: 'Community tech support', organization: 'Berkeley Tool Library', time: '5:30 PM – 7:30 PM', place: 'South Berkeley Senior Center', people: '3 of 6 spots open', tone: 'coral' },
]

export default function OpportunitiesLabPage() {
  return (
    <main className={styles.app}>
      <LabHeader activeSection="opportunities" />

      <div className={styles.detailLayout}>
        <aside className={styles.leftRail}>
          <section className={styles.cityCard}>
            <div className={styles.cityCardTop}><span className={styles.cityOverline}>Showing opportunities in</span><button type="button" aria-label="Change city"><ChevronDown size={16} /></button></div>
            <div className={styles.cityName}><MapPin size={17} /><span>Berkeley, CA</span></div>
            <p>Browse ways to help close to where you live, work, and spend time.</p>
            <a href="#">Explore city network <ArrowUpRight size={14} /></a>
          </section>

          <section className={styles.filterCard}>
            <div className={styles.sectionHeading}><p className={styles.eyebrow}>Refine your view</p><SlidersHorizontal size={16} /></div>
            <div className={styles.filterStack}>
              <button type="button" className={styles.filterSelected}>Open this week</button>
              <button type="button">Food access</button>
              <button type="button">Environment</button>
              <button type="button">Youth &amp; learning</button>
            </div>
          </section>
        </aside>

        <section className={styles.primaryColumn} aria-label="Available volunteer opportunities">
          <div className={styles.pageIntro}>
            <p className={styles.eyebrow}>Berkeley volunteer board</p>
            <h1>Find a way to show up.</h1>
            <p>Every opportunity comes from an approved local organization. Choose the time and cause that feel right to you.</p>
          </div>

          <section className={styles.onboardingCallout}>
            <span className={styles.calloutIcon}><Sparkles size={20} /></span>
            <div><p className={styles.eyebrow}>A good first step</p><h2>Start with an onboarding session.</h2><p>Complete one session to become a City Member and unlock local opportunities.</p></div>
            <a href="#">See sessions <ArrowUpRight size={17} /></a>
          </section>

          <div className={styles.listHeading}><div><p className={styles.eyebrow}>Open opportunities</p><h2>12 ways to help this week</h2></div><button type="button">Soonest first <ChevronDown size={15} /></button></div>
          <div className={styles.opportunityList}>
            {opportunities.map((opportunity) => (
              <article className={styles.opportunityCard} key={opportunity.title}>
                <div className={`${styles.opportunityDate} ${styles[opportunity.tone]}`}><span>{opportunity.day}</span><strong>{opportunity.date}</strong></div>
                <div className={styles.opportunityMain}>
                  <p className={styles.orgLine}><Building2 size={14} /> {opportunity.organization} <CheckCircle2 size={14} /></p>
                  <h3>{opportunity.title}</h3>
                  <p className={styles.opportunityMeta}><Clock3 size={14} /> {opportunity.time} <i /> <MapPin size={14} /> {opportunity.place}</p>
                  <p className={styles.capacityLine}><UsersRound size={14} /> {opportunity.people}</p>
                </div>
                <a href="#" className={styles.cardArrow} aria-label={`View ${opportunity.title}`}><ArrowUpRight size={19} /></a>
              </article>
            ))}
          </div>
        </section>

        <aside className={styles.rightRail}>
          <section className={styles.commitmentCard}>
            <div className={styles.sectionHeading}><p className={styles.eyebrow}>Your commitments</p><CalendarDays size={17} /></div>
            <div className={styles.commitmentEmpty}><span>+ </span><p><b>Your calendar is clear.</b><br />A commitment will appear here once you sign up.</p></div>
            <a href="#">View calendar <ArrowUpRight size={14} /></a>
          </section>

          <section className={styles.savedCard}>
            <Heart size={19} fill="currentColor" /><div><p className={styles.eyebrow}>Saved for later</p><strong>3 opportunities</strong><span>Come back when you&apos;re ready.</span></div><ArrowUpRight size={16} />
          </section>
        </aside>
      </div>
    </main>
  )
}
