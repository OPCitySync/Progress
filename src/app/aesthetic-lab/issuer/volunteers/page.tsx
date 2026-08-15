import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  Mail,
  MessageCircle,
  Search,
  Send,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react'
import { LabHeader } from '../../LabHeader'
import { IssuerLabSidebar } from '../IssuerLabSidebar'
import styles from '../../prototype.module.css'

const volunteers = [
  { name: 'Ari Santos', initials: 'AS', email: 'ari.santos@samplemail.org', activity: 'Pantry packing crew · Saturday', state: 'Confirmed', note: '4 shifts completed · Active participant', tone: 'confirmed' },
  { name: 'Samira Patel', initials: 'SP', email: 'samira.patel@samplemail.org', activity: 'New participant onboarding · Thursday', state: 'New participant', note: 'First session this week', tone: 'new' },
  { name: 'Morgan Lee', initials: 'ML', email: 'morgan.lee@samplemail.org', activity: 'Home delivery route · Sunday', state: 'Awaiting reply', note: '2 shifts completed · Active participant', tone: 'waiting' },
  { name: 'Jun Park', initials: 'JP', email: 'jun.park@samplemail.org', activity: 'Pantry packing crew · Saturday', state: 'Confirmed', note: '6 shifts completed · Active participant', tone: 'confirmed' },
]

export default function IssuerVolunteersLabPage() {
  return (
    <main className={styles.app}>
      <LabHeader activeSection="issuer-volunteers" workspace="issuer" />
      <div className={styles.issuerLayout}>
        <IssuerLabSidebar active="volunteers" />

        <section className={styles.issuerMain} aria-label="Volunteer roster">
          <section className={styles.issuerPageHero}>
            <div><p className={styles.eyebrow}>Volunteer roster</p><h1>See people, not sign-ups.</h1><p>A practical view of who is expected, who is new, and where a timely nudge could make a difference.</p></div>
            <button type="button" className={styles.issuerPrimaryAction}><Send size={17} /> Message volunteers</button>
          </section>

          <section className={styles.rosterMetricGrid}>
            <article><UsersRound size={19} /><div><b>23 active volunteers</b><span>6 joined this month</span></div></article>
            <article><Check size={19} /><div><b>17 confirmed this week</b><span>Across 4 upcoming shifts</span></div></article>
            <article><MessageCircle size={19} /><div><b>3 awaiting a reply</b><span>A light reminder may help</span></div></article>
          </section>

          <section className={styles.rosterWorkspaceCard}>
            <div className={styles.issuerPanelHeading}><div><p className={styles.eyebrow}>Full roster</p><h2>People signed up with your organization</h2></div><button type="button" className={styles.issuerTextButton}>Export roster <ArrowUpRight size={14} /></button></div>
            <div className={styles.rosterToolbar}><label><Search size={16} /><input type="search" placeholder="Search volunteers" /></label><button type="button">All shifts <ChevronDown size={15} /></button><button type="button">All statuses <ChevronDown size={15} /></button></div>
            <div className={styles.volunteerRows}>
              {volunteers.map((volunteer) => (
                <article key={volunteer.email}>
                  <span className={styles.volunteerAvatar}>{volunteer.initials}</span>
                  <div className={styles.volunteerIdentity}><h3>{volunteer.name}</h3><a href={`mailto:${volunteer.email}`}><Mail size={13} /> {volunteer.email}</a></div>
                  <div className={styles.volunteerActivity}><b>{volunteer.activity}</b><span>{volunteer.note}</span></div>
                  <span className={`${styles.volunteerState} ${styles[volunteer.tone]}`}>{volunteer.state}</span>
                  <button type="button" aria-label={`Message ${volunteer.name}`}><MessageCircle size={17} /></button>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.rosterActionGrid}>
            <section className={styles.rosterMessageCard}><span><Send size={19} /></span><div><p className={styles.eyebrow}>A well-timed note</p><h2>Message a group without losing the human context.</h2><p>Start with an audience, then choose everyone or a few specific volunteers.</p></div><button type="button">Open messages <ArrowUpRight size={14} /></button></section>
            <section className={styles.rosterOnboardingCard}><span><UserRoundCheck size={19} /></span><div><p className={styles.eyebrow}>New participants</p><h2>4 people are beginning with you.</h2><p>They become City Members after completing their onboarding session.</p></div><a href="#">View onboarding group <ArrowUpRight size={14} /></a></section>
          </section>
        </section>
      </div>
    </main>
  )
}
