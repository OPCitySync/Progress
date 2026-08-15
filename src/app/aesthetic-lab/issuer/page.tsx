import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileBarChart2,
  MapPin,
  MoreHorizontal,
  Plus,
  Send,
  Sparkles,
  UsersRound,
} from 'lucide-react'
import { LabHeader } from '../LabHeader'
import { IssuerLabSidebar } from './IssuerLabSidebar'
import styles from '../prototype.module.css'

const upcomingShifts = [
  { day: 'WED', date: '12', time: '4:00 PM', title: 'Produce delivery sort', count: '5 / 8', tone: 'blue' },
  { day: 'THU', date: '13', time: '6:00 PM', title: 'New participant onboarding', count: '9 / 12', tone: 'gold' },
  { day: 'SAT', date: '15', time: '10:00 AM', title: 'Pantry packing crew', count: '8 / 12', tone: 'ink' },
]

const opportunities = [
  { title: 'Pantry packing crew', schedule: 'Saturday · 10:00 AM', volunteers: '8 of 12 confirmed', status: 'Open', tone: 'open' },
  { title: 'Home delivery route', schedule: 'Sunday · 9:30 AM', volunteers: '2 of 4 confirmed', status: 'Open', tone: 'open' },
  { title: 'New participant onboarding', schedule: 'Thursday · 6:00 PM', volunteers: '9 of 12 confirmed', status: 'Onboarding', tone: 'onboarding' },
]

const roster = [
  { name: 'Ari Santos', initials: 'AS', detail: 'Pantry packing · Saturday', state: 'Confirmed' },
  { name: 'Samira Patel', initials: 'SP', detail: 'New participant onboarding', state: 'New participant' },
  { name: 'Morgan Lee', initials: 'ML', detail: 'Home delivery route · Sunday', state: 'Awaiting reply' },
]

/** A visual-only operational dashboard for judging the Issuer Organization experience. */
export default function IssuerAestheticLabPage() {
  return (
    <main className={styles.app}>
      <LabHeader activeSection="issuer-overview" workspace="issuer" />

      <div className={styles.issuerLayout}>
        <IssuerLabSidebar active="overview" />

        <section className={styles.issuerMain} id="overview" aria-label="Organization workspace">
          <section className={styles.issuerHero}>
            <div>
              <p className={styles.eyebrow}>Organization workspace</p>
              <h2>Keep the good work moving.</h2>
              <p>Three shifts need attention before the week gets underway. Here is the clearest next step for each one.</p>
            </div>
            <div className={styles.issuerHeroActions}>
              <button type="button" className={styles.issuerPrimaryAction}><Plus size={18} /> Post opportunity</button>
              <button type="button" className={styles.issuerSecondaryAction}><Send size={17} /> Message roster</button>
            </div>
          </section>

          <section className={styles.issuerMetricGrid} aria-label="Organization metrics">
            <article><span>12</span><div><b>Open volunteer spots</b><small>Across 3 published opportunities</small></div><ArrowUpRight size={16} /></article>
            <article><span>23</span><div><b>Active volunteers</b><small>6 joined this month</small></div><ArrowUpRight size={16} /></article>
            <article><span>86%</span><div><b>Show-up rate</b><small>Healthy for the last 30 days</small></div><ArrowUpRight size={16} /></article>
          </section>

          <section className={styles.issuerScheduleCard}>
            <div className={styles.issuerPanelHeading}>
              <div><p className={styles.eyebrow}>This week</p><h2>Volunteer schedule</h2></div>
              <a href="#catalog">Open calendar <ArrowUpRight size={14} /></a>
            </div>
            <div className={styles.issuerScheduleTrack}>
              {upcomingShifts.map((shift) => (
                <article key={shift.title} className={`${styles.issuerShift} ${styles[shift.tone]}`}>
                  <div><span>{shift.day}</span><strong>{shift.date}</strong></div>
                  <p><b>{shift.title}</b><small><Clock3 size={13} /> {shift.time}</small></p>
                  <span className={styles.shiftCount}>{shift.count}</span>
                </article>
              ))}
            </div>
            <div className={styles.issuerScheduleNote}><Sparkles size={17} /><span><b>Thursday&apos;s onboarding session is nearly full.</b> Add a second session if you want to welcome more new participants this week.</span><a href="#catalog">Set up <ChevronRight size={15} /></a></div>
          </section>

          <section className={styles.issuerCatalogCard} id="catalog">
            <div className={styles.issuerPanelHeading}>
              <div><p className={styles.eyebrow}>Opportunity catalog</p><h2>Published opportunities</h2></div>
              <button type="button" className={styles.issuerTextButton}>Manage templates <ArrowUpRight size={14} /></button>
            </div>
            <div className={styles.issuerOpportunityList}>
              {opportunities.map((opportunity) => (
                <article key={opportunity.title}>
                  <span className={`${styles.issuerStatus} ${styles[opportunity.tone]}`}>{opportunity.status}</span>
                  <div><h3>{opportunity.title}</h3><p><CalendarDays size={14} /> {opportunity.schedule} <i /> <UsersRound size={14} /> {opportunity.volunteers}</p></div>
                  <button type="button" aria-label={`Manage ${opportunity.title}`}><MoreHorizontal size={20} /></button>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.issuerManagementGrid} aria-label="Organization management">
            <section className={styles.issuerRosterCard} id="volunteers">
              <div className={styles.issuerPanelHeading}>
                <div><p className={styles.eyebrow}>Volunteer roster</p><h2>People to know today</h2></div>
                <UsersRound size={18} />
              </div>
              <div className={styles.issuerRosterList}>
                {roster.map((person) => (
                  <a href="#volunteers" key={person.name}>
                    <span className={styles.rosterAvatar}>{person.initials}</span>
                    <div><b>{person.name}</b><small>{person.detail}</small></div>
                    <em>{person.state}</em>
                  </a>
                ))}
              </div>
              <a className={styles.issuerFooterLink} href="#volunteers">View full roster <ArrowUpRight size={14} /></a>
            </section>

            <section className={styles.issuerMessageCard}>
              <span><Send size={19} /></span>
              <div><p className={styles.eyebrow}>Roster note</p><h2>Send a helpful reminder.</h2><p>Three volunteers have not responded to their upcoming shifts.</p></div>
              <button type="button">Message volunteers <ArrowUpRight size={14} /></button>
            </section>

            <section className={styles.issuerReportCard} id="reports">
              <div className={styles.issuerPanelHeading}><div><p className={styles.eyebrow}>Impact snapshot</p><h2>Made visible</h2></div><FileBarChart2 size={18} /></div>
              <div className={styles.issuerImpactBars}>
                <div><span>Volunteer hours</span><strong>148</strong><i><b /></i></div>
                <div><span>Neighbors served</span><strong>312</strong><i><b /></i></div>
                <div><span>Food boxes packed</span><strong>486</strong><i><b /></i></div>
              </div>
              <a href="#reports">Open reporting view <ArrowUpRight size={14} /></a>
            </section>

            <section className={styles.issuerPublicProfileCard} id="profile">
              <div><MapPin size={17} /><span>Public profile</span></div>
              <h2>What people see before they join you.</h2>
              <p>Mission, opportunities, onboarding, and how to get involved—clear and ready to share.</p>
              <a href="#profile">Preview profile <ArrowUpRight size={14} /></a>
            </section>
          </section>
        </section>

      </div>
    </main>
  )
}
