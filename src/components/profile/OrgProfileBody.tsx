import type { ReactNode } from 'react'
import {
  ArrowUpRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  CircleDot,
  Clock3,
  Globe,
  HeartHandshake,
  Instagram,
  Facebook,
  Linkedin,
  Mail,
  MapPin,
  Megaphone,
  Phone,
  Sparkles,
  Twitter,
  UsersRound,
} from 'lucide-react'
import { EmptyState } from '@/components/ui'
import { OrganizationBanner } from '@/components/profile/OrganizationBanner'
import { fmtDateTime } from '@/lib/format'
import type { PublicApplication, PublicOpportunity, OrgImpact } from '@/lib/services/profile'
import type { OrganizationBannerPalette, OrganizationBannerStyle } from '@/lib/profile/organization-appearance'

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
  bannerStyle: OrganizationBannerStyle
  bannerPalette: OrganizationBannerPalette
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
  applications = [],
  primaryCta,
  renderCta,
  renderApplicationCta,
  opportunitiesOverride,
  onboardingNote,
  notice,
}: {
  display: ProfileDisplay
  impact: OrgImpact
  onboarding: PublicOpportunity | null
  opportunities: PublicOpportunity[]
  applications?: PublicApplication[]
  primaryCta?: ReactNode
  renderCta: (task: PublicOpportunity) => ReactNode
  renderApplicationCta?: (application: PublicApplication) => ReactNode
  opportunitiesOverride?: ReactNode
  onboardingNote?: ReactNode
  notice?: ReactNode
}) {
  const { socials } = display
  const mapEmbedUrl = display.location
    ? `https://maps.google.com/maps?q=${encodeURIComponent(display.location)}&z=15&output=embed`
    : ''

  return (
    <div className="space-y-10">
      <section className="overflow-hidden rounded-[28px] border border-gold-200 bg-white shadow-panel">
        <OrganizationBanner bannerStyle={display.bannerStyle} bannerPalette={display.bannerPalette} coverUrl={display.coverUrl} className="relative h-48 sm:h-60">
          <div className="absolute left-6 top-6 z-10 inline-flex items-center gap-2 rounded-full border border-white/25 bg-brand-900/45 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
            <HeartHandshake size={14} className="text-gold-300" /> Community organization
          </div>
        </OrganizationBanner>

        <div className="relative px-5 pb-0 sm:px-8">
          <div className="-mt-14 inline-block overflow-hidden rounded-[22px] border-4 border-white bg-white shadow-lg">
            <div className="h-28 w-28">
              {display.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={display.logoUrl} alt={display.orgName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gold-300 to-gold-600 font-display text-4xl font-semibold text-brand-900">
                  {display.orgName.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-end justify-between gap-5 pb-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">{display.orgName}</h1>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-2.5 py-1 text-xs font-bold text-brand-700"><BadgeCheck size={14} /> Verified</span>
              </div>
              {display.tagline ? <p className="mt-2 max-w-2xl text-base leading-relaxed text-ink-500">{display.tagline}</p> : null}
              {display.location ? <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-ink-400"><MapPin size={15} className="text-gold-600" /> {display.location}</p> : null}
            </div>
            {primaryCta ? <div className="shrink-0">{primaryCta}</div> : null}
          </div>

          {display.mission ? (
            <div className="-mx-5 border-t border-gold-200 bg-gradient-to-r from-gold-50 via-white to-brand-50 px-5 py-6 sm:-mx-8 sm:px-8">
              <div>
                  <p className="text-xs font-bold uppercase tracking-[.16em] text-gold-700">About</p>
                  <p className="mt-2 max-w-3xl whitespace-pre-line text-[15px] leading-7 text-ink-600">{display.mission}</p>
                  {display.causes.length > 0 ? <div className="mt-4 flex flex-wrap gap-2">{display.causes.map((cause) => <span key={cause} className="rounded-full border border-gold-200 bg-white/75 px-3 py-1 text-xs font-semibold text-ink-600">{cause}</span>)}</div> : null}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {notice}

      <section className="grid gap-6 md:grid-cols-2">
        <article className="rounded-3xl border border-ink-200 bg-white p-6 shadow-card sm:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
              <Building2 size={19} />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[.16em] text-brand-600">Organization Information</p>
              <h2 className="font-display text-2xl font-semibold text-ink-900">{display.orgName}</h2>
            </div>
          </div>

          <dl className="mt-6 divide-y divide-ink-100 border-y border-ink-100">
            <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 py-4">
              <MapPin size={17} className="mt-0.5 text-gold-600" />
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-ink-400">Address</dt>
                <dd className="mt-1 text-sm leading-relaxed text-ink-700">{display.location || 'Address not listed'}</dd>
              </div>
            </div>
            <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 py-4">
              <Phone size={17} className="mt-0.5 text-gold-600" />
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-ink-400">Phone</dt>
                <dd className="mt-1 text-sm text-ink-700">
                  {display.phone ? <a href={`tel:${display.phone}`} className="font-medium hover:text-brand-700">{display.phone}</a> : 'Phone number not listed'}
                </dd>
              </div>
            </div>
            <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 py-4">
              <Mail size={17} className="mt-0.5 text-gold-600" />
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-ink-400">Email</dt>
                <dd className="mt-1 break-words text-sm text-ink-700">
                  {display.contactEmail ? <a href={`mailto:${display.contactEmail}`} className="font-medium hover:text-brand-700">{display.contactEmail}</a> : 'Email not listed'}
                </dd>
              </div>
            </div>
            <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 py-4">
              <Globe size={17} className="mt-0.5 text-gold-600" />
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-ink-400">Website</dt>
                <dd className="mt-1 break-words text-sm text-ink-700">
                  {display.website ? <a href={display.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium hover:text-brand-700">Visit website <ArrowUpRight size={13} /></a> : 'Website not listed'}
                </dd>
              </div>
            </div>
          </dl>

          {Object.entries(socials).some(([key, value]) => !!SOCIAL_ICONS[key] && /^https?:/i.test(value)) ? (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-bold uppercase tracking-wide text-ink-400">Other links</span>
              {Object.entries(socials).map(([key, value]) => {
                const Icon = SOCIAL_ICONS[key]
                if (!Icon || !/^https?:/i.test(value)) return null
                return <a key={key} href={value} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-ink-200 bg-ink-50 text-ink-600 transition-colors hover:border-gold-400 hover:bg-gold-50 hover:text-brand-700" aria-label={key}><Icon size={16} /></a>
              })}
            </div>
          ) : null}
        </article>

        <article className="flex min-h-[28rem] flex-col overflow-hidden rounded-3xl border border-ink-200 bg-white shadow-card">
          <div className="flex items-center gap-3 px-6 py-5 sm:px-8">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gold-100 text-gold-700">
              <MapPin size={19} />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[.16em] text-gold-700">Find Us</p>
              <h2 className="font-display text-xl font-semibold text-ink-900">{display.location || 'Location not listed'}</h2>
            </div>
          </div>
          <div className="relative min-h-80 flex-1 border-t border-ink-200 bg-brand-50">
            {mapEmbedUrl ? (
              <iframe
                title={`Google Map showing ${display.orgName} at ${display.location}`}
                src={mapEmbedUrl}
                className="absolute inset-0 h-full w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            ) : (
              <div className="flex h-full min-h-80 flex-col items-center justify-center p-8 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand-700 shadow-card"><MapPin size={22} /></span>
                <p className="mt-4 font-display text-lg font-semibold text-ink-800">Location not listed</p>
                <p className="mt-1 text-sm text-ink-500">A Google Map will appear when the organization adds its address.</p>
              </div>
            )}
          </div>
        </article>
      </section>

      {applications.length > 0 ? (
        <section id="applications" className="scroll-mt-6">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-100 text-brand-700"><Megaphone size={19} /></span><div><p className="text-xs font-bold uppercase tracking-[.16em] text-brand-600">Join the team</p><h2 className="font-display text-2xl font-semibold text-ink-900">Apply to volunteer</h2></div></div>
          </div>
          <div className="grid gap-4">
            {applications.map((application) => (
              <article key={application.taskId} className="group relative flex min-h-56 flex-col overflow-hidden rounded-3xl border border-brand-200 bg-gradient-to-br from-white to-brand-50 p-6 shadow-card transition-transform duration-200 hover:-translate-y-1">
                <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-brand-100" />
                <div className="relative flex items-center justify-between gap-3"><span className="inline-flex items-center gap-1.5 rounded-full bg-brand-700 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white"><CircleDot size={12} /> Applications open</span>{application.hasQuestions ? <span className="text-xs font-semibold text-ink-400">Includes questions</span> : null}</div>
                <h3 className="relative mt-5 font-display text-xl font-semibold text-ink-900">{application.title}</h3>
                <p className="relative mt-2 text-sm leading-relaxed text-ink-500">{application.description}</p>
                {application.roleTitles.length ? <p className="relative mt-3 text-xs leading-relaxed text-ink-400">Explore: {application.roleTitles.join(' · ')}</p> : null}
                {renderApplicationCta ? <div className="relative mt-auto flex justify-end pt-5">{renderApplicationCta(application)}</div> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section id="opportunities" className="scroll-mt-6">
        {onboarding ? (
          <div className="mb-9 overflow-hidden rounded-3xl border border-gold-200 bg-gradient-to-r from-gold-50 via-white to-brand-50 shadow-card">
            <div className="grid gap-5 p-6 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-300 to-gold-500 text-brand-900 shadow-card"><Sparkles size={22} /></span>
              <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[.16em] text-gold-700">A good first step</p><h2 className="mt-1 font-display text-xl font-semibold text-ink-900">{onboarding.title}</h2>{onboarding.description ? <p className="mt-2 text-sm leading-relaxed text-ink-500">{onboarding.description}</p> : null}<div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-ink-500"><span className="inline-flex items-center gap-1.5"><CalendarDays size={14} className="text-brand-600" /> {shiftSummary(onboarding)}</span>{onboarding.location ? <span className="inline-flex items-center gap-1.5"><MapPin size={14} className="text-brand-600" /> {onboarding.location}</span> : null}</div>{onboardingNote}</div>
              <div className="shrink-0">{renderCta(onboarding)}</div>
            </div>
          </div>
        ) : null}

        <div className="mb-4 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gold-100 text-gold-700"><CalendarDays size={19} /></span><div><p className="text-xs font-bold uppercase tracking-[.16em] text-gold-700">Choose your next step</p><h2 className="font-display text-2xl font-semibold text-ink-900">Upcoming opportunities</h2></div></div>
        {opportunitiesOverride ? opportunitiesOverride : opportunities.length === 0 ? (
          <EmptyState title="No open opportunities right now" body="Check back soon — new opportunities are posted regularly." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {opportunities.map((task) => (
              <article key={task.id} className="flex min-h-60 flex-col rounded-3xl border border-ink-200 bg-white p-5 shadow-card transition-all duration-200 hover:-translate-y-1 hover:border-gold-300 hover:shadow-panel">
                <div className="flex items-center justify-between gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-100 text-gold-700"><HeartHandshake size={17} /></span><span className="rounded-full bg-ink-50 px-2.5 py-1 text-xs font-bold text-ink-500">{task.totalOpenSlots} open</span></div>
                <h3 className="mt-4 font-display text-lg font-semibold text-ink-900">{task.title}</h3>
                {task.description ? <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-500">{task.description}</p> : null}
                <div className="mt-4 grid gap-2 border-t border-ink-100 pt-4 text-xs text-ink-500">
                  <span className="inline-flex items-start gap-2"><Clock3 size={14} className="mt-0.5 shrink-0 text-brand-600" /> {shiftSummary(task)}</span>
                  {task.location ? <span className="inline-flex items-start gap-2"><MapPin size={14} className="mt-0.5 shrink-0 text-brand-600" /> {task.location}</span> : null}
                </div>
                <div className="mt-auto flex justify-end pt-5">{renderCta(task)}</div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-800 to-brand-900 p-6 text-white shadow-panel sm:p-8">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full border-[36px] border-gold-300/20" />
        <div className="relative mb-6 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gold-300 text-brand-900"><UsersRound size={19} /></span><div><p className="text-xs font-bold uppercase tracking-[.16em] text-gold-300">Growing together</p><h2 className="font-display text-2xl font-semibold">Community impact</h2></div></div>
        <div className="relative grid gap-3 sm:grid-cols-3">
          {[['Volunteers', impact.volunteers], ['Verified contributions', impact.verifiedCompletions], ['Open opportunities', impact.openOpportunities]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur"><strong className="font-display text-3xl font-semibold text-gold-300">{value}</strong><p className="mt-1 text-sm text-white/70">{label}</p></div>)}
        </div>
      </section>

    </div>
  )
}
