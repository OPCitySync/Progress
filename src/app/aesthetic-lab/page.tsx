import {
  ArrowUpRight,
  Bookmark,
  Building2,
  CalendarDays,
  ChevronDown,
  Heart,
  MapPin,
  Sparkles,
} from 'lucide-react'
import { LabHeader } from './LabHeader'
import { MyCityFeedContent } from './MyCityFeedContent'
import styles from './prototype.module.css'

const impactItems = [
  { value: '04', label: 'Active shifts' },
  { value: '18h', label: 'Service this month' },
  { value: '07', label: 'Local organizations' },
]

const cityNotes = [
  { label: 'Civic gardens', detail: '3 open shifts this week', color: 'sun' },
  { label: 'Food access', detail: '2 organizations active today', color: 'blue' },
  { label: 'Youth & learning', detail: 'Orientation Thursday', color: 'coral' },
]

/**
 * A static, local-only visual study. It intentionally has no app data or
 * workflows behind it: this is for judging composition, hierarchy, and tone.
 */
export default function AestheticLabPage() {
  return (
    <main className={styles.app}>
      <LabHeader activeSection="feed" />

      <div className={styles.layout}>
        <aside className={styles.leftRail}>
          <section className={styles.cityCard}>
            <div className={styles.cityCardTop}>
              <span className={styles.cityOverline}>Your city network</span>
              <button type="button" aria-label="Switch city"><ChevronDown size={16} /></button>
            </div>
            <div className={styles.cityName}><MapPin size={17} /><span>Berkeley, CA</span></div>
            <p>A shared place to show up, help out, and see local progress.</p>
            <a href="#">Explore city network <ArrowUpRight size={14} /></a>
          </section>

          <section className={styles.impactCard}>
            <p className={styles.eyebrow}>Your impact</p>
            <div className={styles.impactGrid}>
              {impactItems.map((item) => <div key={item.label}><strong>{item.value}</strong><span>{item.label}</span></div>)}
            </div>
            <a href="#"><Bookmark size={15} /> View service history</a>
          </section>

          <section className={styles.quickLinks}>
            <a href="#"><CalendarDays size={17} /> My commitments</a>
            <a href="#"><Building2 size={17} /> My organizations</a>
            <a href="#"><Heart size={17} /> Saved opportunities</a>
          </section>
        </aside>

        <section className={styles.feed} aria-label="MyCity Feed">
          <div className={styles.welcomeBand}>
            <div><p className={styles.eyebrow}>Good morning, naynaysoo</p><h1>There are good things happening today.</h1></div>
          </div>
          <MyCityFeedContent />
        </section>

        <aside className={styles.rightRail}>
          <section className={styles.profileCard}>
            <div className={styles.profileCover}><i /><i /><i /></div>
            <div className={styles.profileBody}>
              <div className={styles.avatarLarge}>N</div>
              <div className={styles.profileTitle}><p className={styles.eyebrow}>Civic participant</p><h2>naynaysoo</h2><p>Berkeley, California</p></div>
              <div className={styles.membershipStatus}>
                <span><Sparkles size={15} /> New participant</span>
                <p>Complete one local onboarding session to become a City Member.</p>
                <div><i /><i /><i /></div>
                <a href="#">Find onboarding <ArrowUpRight size={14} /></a>
              </div>
            </div>
          </section>

          <section className={styles.todayEventsCard}>
            <div className={styles.sectionHeading}><p className={styles.eyebrow}>Today&apos;s events</p><CalendarDays size={17} /></div>
            <div className={styles.todayEventList}>
              <a href="#"><span>9:30<small>AM</small></span><div><b>Creek restoration check-in</b><p>North Berkeley</p></div><ArrowUpRight size={14} /></a>
              <a href="#"><span>5:30<small>PM</small></span><div><b>Community tech support</b><p>South Berkeley Senior Center</p></div><ArrowUpRight size={14} /></a>
              <a href="#"><span>6:00<small>PM</small></span><div><b>New participant onboarding</b><p>East Bay Food Collective</p></div><ArrowUpRight size={14} /></a>
            </div>
            <a className={styles.viewEventsLink} href="#">View city calendar <ArrowUpRight size={14} /></a>
          </section>

          <section className={styles.cityPulse}>
            <div className={styles.sectionHeading}><p className={styles.eyebrow}>Berkeley pulse</p><span>Live</span></div>
            {cityNotes.map((note) => <a key={note.label} href="#" className={styles.pulseItem}><i className={styles[note.color]} /><span><b>{note.label}</b><small>{note.detail}</small></span><ArrowUpRight size={15} /></a>)}
          </section>
        </aside>
      </div>
    </main>
  )
}
