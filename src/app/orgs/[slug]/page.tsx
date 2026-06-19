import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { PublicHeader } from '@/components/profile/PublicHeader'
import { OrgProfileBody, type ProfileDisplay } from '@/components/profile/OrgProfileBody'
import { getSession } from '@/lib/auth/session'
import { Card, Badge, Flash } from '@/components/ui'
import {
  getPublicProfileBySlug,
  getOpenOpportunities,
  getOpportunityCard,
  getViewerClaims,
  getOrgImpact,
  type PublicOpportunity,
} from '@/lib/services/profile'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const data = await getPublicProfileBySlug(params.slug)
  if (!data) return { title: 'Organization not found · City/Sync' }
  const { org, profile, published } = data
  const description = (published && profile?.tagline) || org.description || `${org.name} on City/Sync.`
  const image = published ? profile?.coverUrl || profile?.logoUrl : undefined
  return {
    title: `${org.name} · City/Sync`,
    description,
    openGraph: { title: org.name, description, images: image ? [{ url: image }] : undefined, type: 'profile' },
  }
}

function signupHref(slug: string, taskId?: string) {
  const next = taskId ? `/participant/opportunities/${taskId}` : `/orgs/${slug}`
  return `/signup?type=participant&next=${encodeURIComponent(next)}`
}

export default async function OrgProfilePage({
  params,
  searchParams,
}: {
  params: { slug: string }
  searchParams: { error?: string; ok?: string }
}) {
  const data = await getPublicProfileBySlug(params.slug)
  if (!data) notFound()
  const { org, profile, published } = data
  const slug = org.slug ?? ''
  const session = await getSession()
  const isSignedIn = !!session
  const isParticipant = session?.role === 'participant'

  // Published gates branding/copy; opportunities + impact are always live.
  const display: ProfileDisplay = {
    orgName: org.name,
    tagline: published ? profile?.tagline ?? '' : '',
    mission: (published && profile?.mission) || org.description || '',
    logoUrl: published ? profile?.logoUrl ?? '' : '',
    coverUrl: published ? profile?.coverUrl ?? '' : '',
    location: published ? profile?.location ?? '' : '',
    website: published ? profile?.website ?? '' : '',
    contactEmail: published ? profile?.contactEmail ?? '' : '',
    phone: published ? profile?.phone ?? '' : '',
    socials: published ? profile?.socials ?? {} : {},
    causes: published ? profile?.causes ?? [] : [],
  }

  const onboardingId = profile?.onboardingTaskId ?? null
  const onboarding = onboardingId ? await getOpportunityCard(onboardingId, org.id) : null
  const open = isSignedIn ? await getOpenOpportunities(org.id, { excludeTaskId: onboardingId }) : []
  const impact = await getOrgImpact(org.id)

  let claimMap = new Map<string, string>()
  if (isParticipant && session) {
    const ids = [...open.map((o) => o.id), ...(onboarding ? [onboarding.id] : [])]
    claimMap = await getViewerClaims(session.sub, ids)
  }

  const renderCta = (task: PublicOpportunity) => {
    const gold = 'inline-flex items-center justify-center rounded-xl bg-gold-500 px-4 py-2 text-sm font-semibold text-brand-900 hover:bg-gold-400'
    const brand = 'inline-flex items-center justify-center rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600'
    const secondary = 'inline-flex items-center justify-center rounded-xl border border-ink-300 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50'

    if (!isSignedIn) return <Link href={signupHref(slug, task.id)} className={gold}>Create an account</Link>
    if (!isParticipant) return <Link href={`/opportunities/${task.id}`} className={secondary}>View</Link>
    const st = claimMap.get(task.id)
    if (st && st !== 'unclaimed') {
      const label = st === 'verified' ? 'Completed' : st === 'submitted' ? 'Submitted' : "You're signed up"
      return <Badge tone={st === 'verified' ? 'green' : 'blue'}>{label}</Badge>
    }
    if (task.status !== 'open' || task.totalOpenSlots === 0) {
      return <span className="text-sm text-ink-400">No open shifts</span>
    }
    return <Link href={`/participant/opportunities/${task.id}`} className={brand}>Sign up</Link>
  }

  const primaryCta = (
    <Link
      href={isSignedIn ? '#opportunities' : signupHref(slug, onboarding?.id)}
      className="rounded-xl bg-gold-500 px-5 py-2.5 text-sm font-semibold text-brand-900 hover:bg-gold-400"
    >
      Volunteer with us
    </Link>
  )

  const opportunitiesOverride = !isSignedIn ? (
    <Card>
      <p className="text-sm text-ink-500">
        {onboarding
          ? 'Complete onboarding to view and sign up for open opportunities. '
          : 'Create an account to view and sign up for open opportunities. '}
        <Link href={signupHref(slug)} className="font-semibold text-brand-600 hover:text-brand-500">
          Create an account
        </Link>{' '}
        or{' '}
        <Link href={`/login?next=${encodeURIComponent(`/orgs/${slug}`)}`} className="font-semibold text-brand-600 hover:text-brand-500">
          sign in
        </Link>
        .
      </p>
    </Card>
  ) : undefined

  const onboardingNote = !isSignedIn ? (
    <p className="mt-3 text-sm text-ink-500">
      New here? Start with onboarding — it takes you through creating your account.
    </p>
  ) : undefined

  return (
    <div className="min-h-screen bg-ink-50">
      <PublicHeader />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <OrgProfileBody
          display={display}
          impact={impact}
          onboarding={onboarding}
          opportunities={open}
          primaryCta={primaryCta}
          renderCta={renderCta}
          opportunitiesOverride={opportunitiesOverride}
          onboardingNote={onboardingNote}
          notice={<Flash searchParams={searchParams} />}
        />
      </main>
      <footer className="border-t border-ink-100 py-10 text-center">
        <Link href="/orgs" className="text-sm font-semibold text-brand-600 hover:text-brand-500">
          ← Discover more organizations
        </Link>
        <p className="mt-3 text-xs text-ink-400">City/Sync · civic contribution, recognized</p>
      </footer>
    </div>
  )
}
