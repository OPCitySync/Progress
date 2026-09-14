import Link from 'next/link'
import { CalendarDays, Plus } from 'lucide-react'
import { requireRole } from '@/lib/auth/session'
import { createTaskAction } from '@/app/actions'
import { getVolunteerPrograms } from '@/lib/services/volunteer-programs'
import { getLabWorkspace } from '../../lab-workspace'
import { LabHeader } from '../../LabHeader'
import { HistoryBackButton } from '../../HistoryBackButton'
import { LabNotice } from '../../LabNotice'
import styles from '../../prototype.module.css'

export const dynamic = 'force-dynamic'

export default async function NewLabOpportunityPage({ searchParams }: { searchParams: { ok?: string; error?: string; program?: string } }) {
  const session = await requireRole('issuer')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const volunteerPrograms = await getVolunteerPrograms(session.orgId!)
  const selectedProgramId = volunteerPrograms.some((program) => program.id === searchParams.program) ? searchParams.program : ''

  return (
    <main className={styles.app}>
      <LabHeader activeSection="issuer-catalog" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
      <section className={styles.detailLayout}>
        <aside className={styles.leftRail}>
          <section className={styles.cityCard}>
            <Plus size={20} />
            <h2>New opportunity</h2>
            <p>Describe the repeatable volunteer work first. Add public sessions whenever you are ready.</p>
            <HistoryBackButton fallback="/aesthetic-lab/issuer/catalog" />
          </section>
        </aside>

        <section className={styles.primaryColumn}>
          <div className={styles.pageIntro}>
            <p className={styles.eyebrow}>Workspace · Opportunities</p>
            <h1>Create the volunteer work.</h1>
            <p>Start with the reusable opportunity. It will stay private to your organization until at least one session is published in {city?.name ?? 'your active city'}.</p>
          </div>
          <LabNotice hidden ok={searchParams.ok} error={searchParams.error} />

          <section className={styles.labPanel}>
            <form action={createTaskAction} className={styles.labForm}>
              <input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer/new" />
              <div className={styles.opportunityFormHeading}>
                <div><p className={styles.eyebrow}>Opportunity details</p><h2>What are volunteers being asked to do?</h2></div>
                <span>Step 1 of 2</span>
              </div>
              <div className={styles.labFormGrid}>
                <label>Opportunity title<input name="title" required placeholder="e.g. Saturday pantry sorting" /></label>
                <label>Default location<input name="location" required placeholder="Address or meeting point" /></label>
              </div>
              <label>Volunteer program <span>(optional)</span><select name="programId" defaultValue={selectedProgramId}><option value="">Not assigned to a program</option>{volunteerPrograms.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</select><small>Tag this opportunity to the area of work it supports.</small></label>
              <label>Description<textarea name="description" required placeholder="Explain the work, expectations, and what to bring." /></label>
              <details className={styles.optionalSessionDetails}>
                <summary>
                  <span><CalendarDays size={17} /></span>
                  <div><b>Publish a first session now</b><small>Optional — you can schedule dates after saving instead.</small></div>
                </summary>
                <div className={styles.optionalSessionFields}>
                  <label>Session label (optional)<input name="shiftLabel" placeholder="e.g. Morning shift" /></label>
                  <div className={styles.labFormGrid}>
                    <label>Starts<input type="datetime-local" name="shiftStartsAt" /></label>
                    <label>Ends<input type="datetime-local" name="shiftEndsAt" /></label>
                  </div>
                </div>
              </details>

              <div className={styles.labFormActions}>
                <Link className={`${styles.labLinkButton} ${styles.labLinkButtonSecondary}`} href="/aesthetic-lab/issuer/catalog">Cancel</Link>
                <button className={styles.labButton} type="submit">Create opportunity</button>
              </div>
            </form>
          </section>
        </section>
      </section>
    </main>
  )
}
