import Link from 'next/link'
import { ArrowLeft, Plus } from 'lucide-react'
import { requireRole } from '@/lib/auth/session'
import { createTaskAction } from '@/app/actions'
import { getLabWorkspace } from '../../lab-workspace'
import { LabHeader } from '../../LabHeader'
import { LabNotice } from '../../LabNotice'
import styles from '../../prototype.module.css'

export const dynamic = 'force-dynamic'

export default async function NewLabOpportunityPage({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const session = await requireRole('issuer')
  const { city, cities, contexts } = await getLabWorkspace(session)
  return <main className={styles.app}><LabHeader activeSection="issuer-catalog" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} /><section className={styles.detailLayout}><aside className={styles.leftRail}><section className={styles.cityCard}><Plus size={20} /><h2>New opportunity</h2><p>Publish an opportunity with its first scheduled shift.</p><Link href="/aesthetic-lab/issuer/catalog"><ArrowLeft size={14} /> Catalog</Link></section></aside><section className={styles.primaryColumn}><div className={styles.pageIntro}><p className={styles.eyebrow}>Opportunity catalog</p><h1>Create an opportunity.</h1><p>This will be visible in {city?.name ?? 'your active city'} as soon as it is published.</p></div><LabNotice ok={searchParams.ok} error={searchParams.error} /><section className={styles.labPanel}><form action={createTaskAction} className={styles.labForm}><input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer/catalog" /><div className={styles.labFormGrid}><label>Opportunity title<input name="title" required placeholder="e.g. Saturday pantry sorting" /></label><label>Location<input name="location" required placeholder="Address or meeting point" /></label></div><label>Description<textarea name="description" required placeholder="Explain the work, expectations, and what to bring." /></label><div className={styles.labFormGrid}><label>Credits<input type="number" name="credits" min="0" defaultValue="10" required /></label><label>Capacity<input type="number" name="capacity" min="1" defaultValue="8" required /></label></div><label>Shift label (optional)<input name="shiftLabel" placeholder="e.g. Morning shift" /></label><div className={styles.labFormGrid}><label>Starts<input type="datetime-local" name="shiftStartsAt" required /></label><label>Ends<input type="datetime-local" name="shiftEndsAt" required /></label></div><div className={styles.labFormActions}><Link className={`${styles.labLinkButton} ${styles.labLinkButtonSecondary}`} href="/aesthetic-lab/issuer/catalog">Cancel</Link><button className={styles.labButton} type="submit">Publish opportunity</button></div></form></section></section></section></main>
}
