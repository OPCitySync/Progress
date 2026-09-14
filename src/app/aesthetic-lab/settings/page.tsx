import Link from 'next/link'
import { Settings2 } from 'lucide-react'
import { eq } from 'drizzle-orm'
import { requireSession } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { orgs, users } from '@/lib/db/schema'
import { saveAccountSettingsAction } from '@/app/actions'
import { getEditorProfile } from '@/lib/services/profile'
import { getLabWorkspace } from '../lab-workspace'
import { LabHeader } from '../LabHeader'
import { LabNotice } from '../LabNotice'
import { ParticipantIdentityCard } from '../ParticipantIdentityCard'
import { IssuerLabSidebar } from '../issuer/IssuerLabSidebar'
import { OrganizationManagementSettings } from './OrganizationManagementSettings'
import styles from '../prototype.module.css'

export const dynamic = 'force-dynamic'

export default async function LabSettingsPage({ searchParams }: { searchParams: { ok?: string; error?: string; invite?: string; inviteRole?: string } }) {
  const session = await requireSession()
  const { city, cities, contexts } = await getLabWorkspace(session)
  const [user, org] = await Promise.all([
    db.select().from(users).where(eq(users.id, session.sub)).limit(1).then((rows) => rows[0] ?? null),
    session.orgId ? db.select().from(orgs).where(eq(orgs.id, session.orgId)).limit(1).then((rows) => rows[0] ?? null) : Promise.resolve(null),
  ])
  const profile = org ? await getEditorProfile(org) : null
  const isIssuer = session.role === 'issuer'

  if (isIssuer) {
    return <main className={styles.app}>
      <LabHeader activeSection="issuer-utility" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
      <div className={styles.issuerLayout}>
        <IssuerLabSidebar organizationId={org?.id} organizationName={org?.name} cityName={city?.name} />
        <section className={styles.issuerMain} aria-label="Organization settings">
          <LabNotice ok={searchParams.ok} error={searchParams.error} />
          {org && profile ? <OrganizationManagementSettings organization={org} profile={profile} session={session} inviteCode={searchParams.invite} inviteRoleId={searchParams.inviteRole} /> : null}
        </section>
      </div>
    </main>
  }

  return <main className={styles.app}>
    <LabHeader activeSection="feed" workspace="participant" session={session} city={city} cities={cities} contexts={contexts} />
    <section className={styles.detailLayout}>
      <aside className={styles.leftRail}><ParticipantIdentityCard session={session} city={city} redirectTo="/aesthetic-lab/settings" /><section className={styles.cityCard}><Settings2 size={19} /><h2>Profile &amp; settings</h2><p>Control the information associated with your active identity.</p><Link href="/aesthetic-lab">Return home</Link></section></aside>
      <section className={styles.primaryColumn}>
        <div className={styles.pageIntro}><p className={styles.eyebrow}>Account settings</p><h1>Keep your identity current.</h1><p>Only the information needed to participate is kept here.</p></div>
        <LabNotice ok={searchParams.ok} error={searchParams.error} />
        <section className={`${styles.labPanel} ${styles.labStack}`}><div><p className={styles.eyebrow}>Personal identity</p><h2>Your Civic Participant account</h2></div><form action={saveAccountSettingsAction} className={styles.labForm}><input type="hidden" name="redirectTo" value="/aesthetic-lab/settings" /><div className={styles.labFormGrid}><label>Name<input name="name" defaultValue={user?.name ?? ''} required /></label><label>Username<input name="username" defaultValue={user?.username ?? ''} /></label></div><label>Email<input type="email" name="email" defaultValue={user?.email ?? session.email} required /></label><label>Avatar image URL (optional)<input name="avatarUrl" defaultValue={user?.avatarUrl ?? ''} placeholder="https://…" /></label><div className={styles.labFormActions}><button className={styles.labButton} type="submit">Save identity</button></div></form></section>
      </section>
    </section>
  </main>
}
