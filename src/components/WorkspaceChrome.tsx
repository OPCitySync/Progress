'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { CityRail } from '@/components/CityRail'
import { CITY_RAIL_COOKIE, CITY_RAIL_SESSION_STORAGE_KEY, LEGACY_CITY_RAIL_STORAGE_KEY } from '@/lib/city-rail-preference'
import { THEME_COOKIE, THEME_SESSION_STORAGE_KEY, type WorkspaceTheme } from '@/lib/theme-preference'
import type { CityNetwork } from '@/lib/services/city-networks'

const WorkspaceThemeContext = createContext<{
  theme: WorkspaceTheme
  toggleTheme: () => void
} | null>(null)

export function useWorkspaceTheme() {
  const value = useContext(WorkspaceThemeContext)
  if (!value) throw new Error('useWorkspaceTheme must be used within WorkspaceChrome')
  return value
}

function saveCityRailPreference(collapsed: boolean) {
  document.cookie = `${CITY_RAIL_COOKIE}=${collapsed ? 'true' : 'false'}; path=/; max-age=31536000; samesite=lax`
  window.sessionStorage.setItem(CITY_RAIL_SESSION_STORAGE_KEY, String(collapsed))
}

function browserCityRailPreference(serverPreference: boolean) {
  if (typeof window === 'undefined') return serverPreference
  const saved = window.sessionStorage.getItem(CITY_RAIL_SESSION_STORAGE_KEY)
  if (saved !== null) return saved === 'true'
  const legacy = window.localStorage.getItem(LEGACY_CITY_RAIL_STORAGE_KEY)
  return legacy === null ? serverPreference : legacy === 'true'
}

function saveThemePreference(theme: WorkspaceTheme) {
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`
  window.sessionStorage.setItem(THEME_SESSION_STORAGE_KEY, theme)
}

function browserThemePreference(serverPreference: WorkspaceTheme): WorkspaceTheme {
  if (typeof window === 'undefined') return serverPreference
  const saved = window.sessionStorage.getItem(THEME_SESSION_STORAGE_KEY)
  return saved === 'dark' || saved === 'light' ? saved : serverPreference
}

/**
 * Keeps the City Networks pull-tab state local to the signed-in workspace.
 * The secondary navigation remains available; only the narrow city rail moves
 * out of the way and the workspace reclaims its width.
 */
export function WorkspaceChrome({
  homeHref,
  cities,
  activeCityId,
  initialCityRailCollapsed,
  initialTheme,
  cityRailEnabled = true,
  sidebar,
  header,
  children,
}: {
  homeHref: string
  cities: CityNetwork[]
  activeCityId?: string
  /** Read on the server so a route change never starts at the wrong width. */
  initialCityRailCollapsed: boolean
  /** Read on the server to make a hard refresh retain the selected theme. */
  initialTheme: WorkspaceTheme
  /** Civic Participants use the account menu instead of the dedicated city rail. */
  cityRailEnabled?: boolean
  sidebar: ReactNode
  header: ReactNode
  children: ReactNode
}) {
  // Route-level AppShell instances remount as sections change. Read the
  // already-known browser state synchronously on those navigations so they do
  // not briefly render an opposite rail position before an effect can run.
  const [cityRailCollapsed, setCityRailCollapsed] = useState(() => browserCityRailPreference(initialCityRailCollapsed))
  const [theme, setTheme] = useState(() => browserThemePreference(initialTheme))
  const [canAnimate, setCanAnimate] = useState(false)

  useEffect(() => {
    // Keep the server cookie in step for hard refreshes, while sessionStorage
    // supplies the exact value immediately during client-side route changes.
    saveCityRailPreference(cityRailCollapsed)
    window.localStorage.removeItem(LEGACY_CITY_RAIL_STORAGE_KEY)
    const animationFrame = window.requestAnimationFrame(() => setCanAnimate(true))
    return () => window.cancelAnimationFrame(animationFrame)
  }, [])

  useEffect(() => {
    saveThemePreference(theme)
  }, [theme])

  function toggleCityRail() {
    setCityRailCollapsed((current) => {
      const next = !current
      saveCityRailPreference(next)
      return next
    })
  }

  function toggleTheme() {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }

  return (
    <WorkspaceThemeContext.Provider value={{ theme, toggleTheme }}>
      <div className={`skeuo-app min-h-screen ${theme === 'dark' ? 'skeuo-dark' : ''}`}>
        {cityRailEnabled ? <CityRail homeHref={homeHref} cities={cities} activeCityId={activeCityId} collapsed={cityRailCollapsed} onToggle={toggleCityRail} /> : null}
        <aside className={`skeuo-sidebar fixed inset-y-0 z-20 hidden w-[16.5rem] flex-col px-3 py-5 ${canAnimate && cityRailEnabled ? 'transition-[left] duration-300 ease-out' : ''} md:flex ${cityRailEnabled && !cityRailCollapsed ? 'left-[4.5rem]' : 'left-0'}`}>
          {sidebar}
        </aside>
        <main className={`min-h-screen w-full overflow-x-hidden ${canAnimate && cityRailEnabled ? 'transition-[margin,width] duration-300 ease-out' : ''} ${cityRailEnabled && !cityRailCollapsed ? 'md:ml-[21rem] md:w-[calc(100%-21rem)]' : 'md:ml-[16.5rem] md:w-[calc(100%-16.5rem)]'}`}>
          <header className="skeuo-header border-b border-[#c9b98d]">{header}</header>
          <div className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-10">{children}</div>
        </main>
      </div>
    </WorkspaceThemeContext.Provider>
  )
}
