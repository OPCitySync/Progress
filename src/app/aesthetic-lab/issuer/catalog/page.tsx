import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Copy,
  Edit3,
  MapPin,
  MoreHorizontal,
  Plus,
  Repeat2,
  UsersRound,
} from 'lucide-react'
import { LabHeader } from '../../LabHeader'
import { IssuerLabSidebar } from '../IssuerLabSidebar'
import styles from '../../prototype.module.css'

const templates = [
  { name: 'Pantry packing crew', description: 'Prepare weekly produce boxes at the Berkeley Food Hub.', label: 'Volunteer shift', location: 'Berkeley Food Hub', duration: '3 hours', tone: 'navy' },
  { name: 'Home delivery route', description: 'Deliver food boxes to neighbors who cannot make the pantry.', label: 'Volunteer shift', location: 'Berkeley', duration: '2.5 hours', tone: 'blue' },
  { name: 'New participant onboarding', description: 'Welcome first-time volunteers and complete their local orientation.', label: 'Onboarding', location: 'Food Hub classroom', duration: '75 minutes', tone: 'gold' },
]

const sessions = [
  { date: 'THU 13', time: '6:00 PM', rsvp: '9 of 12 reserved' },
  { date: 'THU 20', time: '6:00 PM', rsvp: '4 of 12 reserved' },
]

export default function IssuerCatalogLabPage() {
  return (
    <main className={styles.app}>
      <LabHeader activeSection="issuer-catalog" workspace="issuer" />
      <div className={styles.issuerLayout}>
        <IssuerLabSidebar active="catalog" />

        <section className={styles.issuerMain} aria-label="Opportunity Catalog">
          <section className={styles.issuerPageHero}>
            <div><p className={styles.eyebrow}>Opportunity catalog</p><h1>Make it easy to say yes.</h1><p>Turn repeatable work into clear, shareable opportunities your volunteers can confidently claim.</p></div>
            <button type="button" className={styles.issuerPrimaryAction}><Plus size={18} /> New opportunity</button>
          </section>

          <section className={styles.onboardingWorkspaceCard}>
            <div className={styles.onboardingWorkspaceHeading}><span><Repeat2 size={20} /></span><div><p className={styles.eyebrow}>Recurring onboarding</p><h2>New participant session</h2><p>Open to the public every Thursday. This is the first step for prospective City Members.</p></div><button type="button"><Edit3 size={15} /> Edit session</button></div>
            <div className={styles.onboardingSessionGrid}>
              <div><span>Schedule</span><b>Thursdays · 6:00 PM</b></div>
              <div><span>Weekly capacity</span><b>12 participants</b></div>
              <div><span>Default location</span><b>Food Hub classroom</b></div>
            </div>
            <div className={styles.upcomingSessions}>
              {sessions.map((session) => <article key={session.date}><CalendarDays size={16} /><b>{session.date}</b><span>{session.time}</span><em>{session.rsvp}</em><button type="button" aria-label={`Manage ${session.date}`}><MoreHorizontal size={19} /></button></article>)}
            </div>
          </section>

          <section className={styles.catalogWorkspaceCard}>
            <div className={styles.issuerPanelHeading}>
              <div><p className={styles.eyebrow}>Your templates</p><h2>Build once, schedule when ready.</h2></div>
              <button type="button" className={styles.issuerTextButton}><Plus size={15} /> New template</button>
            </div>
            <div className={styles.templateGrid}>
              {templates.map((template) => (
                <article key={template.name} className={styles.templateCard}>
                  <div className={`${styles.templateGlyph} ${styles[template.tone]}`}>{template.label === 'Onboarding' ? <CheckCircle2 size={18} /> : <UsersRound size={18} />}</div>
                  <div className={styles.templateTitle}><span>{template.label}</span><button type="button" aria-label={`Template options for ${template.name}`}><MoreHorizontal size={19} /></button></div>
                  <h3>{template.name}</h3><p>{template.description}</p>
                  <div className={styles.templateMeta}><span><MapPin size={13} /> {template.location}</span><span><Clock3 size={13} /> {template.duration}</span></div>
                  <div className={styles.templateActions}><button type="button"><Copy size={14} /> Duplicate</button><button type="button"><CalendarDays size={14} /> Schedule</button></div>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.catalogFootnote}>
            <div><p className={styles.eyebrow}>Ready to publish</p><h2>Every scheduled opportunity carries the right context.</h2><p>Location, capacity, onboarding requirements, and your current waiver travel with the listing automatically.</p></div>
            <a href="#">Review public opportunities <ArrowUpRight size={15} /></a>
          </section>
        </section>
      </div>
    </main>
  )
}
