'use client'

import { useState } from 'react'
import {
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  MessageSquareText,
  Newspaper,
  Plus,
  Sparkles,
  Users,
} from 'lucide-react'
import styles from './IssuerHomeConcept.module.css'

const organizationName = 'Berkeley Neighbors'

const workAreas = [
  {
    id: 'people',
    label: 'People',
    summary: 'Recruitment and onboarding',
    icon: Users,
    rows: [
      { label: 'Applications', count: 3, tone: 'gold', action: 'Review' },
      { label: 'Onboarding', count: 4, tone: 'neutral', action: 'Continue' },
      { label: 'Ready for roster', count: 1, tone: 'green', action: 'Add' },
      { label: 'Responses overdue', count: 2, tone: 'red', action: 'Respond' },
    ],
  },
  {
    id: 'activities',
    label: 'Activities',
    summary: 'Staffing and delivery',
    icon: ClipboardCheck,
    rows: [
      { label: 'Staffing gaps', count: 2, tone: 'red', action: 'Staff' },
      { label: 'Preparation', count: 3, tone: 'gold', action: 'Resolve' },
      { label: 'Attendance due', count: 1, tone: 'neutral', action: 'Record' },
      { label: 'Work to verify', count: 4, tone: 'neutral', action: 'Verify' },
    ],
  },
  {
    id: 'programs',
    label: 'Programs',
    summary: 'Plans and dependencies',
    icon: BriefcaseBusiness,
    rows: [
      { label: 'Blocked work', count: 1, tone: 'red', action: 'Resolve' },
      { label: 'Overdue tasks', count: 2, tone: 'red', action: 'Review' },
      { label: 'Work submitted', count: 3, tone: 'gold', action: 'Review' },
      { label: 'Lead needed', count: 1, tone: 'neutral', action: 'Assign' },
    ],
  },
] as const

const requirementRows = [
  { label: 'Waivers missing', count: 3, note: 'Blocks 2 upcoming activities', tone: 'red' },
  { label: 'Signatures pending', count: 2, note: 'Volunteer agreements', tone: 'gold' },
  { label: 'Credentials expiring', count: 1, note: 'Driving qualification', tone: 'gold' },
  { label: 'Documents to review', count: 2, note: 'Submitted by volunteers', tone: 'neutral' },
] as const

const recentUpdates = [
  { title: 'Maya signed the liability waiver', meta: '12 min ago', tone: 'gold' },
  { title: 'Jordan joined the volunteer roster', meta: '1 hr ago', tone: 'green' },
  { title: 'Garden Restoration was rescheduled', meta: '2 hr ago', tone: 'neutral' },
  { title: 'A contribution was verified', meta: 'Yesterday', tone: 'neutral' },
] as const

const monthDays = [
  { day: 28, outside: true }, { day: 29, outside: true }, { day: 30, outside: true },
  { day: 1 }, { day: 2 }, { day: 3 }, { day: 4 },
  { day: 5, today: true }, { day: 6 }, { day: 7 }, { day: 8 }, { day: 9 }, { day: 10 }, { day: 11 },
  { day: 12 }, { day: 13 }, { day: 14 }, { day: 15 }, { day: 16 }, { day: 17 }, { day: 18 },
  { day: 19 }, { day: 20 }, { day: 21 }, { day: 22 }, { day: 23 }, { day: 24 }, { day: 25 },
  { day: 26 }, { day: 27 }, { day: 28 }, { day: 29 }, { day: 30 }, { day: 31 }, { day: 1, outside: true },
] as const

const calendarEvents = [
  { id: 'food', day: 3, title: 'Food Distribution', time: '9:00 AM', tone: 'risk', people: '9 / 12' },
  { id: 'orientation', day: 5, title: 'Volunteer Orientation', time: '5:30 PM', tone: 'ready', people: '6 / 6' },
  { id: 'staff', day: 6, title: 'Staff Check-in', time: '10:00 AM', tone: 'blue', people: '4' },
  { id: 'garden', day: 8, title: 'Garden Restoration', time: '10:00 AM', tone: 'watch', people: '6 / 10' },
  { id: 'delivery', day: 11, title: 'Senior Delivery Route', time: '11:00 AM', tone: 'blue', people: '4 / 6' },
  { id: 'welcome', day: 14, title: 'Welcome Session', time: '5:30 PM', tone: 'ready', people: '8' },
  { id: 'packing', day: 17, title: 'Community Packing', time: '8:30 AM', tone: 'gold', people: '10 / 14' },
  { id: 'route', day: 21, title: 'Route Planning', time: '3:00 PM', tone: 'blue', people: '5' },
  { id: 'distribution', day: 24, title: 'Food Distribution', time: '9:00 AM', tone: 'gold', people: '7 / 12' },
  { id: 'partner', day: 28, title: 'Partner Roundtable', time: '1:00 PM', tone: 'blue', people: '6' },
] as const

const weekDays = [
  { day: 5, label: 'Mon' }, { day: 6, label: 'Tue' }, { day: 7, label: 'Wed' },
  { day: 8, label: 'Thu' }, { day: 9, label: 'Fri' }, { day: 10, label: 'Sat' }, { day: 11, label: 'Sun' },
] as const

export default function IssuerHomeOperatingBrief() {
  const [calendarView, setCalendarView] = useState<'month' | 'week'>('month')

  return (
    <main className={styles.page}>
      <header className={styles.appHeader}>
        <div className={styles.appHeaderInner}>
          <div className={styles.brandLockup}>
            <img src="/brand/mycity-logo-gold-blue-on-white.svg" alt="mycity" />
            <span />
            <div><small>COORDINATION STUDIO</small><b>Organization Home Concept</b></div>
          </div>
          <div className={styles.headerContext}>
            <button type="button" className={styles.messageButton}><MessageSquareText size={15} /> Messages <span>3</span></button>
            <button type="button" className={styles.profileButton} aria-label={`${organizationName} profile`}><span>BN</span><ChevronDown size={14} /></button>
          </div>
        </div>
      </header>

      <div className={styles.shell}>
        <section className={styles.briefHub}>
          <div className={styles.briefHero}>
            <div className={styles.heroCopy}>
              <p><Sparkles size={13} /> MONDAY, OCTOBER 5</p>
              <h1>{organizationName}</h1>
              <span>Coordinate your organization’s people, commitments, and community presence.</span>
            </div>
            <div className={styles.heroActions}>
              <div>
                <button type="button" className={styles.feedButton}><Newspaper size={14} /> MyCity Feed</button>
              </div>
              <div>
                <button type="button" className={styles.heroPrimary}><Plus size={14} /> Schedule Activity</button>
                <button type="button"><Plus size={14} /> Create Role</button>
                <button type="button"><Plus size={14} /> Invite Volunteers</button>
                <button type="button"><Users size={14} /> Staff</button>
              </div>
            </div>
          </div>

        </section>

        <section className={styles.dashboardGrid}>
          <article className={`${styles.panel} ${styles.calendarPanel}`}>
            <header className={styles.calendarHeader}>
              <div className={styles.calendarTitle}>
                <span><CalendarDays size={16} /></span>
                <div><p>ORGANIZATION SCHEDULE</p><h2>Calendar</h2></div>
              </div>

              <div className={styles.monthNavigation}>
                <button type="button" aria-label="Previous period"><ChevronLeft size={15} /></button>
                <strong>{calendarView === 'month' ? 'October 2026' : 'October 5–11'}</strong>
                <button type="button" aria-label="Next period"><ChevronRight size={15} /></button>
              </div>

              <div className={styles.calendarTools}>
                <button type="button" className={styles.todayButton}>Today</button>
                <div className={styles.viewSwitch}>
                  <button type="button" className={calendarView === 'month' ? styles.activeView : ''} onClick={() => setCalendarView('month')}>Month</button>
                  <button type="button" className={calendarView === 'week' ? styles.activeView : ''} onClick={() => setCalendarView('week')}>Week</button>
                </div>
                <button type="button" className={styles.scheduleButton}><Plus size={14} /> Schedule</button>
              </div>
            </header>

            {calendarView === 'month' ? (
              <div className={styles.calendarBody}>
                <div className={styles.weekdayRow}>{['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map((day) => <span key={day}>{day}</span>)}</div>
                <div className={styles.monthGrid}>
                  {monthDays.map((date, index) => {
                    const outside = 'outside' in date && date.outside
                    const events = outside ? [] : calendarEvents.filter((event) => event.day === date.day)
                    return (
                      <button type="button" key={`${date.day}-${index}`} className={`${outside ? styles.outsideDay : ''} ${'today' in date && date.today ? styles.todayCell : ''}`}>
                        <span className={styles.dayNumber}>{date.day}</span>
                        <span className={styles.dayEvents}>
                          {events.map((event) => <span key={event.id} className={`${styles.calendarEvent} ${styles[event.tone]}`}><b>{event.time}</b><em>{event.title}</em></span>)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className={styles.weekView}>
                {weekDays.map((date) => {
                  const events = calendarEvents.filter((event) => event.day === date.day)
                  return (
                    <section key={date.day} className={date.day === 5 ? styles.currentWeekDay : ''}>
                      <header><span>{date.label}</span><b>{date.day}</b></header>
                      <div>
                        {events.length ? events.map((event) => (
                          <button type="button" key={event.id} className={`${styles.weekEvent} ${styles[event.tone]}`}>
                            <Clock3 size={12} /><span><b>{event.time}</b><strong>{event.title}</strong><small><Users size={10} /> {event.people}</small></span>
                          </button>
                        )) : <p>No activities</p>}
                      </div>
                    </section>
                  )
                })}
              </div>
            )}

            <footer className={styles.calendarFooter}>
              <span><i className={styles.readyKey} /> Ready</span>
              <span><i className={styles.attentionKey} /> Needs attention</span>
              <span><i className={styles.planningKey} /> In planning</span>
              <button type="button">View full schedule <ChevronRight size={13} /></button>
            </footer>
          </article>
        </section>

        <section className={styles.workboard} aria-labelledby="organization-work-title">
          <header className={styles.workboardHeader}>
            <div>
              <p>OPERATIONS</p>
              <h2 id="organization-work-title">Organization work</h2>
            </div>
            <span><i /> Actionable</span>
          </header>

          <div className={styles.workAreaGrid}>
            {workAreas.map((area) => {
              const Icon = area.icon
              return (
                <article className={styles.workAreaCard} key={area.id}>
                  <header>
                    <span><Icon size={17} /></span>
                    <div><h3>{area.label}</h3><p>{area.summary}</p></div>
                    <button type="button" aria-label={`Open ${area.label}`}><ArrowUpRight size={15} /></button>
                  </header>
                  <div className={styles.workRows}>
                    {area.rows.map((row) => (
                      <button type="button" key={row.label} className={styles.workRow}>
                        <span className={`${styles.workCount} ${styles[row.tone]}`}>{row.count}</span>
                        <strong>{row.label}</strong>
                        <em>{row.action}</em>
                        <ChevronRight size={14} />
                      </button>
                    ))}
                  </div>
                </article>
              )
            })}
          </div>

          <div className={styles.bottomGrid}>
            <article className={styles.requirementsCard}>
              <header>
                <span><FileCheck2 size={17} /></span>
                <div><h3>Documents &amp; requirements</h3><p>Preparation and compliance</p></div>
                <button type="button">Open documents <ArrowUpRight size={13} /></button>
              </header>
              <div className={styles.requirementGrid}>
                {requirementRows.map((row) => (
                  <button type="button" key={row.label} className={styles.requirementRow}>
                    <span className={`${styles.workCount} ${styles[row.tone]}`}>{row.count}</span>
                    <span><strong>{row.label}</strong><small>{row.note}</small></span>
                    <ChevronRight size={14} />
                  </button>
                ))}
              </div>
            </article>

            <aside className={styles.updatesCard} aria-labelledby="recent-updates-title">
              <header>
                <span><Bell size={16} /></span>
                <div><p>NOTIFICATIONS</p><h3 id="recent-updates-title">Recent updates</h3></div>
                <button type="button">Mark all read</button>
              </header>
              <div className={styles.updateList}>
                {recentUpdates.map((update) => (
                  <button type="button" key={update.title}>
                    <i className={styles[update.tone]} />
                    <span><strong>{update.title}</strong><small>{update.meta}</small></span>
                  </button>
                ))}
              </div>
              <footer><button type="button">View all notifications <ChevronRight size={13} /></button></footer>
            </aside>
          </div>
        </section>
      </div>
    </main>
  )
}
