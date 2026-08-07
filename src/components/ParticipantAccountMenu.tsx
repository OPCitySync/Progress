'use client'

import Link from 'next/link'
import { ChevronDown, HelpCircle, LogOut, MapPinned, Moon, Settings2, Sun } from 'lucide-react'
import { signOutAction, switchCityAction, switchIdentityAction } from '@/app/actions'
import type { Session } from '@/lib/auth/session'
import type { ActorContext } from '@/lib/services/identity-access'
import type { CityNetwork } from '@/lib/services/city-networks'
import { useWorkspaceTheme } from '@/components/WorkspaceChrome'

function homeForRole(role: ActorContext['role']) {
  if (role === 'issuer') return '/issuer'
  if (role === 'redeemer') return '/redeemer'
  return '/participant'
}

function cityClassification(city: CityNetwork | undefined) {
  if (!city) return 'No city network selected'
  if (city.participation?.status === 'active') return `City Member · ${city.name}`
  if (city.participation?.status === 'barred') return `Participation restricted · ${city.name}`
  if (city.participation?.status === 'new') return `New Participant · ${city.name}`
  return `City Network · ${city.name}`
}

/**
 * Participant-only account controls. Keeping these in one menu lets the
 * workspace focus on volunteering while still making city, role, and account
 * actions available from a familiar top-right location.
 */
export function ParticipantAccountMenu({
  session,
  avatarUrl,
  cities,
  activeCityId,
  contexts,
}: {
  session: Session
  avatarUrl: string
  cities: CityNetwork[]
  activeCityId?: string
  contexts: ActorContext[]
}) {
  const { theme, toggleTheme } = useWorkspaceTheme()
  const authorities = contexts.filter((context) => context.kind === 'authority')
  const activeCity = cities.find((city) => city.id === activeCityId)
  const classification = cityClassification(activeCity)

  return (
    <details className="skeuo-account-menu group relative shrink-0">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-black/[0.04] [&::-webkit-details-marker]:hidden">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-8 w-8 rounded-xl border border-ink-200 object-cover" />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-700 text-xs font-bold text-white">
            {session.name.slice(0, 1).toUpperCase() || 'U'}
          </span>
        )}
        <span className="hidden max-w-36 truncate text-sm font-semibold text-ink-800 sm:block">{session.name}</span>
        <ChevronDown size={16} className="text-ink-400 transition-transform group-open:rotate-180" />
      </summary>

      <div className="skeuo-account-menu-panel absolute right-0 top-[calc(100%+0.45rem)] z-50 w-[19rem] rounded-2xl border border-ink-200 p-2 shadow-xl">
        <div className="flex items-center justify-between gap-2 border-b border-ink-100 px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-900">{session.name}</p>
            <p className="mt-0.5 truncate text-xs text-ink-500">{session.email}</p>
            <p className="mt-2 flex items-center gap-1.5 truncate text-[11px] font-semibold text-brand-700">
              <MapPinned size={13} aria-hidden="true" />
              {classification}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Dark mode. Switch to light mode' : 'Light mode. Switch to dark mode'}
            aria-pressed={theme === 'dark'}
            title={theme === 'dark' ? 'Dark mode — switch to light mode' : 'Light mode — switch to dark mode'}
            className="skeuo-account-header-theme-toggle"
            data-theme={theme}
          >
            <Sun size={14} className="skeuo-account-header-theme-icon skeuo-account-header-theme-icon--sun" aria-hidden="true" />
            <span className="skeuo-account-header-theme-track" aria-hidden="true">
              <span className="skeuo-account-header-theme-thumb" />
            </span>
            <Moon size={14} className="skeuo-account-header-theme-icon skeuo-account-header-theme-icon--moon" aria-hidden="true" />
          </button>
        </div>

        <div className="py-1">
          <Link href="/settings" className="skeuo-account-menu-item">
            <Settings2 size={16} />
            Profile &amp; settings
          </Link>
          <a href="mailto:support@city-sync.org?subject=City%2FSync%20help" className="skeuo-account-menu-item">
            <HelpCircle size={16} />
            Help &amp; support
          </a>
        </div>

        {authorities.length > 0 ? (
          <div className="border-t border-ink-100 py-2">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">Switch role</p>
            <div className="space-y-1 px-1">
              {authorities.map((authority) => (
                <form action={switchIdentityAction} key={authority.identityId}>
                  <input type="hidden" name="identityId" value={authority.identityId} />
                  <input type="hidden" name="redirectTo" value={homeForRole(authority.role)} />
                  <button type="submit" className="skeuo-role-switcher">
                    <span className="skeuo-role-switcher-track" aria-hidden="true"><span /></span>
                    <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-ink-800">{authority.label}</span>
                    <span className="text-xs font-medium text-ink-400">Switch</span>
                  </button>
                </form>
              ))}
            </div>
          </div>
        ) : null}

        <details className="border-t border-ink-100 py-1">
          <summary className="skeuo-account-menu-item cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <MapPinned size={16} />
            <span>My Cities</span>
            <span className="ml-auto flex items-center gap-1 text-xs font-medium text-ink-400">
              {activeCity?.name ?? 'Choose'} <ChevronDown size={14} />
            </span>
          </summary>
          <div className="space-y-1 px-1 pb-1 pt-1">
            {cities.length === 0 ? (
              <p className="px-2 py-2 text-xs leading-relaxed text-ink-500">You have not joined a city network yet.</p>
            ) : (
              cities.map((city) => {
                const active = city.id === activeCityId
                return (
                  <form action={switchCityAction} key={city.id}>
                    <input type="hidden" name="cityId" value={city.id} />
                    <input type="hidden" name="redirectTo" value="/participant" />
                    <button type="submit" className={`skeuo-city-menu-item ${active ? 'skeuo-city-menu-item-active' : ''}`}>
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-700 text-[10px] font-bold text-white">
                        {city.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-left">{city.name}</span>
                      {active ? <span className="text-[10px] font-bold uppercase tracking-wide text-brand-700">Current</span> : null}
                    </button>
                  </form>
                )
              })
            )}
            <Link href="/workspace/cities" className="skeuo-account-menu-item mt-1 text-brand-700">
              <MapPinned size={16} />
              Discover city networks
            </Link>
          </div>
        </details>

        <div className="border-t border-ink-100 pt-1">
          <form action={signOutAction}>
            <button type="submit" className="skeuo-account-menu-item w-full text-red-700 hover:bg-red-50">
              <LogOut size={16} />
              Sign out
            </button>
          </form>
        </div>
      </div>
    </details>
  )
}
