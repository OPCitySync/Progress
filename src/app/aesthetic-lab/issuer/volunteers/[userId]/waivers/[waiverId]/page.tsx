import Link from 'next/link'
import { FileText, ShieldCheck, UserRound } from 'lucide-react'
import { and, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { orgs, users, waiverAcceptances, waiverVersions } from '@/lib/db/schema'
import { participantDisplayName } from '@/lib/participant-name'
import { organizationFileUrl } from '@/lib/storage/organization-file-url'
import { getLabWorkspace } from '../../../../../lab-workspace'
import { HistoryBackButton } from '../../../../../HistoryBackButton'
import { LabHeader } from '../../../../../LabHeader'
import { IssuerLabSidebar } from '../../../../IssuerLabSidebar'
import styles from '../../../../../prototype.module.css'

export const dynamic = 'force-dynamic'

export default async function SignedWaiverProofPage({ params }: { params: { userId: string; waiverId: string } }) {
  const session = await requireRole('issuer')
  const orgId = session.orgId!
  const { city, cities, contexts } = await getLabWorkspace(session)
  const [org, proof] = await Promise.all([
    db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1).then((rows) => rows[0] ?? null),
    db
      .select({ acceptance: waiverAcceptances, waiver: waiverVersions, volunteer: users })
      .from(waiverAcceptances)
      .innerJoin(waiverVersions, eq(waiverAcceptances.waiverVersionId, waiverVersions.id))
      .innerJoin(users, eq(waiverAcceptances.userId, users.id))
      .where(and(
        eq(waiverAcceptances.orgId, orgId),
        eq(waiverAcceptances.userId, params.userId),
        eq(waiverAcceptances.waiverVersionId, params.waiverId),
        eq(waiverAcceptances.signatureMethod, 'typed_electronic'),
      ))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ])

  if (!proof) notFound()

  const signedAt = proof.acceptance.signedAt ?? proof.acceptance.acceptedAt
  const profileHref = `/aesthetic-lab/issuer/volunteers/${proof.volunteer.id}`

  return <main className={styles.app}>
    <LabHeader activeSection="issuer-volunteers" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
    <div className={styles.issuerLayout}>
      <IssuerLabSidebar organizationId={org?.id} organizationName={org?.name} cityName={city?.name} />
      <section className={styles.issuerMain} aria-label="Signed waiver proof">
        <section className={styles.signedWaiverProofCard}>
          <header>
            <span><ShieldCheck size={21} /></span>
            <div><p className={styles.eyebrow}>Signed waiver proof</p><h1>{proof.waiver.title}</h1><p>Private signature record for {org?.name ?? 'your organization'}.</p></div>
            <HistoryBackButton fallback={profileHref} />
          </header>
          <div className={styles.signedWaiverProofDetails}>
            <article><UserRound size={17} /><div><p>Volunteer</p><Link href={profileHref}>{participantDisplayName(proof.volunteer)}</Link></div></article>
            <article><ShieldCheck size={17} /><div><p>Signature</p><b>{proof.acceptance.signerName || 'Electronic signature recorded'}</b><small>Signed {new Date(signedAt).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}.</small></div></article>
            <article><FileText size={17} /><div><p>Waiver version</p><b>Version {proof.waiver.version}</b><small>Accepted against the published waiver record.</small></div></article>
            <article><ShieldCheck size={17} /><div><p>Record hash</p><code>{proof.acceptance.sha256}</code><small>Confirms the exact waiver record that was accepted.</small></div></article>
          </div>
          <footer>
            {proof.waiver.documentUrl ? <a className={styles.catalogWorkspaceAction} href={organizationFileUrl('waiver', proof.waiver.id)} target="_blank" rel="noreferrer"><FileText size={15} /> View source waiver</a> : null}
            <span>This proof is visible only to authorized organization staff.</span>
          </footer>
        </section>
      </section>
    </div>
  </main>
}
