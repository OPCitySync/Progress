import Link from 'next/link'
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
import { requireRole } from '@/lib/auth/session'
import { getMyResume } from '@/lib/services/resume'
import { getLabWorkspace } from '../lab-workspace'
import { LabHeader } from '../LabHeader'
import { ResumeControls } from '../ResumeControls'
import styles from '../prototype.module.css'

export const dynamic = 'force-dynamic'

function dateParts(timestamp: number) {
  const date = new Date(timestamp)
  return { month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(), day: String(date.getDate()).padStart(2, '0') }
}

export default async function HistoryLabPage() {
  const session = await requireRole('participant')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const resume = await getMyResume(session.sub)
  if (!resume) return null

  return (
    <main className={styles.app}>
      <LabHeader activeSection="history" session={session} city={city} cities={cities} contexts={contexts} />

      <div className={styles.detailLayout}>
        <aside className={styles.leftRail}>
          <section className={styles.impactCard}>
            <p className={styles.eyebrow}>Your year in service</p>
            <div className={styles.impactGrid}>
              <div><strong>{resume.totals.hours}h</strong><span>Hours contributed</span></div>
              <div><strong>{String(resume.totals.contributions).padStart(2, '0')}</strong><span>Completed shifts</span></div>
              <div><strong>{String(resume.totals.organizations).padStart(2, '0')}</strong><span>Organizations helped</span></div>
            </div>
            <Link href="/aesthetic-lab/history"><Award size={15} /> Your contribution summary</Link>
          </section>
          <section className={styles.quickLinks}>
            <Link href="/aesthetic-lab/opportunities"><Heart size={17} /> Saved opportunities</Link>
            <Link href="/aesthetic-lab"><CalendarDays size={17} /> Upcoming commitments</Link>
            <Link href="/aesthetic-lab/organizations"><Building2 size={17} /> Discover organizations</Link>
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
            <div><p className={styles.eyebrow}>Shareable service resume</p><h2>{resume.name}&apos;s service record</h2><p>{resume.totals.contributions} completed shift{resume.totals.contributions === 1 ? '' : 's'} · {resume.totals.hours} verified volunteer hours · Updated today</p></div>
            <ResumeControls token={resume.token} isPublic={resume.isPublic} />
          </section>

          <div className={styles.listHeading}><div><p className={styles.eyebrow}>Completed opportunities</p><h2>Recent service</h2></div><span className={styles.yearTag}>{new Date().getFullYear()}</span></div>
          <div className={styles.historyTimeline}>
            {resume.contributions.length === 0 ? <section className={styles.calendarEmpty}><Sparkles size={20} /><div><b>Your service record begins with a first shift.</b><p>Verified work will appear here after an organization confirms your contribution.</p></div></section> : resume.contributions.map((entry) => {
              const date = dateParts(entry.verifiedAt)
              return <article className={styles.historyEntry} key={`${entry.org}-${entry.opportunity}-${entry.verifiedAt}`}>
                <div className={styles.historyDate}>{date.month}<strong>{date.day}</strong></div>
                <span className={`${styles.historyIcon} ${styles.food}`}><Sparkles size={17} /></span>
                <div><p className={styles.orgLine}><Building2 size={14} /> {entry.org} <CheckCircle2 size={14} /></p><h3>{entry.opportunity}</h3><p className={styles.historyMeta}><CalendarDays size={14} /> {entry.hours ? `${entry.hours} hour${entry.hours === 1 ? '' : 's'}` : 'Verified contribution'}{entry.whenLabel ? ` · ${entry.whenLabel}` : ''}</p></div>
                <div className={styles.historyEntryActions}>
                  <Link className={styles.historyReflectionLink} href={`/aesthetic-lab/reflections/${entry.claimId}`}>{entry.hasReflection ? 'View your note' : 'Share a thought'}</Link>
                  {entry.orgSlug ? <Link href={`/aesthetic-lab/organizations/${entry.orgSlug}`} aria-label={`Open ${entry.org}`}><ArrowUpRight size={18} /></Link> : null}
                </div>
              </article>
            })}
          </div>
        </section>

        <aside className={styles.rightRail}>
          <section className={styles.cityCard}>
            <div className={styles.cityCardTop}><span className={styles.cityOverline}>Your city membership</span><CheckCircle2 size={17} /></div>
            <div className={styles.cityName}><MapPin size={17} /><span>{city?.name ?? 'Choose a city'}</span></div>
            <p>Each completed local activity makes your city record more complete.</p>
            <Link href="/aesthetic-lab/cities">Explore your city <ArrowUpRight size={14} /></Link>
          </section>
          <section className={styles.historyAsideCard}><p className={styles.eyebrow}>Keep going</p><strong>{city?.participation?.status === 'active' ? 'You are a City Member' : 'Start with onboarding'}</strong><span>{city?.participation?.status === 'active' ? 'Your verified participation opens local opportunities.' : 'One local onboarding session is all that is needed to become a City Member.'}</span><Link href="/aesthetic-lab/opportunities">Find onboarding <ArrowUpRight size={14} /></Link></section>
        </aside>
      </div>
    </main>
  )
}
