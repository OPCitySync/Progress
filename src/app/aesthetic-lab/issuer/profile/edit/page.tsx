import Link from 'next/link'
import { ArrowLeft, Edit3 } from 'lucide-react'
import { eq } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { orgs } from '@/lib/db/schema'
import { getEditorProfile, getOrgTasksForSelect } from '@/lib/services/profile'
import { getLabWorkspace } from '../../../lab-workspace'
import { LabHeader } from '../../../LabHeader'
import { LabNotice } from '../../../LabNotice'
import { IssuerProfileForm } from './IssuerProfileForm'
import styles from '../../../prototype.module.css'

export const dynamic = 'force-dynamic'

export default async function EditLabIssuerProfilePage({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const session = await requireRole('issuer')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const org = (await db.select().from(orgs).where(eq(orgs.id, session.orgId!)).limit(1))[0]
  if (!org) return null
  const [profile, tasks] = await Promise.all([getEditorProfile(org), getOrgTasksForSelect(org.id)])
  return <main className={styles.app}><LabHeader activeSection="issuer-profile" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} /><section className={styles.detailLayout}><aside className={styles.leftRail}><section className={styles.cityCard}><Edit3 size={20} /><h2>Edit public profile</h2><p>Give prospective volunteers current, helpful information.</p><Link href="/aesthetic-lab/issuer/profile"><ArrowLeft size={14} /> Public profile</Link></section></aside><section className={styles.primaryColumn}><div className={styles.pageIntro}><p className={styles.eyebrow}>Public profile</p><h1>Tell your organization’s story.</h1><p>These details appear to people discovering your organization in their local city network.</p></div><LabNotice ok={searchParams.ok} error={searchParams.error} /><section className={styles.labPanel}><IssuerProfileForm profile={profile} tasks={tasks} /></section></section></section></main>
}
