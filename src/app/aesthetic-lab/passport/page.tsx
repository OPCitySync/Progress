import { requireRole } from '@/lib/auth/session'
import { getMyResume } from '@/lib/services/resume'
import { getLabWorkspace } from '../lab-workspace'
import { LabHeader } from '../LabHeader'
import { ParticipantIdentityCard } from '../ParticipantIdentityCard'
import { VolunteerProfileTab } from '../profile/VolunteerProfileTab'
import { ResumeControls } from '../ResumeControls'
import { PassportTabs } from './PassportTabs'
import styles from '../prototype.module.css'

export const dynamic = 'force-dynamic'

export default async function PassportPage({ searchParams }: { searchParams: { tab?: string } }) {
  const session = await requireRole('participant')
  const [{ city, cities, contexts }, resume] = await Promise.all([getLabWorkspace(session), getMyResume(session.sub)])
  if (!resume) return null
  const active = searchParams.tab === 'resume' ? 'resume' : searchParams.tab === 'history' ? 'history' : 'profile'
  return <main className={styles.app}>
    <LabHeader activeSection="passport" session={session} city={city} cities={cities} contexts={contexts} />
    <div className={`${styles.detailLayout} ${styles.passportLayout}`}>
      <aside className={styles.leftRail}><ParticipantIdentityCard session={session} city={city} redirectTo="/aesthetic-lab/passport" /></aside>
      <section className={styles.primaryColumn} aria-label="Volunteer Passport">
        <div className={styles.pageIntro}><p className={styles.eyebrow}>Volunteer Passport</p><h1>Your contribution, connected.</h1><p>Your organization records, verified service, and resume in one place.</p></div>
        <PassportTabs active={active} />
        {active !== 'resume' ? <VolunteerProfileTab section={active} userId={session.sub} resumeToken={resume.token} resumeIsPublic={resume.isPublic} resumeTotals={resume.totals} /> : <section className={styles.passportResume}>
          <p className={styles.eyebrow}>Service resume</p><h2>{resume.name}</h2>
          <p>{resume.totals.hours} verified hours · {resume.totals.contributions} completed activities · {resume.totals.organizations} organizations</p>
          <ResumeControls token={resume.token} isPublic={resume.isPublic} redirectTo="/aesthetic-lab/passport?tab=resume" />
          <p className={styles.passportSharingNote}>{resume.isPublic ? 'Anyone with your resume link can view your name and verified contributions. Make it private to turn off access.' : 'Your resume is private. Making it shareable creates a link to your name and verified contributions.'}</p>
          <div className={styles.passportContributions}>{resume.contributions.length ? resume.contributions.map((entry) => <article key={entry.claimId}><div><h3>{entry.opportunity}</h3><p>{entry.org}</p></div><span>{entry.hours === null ? 'Verified contribution' : `${entry.hours} hours`}<small>{new Date(entry.verifiedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</small></span></article>) : <p>Verified contributions will appear here after an organization confirms your work.</p>}</div>
        </section>}
      </section>
    </div>
  </main>
}
