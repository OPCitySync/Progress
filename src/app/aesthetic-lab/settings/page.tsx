import Link from 'next/link'
import { Settings2 } from 'lucide-react'
import { eq } from 'drizzle-orm'
import { requireSession } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { orgs, users } from '@/lib/db/schema'
import { saveAccountSettingsAction, saveOrganizationSettingsAction } from '@/app/actions'
import { getEditorProfile } from '@/lib/services/profile'
import { getLabWorkspace } from '../lab-workspace'
import { LabHeader } from '../LabHeader'
import { LabNotice } from '../LabNotice'
import styles from '../prototype.module.css'

export const dynamic = 'force-dynamic'

export default async function LabSettingsPage({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const session = await requireSession()
  const { city, cities, contexts } = await getLabWorkspace(session)
  const [user, org] = await Promise.all([
    db.select().from(users).where(eq(users.id, session.sub)).limit(1).then((rows) => rows[0] ?? null),
    session.orgId ? db.select().from(orgs).where(eq(orgs.id, session.orgId)).limit(1).then((rows) => rows[0] ?? null) : Promise.resolve(null),
  ])
  const profile = org ? await getEditorProfile(org) : null
  const isIssuer = session.role === 'issuer'
  const headerProps = { activeSection: isIssuer ? 'issuer-overview' as const : 'feed' as const, workspace: isIssuer ? 'issuer' as const : 'participant' as const, session, city, cities, contexts }

  return <main className={styles.app}>
    <LabHeader {...headerProps} />
    <section className={styles.detailLayout}>
      <aside className={styles.leftRail}><section className={styles.cityCard}><Settings2 size={19} /><h2>Profile &amp; settings</h2><p>Control the information associated with your active identity.</p><Link href={isIssuer ? '/aesthetic-lab/issuer' : '/aesthetic-lab'}>Return to workspace</Link></section></aside>
      <section className={styles.primaryColumn}>
        <div className={styles.pageIntro}><p className={styles.eyebrow}>Account settings</p><h1>Keep your identity current.</h1><p>Only the information needed to participate is kept here.</p></div>
        <LabNotice ok={searchParams.ok} error={searchParams.error} />
        <section className={`${styles.labPanel} ${styles.labStack}`}><div><p className={styles.eyebrow}>Personal identity</p><h2>Your Civic Participant account</h2></div><form action={saveAccountSettingsAction} className={styles.labForm}><input type="hidden" name="redirectTo" value="/aesthetic-lab/settings" /><div className={styles.labFormGrid}><label>Name<input name="name" defaultValue={user?.name ?? ''} required /></label><label>Username<input name="username" defaultValue={user?.username ?? ''} /></label></div><label>Email<input type="email" name="email" defaultValue={user?.email ?? session.email} required /></label><label>Avatar image URL (optional)<input name="avatarUrl" defaultValue={user?.avatarUrl ?? ''} placeholder="https://…" /></label><div className={styles.labFormActions}><button className={styles.labButton} type="submit">Save identity</button></div></form></section>
        {isIssuer && org && profile ? <section className={`${styles.labPanel} ${styles.labStack}`}><div><p className={styles.eyebrow}>Organization identity</p><h2>{org.name}</h2></div><form action={saveOrganizationSettingsAction} className={styles.labForm}><input type="hidden" name="redirectTo" value="/aesthetic-lab/settings" /><label>Organization name<input name="organizationName" defaultValue={org.name} required /></label><div className={styles.labFormGrid}><label>Organization email<input type="email" name="contactEmail" defaultValue={profile.contactEmail} /></label><label>Logo image URL<input name="logoUrl" defaultValue={profile.logoUrl} placeholder="/uploads/… or https://…" /></label></div><div className={styles.labFormActions}><Link className={`${styles.labLinkButton} ${styles.labLinkButtonSecondary}`} href="/aesthetic-lab/issuer/profile/edit">Edit public profile</Link><button className={styles.labButton} type="submit">Save organization</button></div></form></section> : null}
      </section>
    </section>
  </main>
}
