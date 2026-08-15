import {
  ArrowUpRight,
  Award,
  Building2,
  CalendarDays,
  CheckCircle2,
  Download,
  Heart,
  MapPin,
  Share2,
  Sparkles,
} from 'lucide-react'
import { LabHeader } from '../LabHeader'
import styles from '../prototype.module.css'

const entries = [
  { date: '06 AUG', title: 'Neighborhood garden workday', organization: 'Berkeley Community Gardens', detail: '3 hours · Ohlone Greenway', icon: 'garden' },
  { date: '30 JUL', title: 'Fix-It Clinic support', organization: 'Berkeley Tool Library', detail: '2.5 hours · Ashby Community Center', icon: 'repair' },
  { date: '19 JUL', title: 'Pantry packing crew', organization: 'East Bay Food Collective', detail: '4 hours · Berkeley Food Hub', icon: 'food' },
]

export default function HistoryLabPage() {
  return (
    <main className={styles.app}>
      <LabHeader activeSection="history" />

      <div className={styles.detailLayout}>
        <aside className={styles.leftRail}>
          <section className={styles.impactCard}>
            <p className={styles.eyebrow}>Your year in service</p>
            <div className={styles.impactGrid}>
              <div><strong>18h</strong><span>Hours contributed</span></div>
              <div><strong>05</strong><span>Completed shifts</span></div>
              <div><strong>03</strong><span>Organizations helped</span></div>
            </div>
            <a href="#"><Award size={15} /> Your contribution summary</a>
          </section>
          <section className={styles.quickLinks}>
            <a href="#"><Heart size={17} /> Saved opportunities</a>
            <a href="#"><CalendarDays size={17} /> Upcoming commitments</a>
            <a href="#"><Building2 size={17} /> Your organizations</a>
          </section>
        </aside>

        <section className={styles.primaryColumn} aria-label="Service History">
          <div className={styles.pageIntro}>
            <p className={styles.eyebrow}>Service history</p>
            <h1>Your time leaves a useful record.</h1>
            <p>Keep a clear, participant-owned history of the ways you&apos;ve contributed across your city network.</p>
          </div>

          <section className={styles.serviceResumeCard}>
            <div className={styles.resumeSeal}><CheckCircle2 size={25} /></div>
            <div><p className={styles.eyebrow}>Shareable service resume</p><h2>naynaysoo&apos;s Berkeley service record</h2><p>5 completed shifts · 18 verified volunteer hours · Updated today</p></div>
            <div className={styles.resumeActions}><button type="button"><Share2 size={16} /> Share</button><button type="button"><Download size={16} /> Export</button></div>
          </section>

          <div className={styles.listHeading}><div><p className={styles.eyebrow}>Completed opportunities</p><h2>Recent service</h2></div><span className={styles.yearTag}>2026</span></div>
          <div className={styles.historyTimeline}>
            {entries.map((entry) => (
              <article className={styles.historyEntry} key={entry.title}>
                <div className={styles.historyDate}>{entry.date.split(' ')[0]}<strong>{entry.date.split(' ')[1]}</strong></div>
                <span className={`${styles.historyIcon} ${styles[entry.icon]}`}><Sparkles size={17} /></span>
                <div><p className={styles.orgLine}><Building2 size={14} /> {entry.organization} <CheckCircle2 size={14} /></p><h3>{entry.title}</h3><p className={styles.historyMeta}><CalendarDays size={14} /> {entry.detail}</p></div>
                <button type="button" aria-label={`Open ${entry.title}`}><ArrowUpRight size={18} /></button>
              </article>
            ))}
          </div>
        </section>

        <aside className={styles.rightRail}>
          <section className={styles.cityCard}>
            <div className={styles.cityCardTop}><span className={styles.cityOverline}>Your city membership</span><CheckCircle2 size={17} /></div>
            <div className={styles.cityName}><MapPin size={17} /><span>Berkeley, CA</span></div>
            <p>Each completed local activity makes your city record more complete.</p>
            <a href="#">Explore your city <ArrowUpRight size={14} /></a>
          </section>
          <section className={styles.historyAsideCard}><p className={styles.eyebrow}>Keep going</p><strong>1 onboarding session</strong><span>is all that&apos;s needed to become a City Member.</span><a href="#">Find onboarding <ArrowUpRight size={14} /></a></section>
        </aside>
      </div>
    </main>
  )
}
