import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { ArrowLeft } from 'lucide-react'
import { db } from '@/lib/db/client'
import { orgs } from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/session'
import { getEditorProfile, getOrgTasksForSelect } from '@/lib/services/profile'
import { PageHeader, Flash } from '@/components/ui'
import { OrgStatusBanner } from '@/components/OrgStatusBanner'
import { ProfileForm } from '@/components/profile/ProfileForm'

export const dynamic = 'force-dynamic'

export default async function IssuerProfileEditPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string }
}) {
  const session = await requireRole('issuer')
  const orgId = session.orgId!
  const org = (await db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1))[0]
  const [profile, tasks] = await Promise.all([getEditorProfile(org), getOrgTasksForSelect(orgId)])

  return (
    <>
      <Link href="/issuer/profile" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-600">
        <ArrowLeft size={14} /> Back to preview
      </Link>
      <PageHeader title="Edit public profile" subtitle="Fill it in, then save a draft or publish." />
      <OrgStatusBanner status={org?.status ?? 'pending'} />
      <Flash searchParams={searchParams} />

      <ProfileForm
        tasks={tasks}
        initial={{
          tagline: profile.tagline,
          mission: profile.mission,
          logoUrl: profile.logoUrl,
          coverUrl: profile.coverUrl,
          website: profile.website,
          contactEmail: profile.contactEmail,
          phone: profile.phone,
          location: profile.location,
          socials: profile.socials,
          causes: profile.causes,
          onboardingTaskId: profile.onboardingTaskId,
          published: profile.published,
        }}
      />
    </>
  )
}
