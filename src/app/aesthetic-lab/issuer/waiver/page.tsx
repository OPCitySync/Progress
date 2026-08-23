import Link from 'next/link'
import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react'
import { requireRole } from '@/lib/auth/session'
import { createWaiverAction } from '@/app/actions'
import { getOnboardingWaiverSetup } from '@/lib/services/waivers'
import { getLabWorkspace } from '../../lab-workspace'
import { LabHeader } from '../../LabHeader'
import { LabNotice } from '../../LabNotice'
import { IssuerLabSidebar } from '../IssuerLabSidebar'
import styles from '../../prototype.module.css'

export const dynamic = 'force-dynamic'

export default async function IssuerWaiverLabPage({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const session = await requireRole('issuer')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const setup = await getOnboardingWaiverSetup(session.orgId!)

  return <main className={styles.app}>
    <LabHeader activeSection="issuer-catalog" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
    <div className={styles.issuerLayout}>
      <IssuerLabSidebar organizationId={session.orgId ?? undefined} cityName={city?.name} />
      <section className={styles.issuerMain} aria-label="Liability waiver">
        <section className={styles.issuerPageHero}>
          <div><p className={styles.eyebrow}>Organization setup</p><h1>Liability waivers</h1><p>Keep one current waiver available for participants, and publish a new version whenever your organization needs to update it.</p></div>
          <Link href="/aesthetic-lab/issuer/catalog" className={styles.catalogWorkspaceAction}><ArrowLeft size={15} /> Workspace</Link>
        </section>
        <LabNotice hidden ok={searchParams.ok} error={searchParams.error} />

        {setup.waiver ? <>
          <section className={`${styles.labPanel} ${styles.waiverCurrentCard}`}>
            <span><ShieldCheck size={21} /></span>
            <div><p className={styles.eyebrow}>Current waiver</p><h2>{setup.waiver.title}</h2><p>Version {setup.waiver.version} is active for your organization. Participant acknowledgement is tied to this specific version.</p></div>
            {setup.waiver.documentUrl ? <a className={styles.catalogWorkspaceAction} href={setup.waiver.documentUrl} target="_blank" rel="noreferrer">View document</a> : null}
          </section>
        </> : null}
        <section className={`${styles.labPanel} ${styles.labStack}`}>
          <div><p className={styles.eyebrow}>{setup.waiver ? 'Publish a new version' : 'Optional tool'}</p><h2>{setup.waiver ? 'Replace the current waiver' : 'Publish your first waiver'}</h2><p className={styles.waiverHelper}>{setup.waiver ? 'Publishing creates a new active version and preserves the prior record for your organization.' : 'You can add a waiver now or later. Without one, participants can reserve your opportunities without a waiver step.'}</p></div>
          <form action={createWaiverAction} className={styles.labForm}>
            <input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer/waiver" />
            <label>Waiver title<input name="title" required defaultValue={setup.waiver?.title ?? ''} placeholder="e.g. Volunteer Liability Release" /></label>
            <label>Waiver text<textarea name="body" required defaultValue={setup.waiver?.body ?? ''} placeholder="Paste the approved waiver text here so participants can read it accessibly." /></label>
            <label>Attach a document <span>(optional)</span><input name="document" type="file" accept="application/pdf,.doc,.docx" /><small>PDF, DOC, or DOCX; up to 10 MB. The text above remains the accessible record.</small></label>
            <div className={styles.labFormActions}><button className={styles.labButton} type="submit"><FileText size={15} /> {setup.waiver ? 'Publish new version' : 'Publish waiver'}</button></div>
          </form>
        </section>
      </section>
    </div>
  </main>
}
