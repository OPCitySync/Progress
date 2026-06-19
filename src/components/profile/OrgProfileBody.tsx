import type { ReactNode } from 'react'
import { Globe, Mail, Phone, MapPin, Twitter, Instagram, Facebook, Linkedin } from 'lucide-react'
import { Card, Badge, StatCard, EmptyState } from '@/components/ui'
import { fmtDateTime } from '@/lib/format'
import type { PublicOpportunity, OrgImpact } from '@/lib/services/profile'

const SOCIAL_ICONS: Record<string, typeof Globe> = {
  twitter: Twitter,
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
}

export function shiftSummary(o: { openShiftCount: number; nextShiftAt: number | null; nextShiftLabel: string }): string {
  if (o.openShiftCount === 0) return 'No upcoming shifts'
  const when = o.nextShiftAt ? fmtDateTime(o.nextShiftAt) : o.nextShiftLabel || 'Time TBD'
  const extra = o.openShiftCount > 1 ? ` · +${o.openShiftCount - 1} more` : ''
  return `${when}${extra}`
}

export type ProfileDisplay = {
  orgName: string
  tagline: string
  mission: string
  logoUrl: string
  coverUrl: string
  location: string
  website: string
  contactEmail: string
  phone: string
  socials: Record<string, string>
  causes: string[]
}

/**
 * The profile content a visitor sees — identity strip + sections — WITHOUT the
 * public site header/footer, so it can render on the public page and inside the
 * issuer's own preview. CTAs are parameterized: the public page wires up real
 * sign-up actions; the preview passes static stand-ins.
 */
export function OrgProfileBody({
  display,
  impact,
  onboarding,
  opportunities,
  primaryCta,
  renderCta,
  opportunitiesOverride,
  onboardingNote,
  notice,
}: {
  display: ProfileDisplay
  impact: OrgImpact
  onboarding: PublicOpportunity | null
  opportunities: PublicOpportunity[]
  primaryCta?: ReactNode
  renderCta: (task: PublicOpportunity) => ReactNode
  opportunitiesOverride?: ReactNode
  onboardingNote?: ReactNode
  notice?: ReactNode
}) {
  const { socials } = display
  const hasContact = !!(
    display.website ||
    display.contactEmail ||
    display.phone ||
    Object.keys(socials).length > 0
  )

  return (
    <div>
      {/* Identity header */}
      <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white">
        <div className="h-44 w-full overflow-hidden sm:h-56">
          {display.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={display.coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-brand-700 to-brand-900" />
          )}
        </div>
        <div className="relative z-10 px-6 pb-6">
          <div className="-mt-12 inline-block overflow-hidden rounded-2xl border-4 border-white bg-white shadow-card">
            <div className="h-24 w-24">
              {display.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={display.logoUrl} alt={display.orgName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-brand-700 font-display text-3xl font-semibold text-white">
                  {display.orgName.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-3xl font-semibold text-ink-900">{display.orgName}</h1>
                <Badge tone="blue">Verified issuer</Badge>
              </div>
              {display.tagline ? <p className="mt-1 text-sm text-ink-500">{display.tagline}</p> : null}
              {display.location ? (
                <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-ink-400">
                  <MapPin size={14} /> {display.location}
                </p>
              ) : null}
            </div>
            {primaryCta ? <div>{primaryCta}</div> : null}
          </div>
        </div>
      </div>

      <div className="mt-8">
        {notice}

        {display.mission ? (
          <section className="mb-10">
            <h2 className="mb-3 font-display text-2xl font-semibold text-ink-900">About</h2>
            <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink-600">{display.mission}</p>
          </section>
        ) : null}

        <section className="mb-10">
          <h2 className="mb-4 font-display text-2xl font-semibold text-ink-900">Our impact</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Volunteers" value={impact.volunteers} />
            <StatCard label="Verified contributions" value={impact.verifiedCompletions} />
            <StatCard label="Civic credits issued" value={impact.creditsMinted} />
            <StatCard label="Open opportunities" value={impact.openOpportunities} />
          </div>
        </section>

        <section id="opportunities" className="mb-10 scroll-mt-6">
          {onboarding ? (
            <div className="mb-6">
              <h2 className="mb-3 font-display text-2xl font-semibold text-ink-900">Start here</h2>
              <Card className="border-brand-200 bg-brand-50">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Badge tone="blue">New volunteer onboarding</Badge>
                    <p className="mt-2 font-semibold text-ink-900">{onboarding.title}</p>
                    {onboarding.description ? (
                      <p className="mt-1 text-sm leading-relaxed text-ink-600">{onboarding.description}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
                      <span>🗓 {shiftSummary(onboarding)}</span>
                      {onboarding.location ? <span>📍 {onboarding.location}</span> : null}
                      <span>{onboarding.credits} credits</span>
                    </div>
                    {onboardingNote}
                  </div>
                  <div className="shrink-0">{renderCta(onboarding)}</div>
                </div>
              </Card>
            </div>
          ) : null}

          <h2 className="mb-3 font-display text-2xl font-semibold text-ink-900">Open opportunities</h2>
          {opportunitiesOverride ? (
            opportunitiesOverride
          ) : opportunities.length === 0 ? (
            <EmptyState title="No open opportunities right now" body="Check back soon — new opportunities are posted regularly." />
          ) : (
            <div className="space-y-3">
              {opportunities.map((task) => (
                <Card key={task.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink-900">{task.title}</p>
                      {task.description ? (
                        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-500">{task.description}</p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-400">
                        <span className="font-medium text-gold-700">{task.credits} credits</span>
                        {task.location ? <span>📍 {task.location}</span> : null}
                        <span>🗓 {shiftSummary(task)}</span>
                        <span>
                          {task.totalOpenSlots} slot{task.totalOpenSlots === 1 ? '' : 's'} open
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0">{renderCta(task)}</div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {hasContact ? (
          <section className="mb-10">
            <h2 className="mb-3 font-display text-2xl font-semibold text-ink-900">Get in touch</h2>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-600">
              {display.website ? (
                <a href={display.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-brand-600">
                  <Globe size={15} /> Website
                </a>
              ) : null}
              {display.contactEmail ? (
                <a href={`mailto:${display.contactEmail}`} className="inline-flex items-center gap-1.5 hover:text-brand-600">
                  <Mail size={15} /> {display.contactEmail}
                </a>
              ) : null}
              {display.phone ? (
                <span className="inline-flex items-center gap-1.5">
                  <Phone size={15} /> {display.phone}
                </span>
              ) : null}
              {Object.entries(socials).map(([k, v]) => {
                const Icon = SOCIAL_ICONS[k]
                if (!Icon || !/^https?:/i.test(v)) return null
                return (
                  <a key={k} href={v} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-brand-600" aria-label={k}>
                    <Icon size={16} /> {k[0].toUpperCase() + k.slice(1)}
                  </a>
                )
              })}
            </div>
          </section>
        ) : null}

        {display.causes.length > 0 ? (
          <div className="mb-10 flex flex-wrap items-center gap-2">
            {display.causes.map((c) => (
              <Badge key={c} tone="gray">
                {c}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
