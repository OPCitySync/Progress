import { FileText, ShieldCheck, UserRound } from 'lucide-react'
import { and, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { orgs, waiverAcceptances, waiverVersions } from '@/lib/db/schema'
import { organizationFileUrl } from '@/lib/storage/organization-file-url'
import { getLabWorkspace } from '../../../lab-workspace'
import { HistoryBackButton } from '../../../HistoryBackButton'
import { LabHeader } from '../../../LabHeader'
import { ParticipantIdentityCard } from '../../../ParticipantIdentityCard'
import styles from '../../../prototype.module.css'

export const dynamic = 'force-dynamic'

export default async function ParticipantSignedWaiverProofPage({ params }: { params: { waiverId: string } }) {
  const session = await requireRole('participant')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const proof = await db
    .select({ acceptance: waiverAcceptances, waiver: waiverVersions, organization: orgs })
    .from(waiverAcceptances)
    .innerJoin(waiverVersions, eq(waiverAcceptances.waiverVersionId, waiverVersions.id))
    .innerJoin(orgs, eq(waiverAcceptances.orgId, orgs.id))
    .where(and(
      eq(waiverAcceptances.userId, session.sub),
      eq(waiverAcceptances.waiverVersionId, params.waiverId),
      eq(waiverAcceptances.signatureMethod, 'typed_electronic'),
    ))
    .limit(1)
    .then((rows) => rows[0] ?? null)

  if (!proof) notFound()
  const signedAt = proof.acceptance.signedAt ?? proof.acceptance.acceptedAt

  return <main className={styles.app}>
    <LabHeader activeSection="opportunities" workspace="participant" session={session} city={city} cities={cities} contexts={contexts} />
    <div className={`${styles.detailLayout} ${styles.opportunitiesLayout}`}>
      <aside className={styles.leftRail}>
        <ParticipantIdentityCard session={session} city={city} redirectTo={`/aesthetic-lab/profile/waivers/${params.waiverId}`} />
      </aside>
      <section className={styles.primaryColumn} aria-label="Signed waiver proof">
        <section className={styles.signedWaiverProofCard}>
          <header>
            <span><ShieldCheck size={21} /></span>
            <div><p className={styles.eyebrow}>Signed waiver proof</p><h1>{proof.waiver.title}</h1><p>Your private signature record with {proof.organization.name}.</p></div>
            <HistoryBackButton fallback="/aesthetic-lab/profile" />
          </header>
          <div className={styles.signedWaiverProofDetails}>
            <article><UserRound size={17} /><div><p>Volunteer</p><b>{session.name}</b></div></article>
            <article><ShieldCheck size={17} /><div><p>Signature</p><b>{proof.acceptance.signerName || 'Electronic signature recorded'}</b><small>Signed {new Date(signedAt).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}.</small></div></article>
            <article><FileText size={17} /><div><p>Waiver version</p><b>Version {proof.waiver.version}</b><small>Accepted against {proof.organization.name}&apos;s published waiver record.</small></div></article>
            <article><ShieldCheck size={17} /><div><p>Record hash</p><code>{proof.acceptance.sha256}</code><small>Confirms the exact waiver record you accepted.</small></div></article>
          </div>
          <footer>
            {proof.waiver.documentUrl ? <a className={styles.catalogWorkspaceAction} href={organizationFileUrl('waiver', proof.waiver.id)} target="_blank" rel="noreferrer"><FileText size={15} /> View source waiver</a> : null}
            <span>This proof is visible only to you and authorized organization staff.</span>
          </footer>
        </section>
      </section>
    </div>
  </main>
}
