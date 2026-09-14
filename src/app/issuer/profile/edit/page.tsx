import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { orgs } from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/session'
import { getEditorProfile, getOrgTasksForSelect } from '@/lib/services/profile'
import { PageHeader, Flash } from '@/components/ui'
import { OrgStatusBanner } from '@/components/OrgStatusBanner'
import { ProfileForm } from '@/components/profile/ProfileForm'
import { HistoryBackButton } from '@/app/aesthetic-lab/HistoryBackButton'

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
      <HistoryBackButton fallback="/issuer/profile" variant="plain" className="mb-4" />
      <PageHeader title="Manage public profile" subtitle="Saved changes appear immediately on your live organization page." />
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
          bannerStyle: profile.bannerStyle,
          bannerPalette: profile.bannerPalette,
          causes: profile.causes,
          onboardingTaskId: profile.onboardingTaskId,
          published: profile.published,
        }}
      />
    </>
  )
}
