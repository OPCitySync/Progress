import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { Pencil, ExternalLink } from 'lucide-react'
import { db } from '@/lib/db/client'
import { orgs } from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/session'
import {
  getEditorProfile,
  getOpportunityCard,
  getOpenOpportunities,
  getOrgImpact,
} from '@/lib/services/profile'
import { OrgProfileBody, type ProfileDisplay } from '@/components/profile/OrgProfileBody'
import { PageHeader, Badge } from '@/components/ui'
import { OrgStatusBanner } from '@/components/OrgStatusBanner'

export const dynamic = 'force-dynamic'

export default async function IssuerProfilePreviewPage() {
  const session = await requireRole('issuer')
  const orgId = session.orgId!
  const org = (await db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1))[0]
  const profile = await getEditorProfile(org)

  const onboardingId = profile.onboardingTaskId
  const onboarding = onboardingId ? await getOpportunityCard(onboardingId, org.id) : null
  const open = await getOpenOpportunities(org.id, { excludeTaskId: onboardingId })
  const impact = await getOrgImpact(org.id)

  const display: ProfileDisplay = {
    orgName: org.name,
    tagline: profile.tagline,
    mission: profile.mission || org.description || '',
    logoUrl: profile.logoUrl,
    coverUrl: profile.coverUrl,
    location: profile.location,
    website: profile.website,
    contactEmail: profile.contactEmail,
    phone: profile.phone,
    socials: profile.socials,
    causes: profile.causes,
  }

  // Preview = non-interactive stand-ins for the visitor-facing buttons.
  const primaryCta = (
    <span className="inline-flex cursor-default items-center justify-center rounded-xl bg-gold-500/70 px-5 py-2.5 text-sm font-semibold text-brand-900">
      Volunteer with us
    </span>
  )
  const renderCta = () => (
    <span className="inline-flex items-center justify-center rounded-xl border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-400">
      Sign up
    </span>
  )

  return (
    <>
      <PageHeader
        title="Public profile"
        subtitle="This is what visitors see at your public page."
        action={
          <div className="flex gap-2">
            <Link
              href="/issuer/profile/edit"
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
            >
              <Pencil size={14} /> Edit
            </Link>
            {org?.slug ? (
              <Link
                href={`/orgs/${org.slug}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 rounded-xl border border-ink-300 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50"
              >
                View live <ExternalLink size={14} />
              </Link>
            ) : null}
          </div>
        }
      />
      <OrgStatusBanner status={org?.status ?? 'pending'} />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Badge tone={profile.published ? 'green' : 'gray'}>{profile.published ? 'Published' : 'Draft'}</Badge>
        <span className="text-xs text-ink-400">
          {profile.published
            ? 'Your custom page is live. The preview below matches what visitors see.'
            : 'Not published yet — visitors currently see a default page. This preview shows your draft.'}
        </span>
      </div>

      <OrgProfileBody
        display={display}
        impact={impact}
        onboarding={onboarding}
        opportunities={open}
        primaryCta={primaryCta}
        renderCta={renderCta}
      />
    </>
  )
}
