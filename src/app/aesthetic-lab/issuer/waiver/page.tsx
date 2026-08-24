import Link from 'next/link'
import { ArrowLeft, ChevronDown, ShieldCheck, Trash2 } from 'lucide-react'
import { requireRole } from '@/lib/auth/session'
import { retireWaiverAction, setWaiverProgramAction } from '@/app/actions'
import { getOnboardingWaiverSetup } from '@/lib/services/waivers'
import { getVolunteerPrograms } from '@/lib/services/volunteer-programs'
import { getLabWorkspace } from '../../lab-workspace'
import { LabHeader } from '../../LabHeader'
import { LabNotice } from '../../LabNotice'
import { IssuerLabSidebar } from '../IssuerLabSidebar'
import { WaiverCreateButton } from '../WaiverCreateButton'
import styles from '../../prototype.module.css'

export const dynamic = 'force-dynamic'

export default async function IssuerWaiverLabPage({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const session = await requireRole('issuer')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const [setup, volunteerPrograms] = await Promise.all([
    getOnboardingWaiverSetup(session.orgId!),
    getVolunteerPrograms(session.orgId!),
  ])

  return <main className={styles.app}>
    <LabHeader activeSection="issuer-catalog" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
    <div className={styles.issuerLayout}>
      <IssuerLabSidebar organizationId={session.orgId ?? undefined} cityName={city?.name} />
      <section className={styles.issuerMain} aria-label="Liability waiver">
        <section className={styles.issuerPageHero}>
          <div><p className={styles.eyebrow}>Organization setup</p><h1>Liability waivers</h1><p>Publish the waivers your organization needs. Every active waiver is automatically included with future onboarding sessions.</p></div>
          <Link href="/aesthetic-lab/issuer/catalog" className={styles.catalogWorkspaceAction}><ArrowLeft size={15} /> Workspace</Link>
        </section>
        <LabNotice hidden ok={searchParams.ok} error={searchParams.error} />

        <section className={`${styles.labPanel} ${styles.waiverCurrentCard}`}>
          <div className={styles.waiverCurrentHeader}>
            <span><ShieldCheck size={21} /></span>
            <div><p className={styles.eyebrow}>Current waivers</p><h2>{setup.waivers.length > 0 ? 'Required for every onboarding session.' : 'No waivers published yet.'}</h2><p>{setup.waivers.length > 0 ? `${setup.waivers.length} active waiver${setup.waivers.length === 1 ? '' : 's'} will be included automatically. Participants acknowledge each digital waiver before reserving.` : 'Add a waiver whenever your organization needs participant acknowledgement for onboarding.'}</p></div>
            <WaiverCreateButton programs={volunteerPrograms} />
          </div>
          {setup.waivers.length > 0 ? (
            <div className={styles.waiverCurrentList} aria-label="Current waiver previews">
              {setup.waivers.map((waiver) => <details className={styles.waiverCurrentItem} key={waiver.id}>
                <summary>
                  <span><ShieldCheck size={17} /></span>
                  <div><p>{waiver.title}</p><small>Published waiver · Version {waiver.version}{waiver.documentName ? ` · ${waiver.documentName}` : ''}</small></div>
                  <i aria-hidden="true"><ChevronDown size={16} /></i>
                </summary>
                <div className={styles.waiverPreview}>
                  <p className={styles.eyebrow}>Preview</p>
                  {waiver.body ? <div className={styles.waiverPreviewBody}>{waiver.body}</div> : <p className={styles.waiverSourceOnly}>This waiver was published as a source file. Open the document below to review it.</p>}
                  <form action={setWaiverProgramAction} className={styles.documentProgramAssignment}>
                    <input type="hidden" name="waiverVersionId" value={waiver.id} />
                    <input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer/waiver" />
                    <label>Volunteer program<select name="programId" defaultValue={waiver.programId ?? ''}><option value="">Applies across the organization</option>{volunteerPrograms.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</select></label>
                    <button className={styles.catalogWorkspaceAction} type="submit">Save program</button>
                  </form>
                  <div className={styles.waiverPreviewActions}>{waiver.documentUrl ? <a className={styles.catalogWorkspaceAction} href={waiver.documentUrl} target="_blank" rel="noreferrer">View source document</a> : null}<form action={retireWaiverAction}><input type="hidden" name="waiverVersionId" value={waiver.id} /><input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer/waiver" /><button className={styles.catalogWorkspaceAction} type="submit"><Trash2 size={15} /> Delete Waiver</button></form></div>
                </div>
              </details>)}
            </div>
          ) : <p className={styles.waiverCurrentEmpty}>No active waivers. Use Add Waiver to create the first requirement for future onboarding sessions.</p>}
        </section>
      </section>
    </div>
  </main>
}
