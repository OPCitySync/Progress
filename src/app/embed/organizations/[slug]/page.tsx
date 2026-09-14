import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { OrgProfileBody, type ProfileDisplay } from '@/components/profile/OrgProfileBody'
import {
  getOpenOpportunities,
  getOpportunityCard,
  getOrgImpact,
  getPublicApplications,
  getPublicProfileBySlug,
  type PublicApplication,
  type PublicOpportunity,
} from '@/lib/services/profile'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  robots: { index: false, follow: true },
}

function destination(path: string) {
  return `/signup?type=participant&next=${encodeURIComponent(path)}`
}

export default async function EmbeddedOrganizationProfile({ params }: { params: { slug: string } }) {
  const data = await getPublicProfileBySlug(params.slug)
  if (!data) notFound()

  const { org, profile } = data
  const display: ProfileDisplay = {
    orgName: org.name,
    tagline: profile?.tagline ?? '',
    mission: profile?.mission || org.description || '',
    logoUrl: profile?.logoUrl ?? '',
    coverUrl: profile?.coverUrl ?? '',
    bannerStyle: profile?.bannerStyle ?? 'original',
    bannerPalette: profile?.bannerPalette ?? 'citysync',
    location: profile?.location ?? '',
    website: profile?.website ?? '',
    contactEmail: profile?.contactEmail ?? '',
    phone: profile?.phone ?? '',
    socials: profile?.socials ?? {},
    causes: profile?.causes ?? [],
  }

  const onboardingId = profile?.onboardingTaskId ?? null
  const [onboarding, opportunities, applications, impact] = await Promise.all([
    onboardingId ? getOpportunityCard(onboardingId, org.id) : Promise.resolve(null),
    getOpenOpportunities(org.id, { excludeTaskId: onboardingId }),
    getPublicApplications(org.id),
    getOrgImpact(org.id),
  ])

  const renderOpportunityCta = (opportunity: PublicOpportunity) => {
    const path = `/aesthetic-lab/opportunities/${opportunity.id}`
    return <a href={destination(path)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">View opportunity</a>
  }
  const renderApplicationCta = (application: PublicApplication) => {
    const path = `/aesthetic-lab/opportunities/${application.taskId}#application`
    return <a href={destination(path)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">Apply</a>
  }

  return (
    <main className="min-h-screen bg-transparent px-3 py-3 sm:px-5 sm:py-5">
      <div className="mx-auto max-w-4xl">
        <OrgProfileBody
          display={display}
          impact={impact}
          onboarding={onboarding}
          opportunities={opportunities}
          applications={applications}
          primaryCta={<a href={applications.length ? '#applications' : '#opportunities'} className="rounded-xl bg-gold-500 px-5 py-2.5 text-sm font-semibold text-brand-900 hover:bg-gold-400">Volunteer with us</a>}
          renderCta={renderOpportunityCta}
          renderApplicationCta={renderApplicationCta}
        />
        <p className="pb-5 text-center text-xs text-ink-400">
          <a href={`/orgs/${org.slug}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-600 hover:text-brand-500">Powered by City/Sync</a>
        </p>
      </div>
    </main>
  )
}
