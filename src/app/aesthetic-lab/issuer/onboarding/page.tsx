import Link from 'next/link'
import { ArrowLeft, Repeat2 } from 'lucide-react'
import { requireRole } from '@/lib/auth/session'
import { createOnboardingSessionAction } from '@/app/actions'
import { getLabWorkspace } from '../../lab-workspace'
import { LabHeader } from '../../LabHeader'
import { LabNotice } from '../../LabNotice'
import styles from '../../prototype.module.css'

export const dynamic = 'force-dynamic'

export default async function NewLabOnboardingPage({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const session = await requireRole('issuer')
  const { city, cities, contexts } = await getLabWorkspace(session)
  return <main className={styles.app}><LabHeader activeSection="issuer-catalog" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} /><section className={styles.detailLayout}><aside className={styles.leftRail}><section className={styles.cityCard}><Repeat2 size={20} /><h2>Onboarding session</h2><p>Set a public recurring session for new participants.</p><Link href="/aesthetic-lab/issuer/catalog"><ArrowLeft size={14} /> Catalog</Link></section></aside><section className={styles.primaryColumn}><div className={styles.pageIntro}><p className={styles.eyebrow}>Recurring onboarding</p><h1>Create a first step.</h1><p>Participants complete this local session to become City Members.</p></div><LabNotice ok={searchParams.ok} error={searchParams.error} /><section className={styles.labPanel}><form action={createOnboardingSessionAction} className={styles.labForm}><input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer/catalog" /><div className={styles.labFormGrid}><label>Session title<input name="title" defaultValue="New volunteer orientation" required /></label><label>Location<input name="location" required placeholder="Address or meeting point" /></label></div><label>Description<textarea name="description" required defaultValue="A welcoming local orientation for people beginning with our organization." /></label><div className={styles.labFormGrid}><label>Credits<input type="number" name="credits" min="0" defaultValue="5" required /></label><label>Weekly capacity<input type="number" name="weeklyCapacity" min="1" defaultValue="20" required /></label></div><div className={styles.labFormGrid}><label>First session<input type="datetime-local" name="firstStartsAt" required /></label><label>Duration (minutes)<input type="number" name="durationMinutes" min="15" defaultValue="45" required /></label></div><div className={styles.labFormActions}><Link className={`${styles.labLinkButton} ${styles.labLinkButtonSecondary}`} href="/aesthetic-lab/issuer/catalog">Cancel</Link><button className={styles.labButton} type="submit">Create recurring session</button></div></form></section></section></section></main>
}
