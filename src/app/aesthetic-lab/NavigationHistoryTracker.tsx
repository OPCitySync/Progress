'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export const CURRENT_IN_APP_PATH_KEY = 'citysync.navigation.current'
export const PREVIOUS_IN_APP_PATH_KEY = 'citysync.navigation.previous'

/** Keep the most recent in-app route in this browser tab for contextual Back controls. */
export function NavigationHistoryTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const query = searchParams.toString()

  useEffect(() => {
    const nextPath = `${pathname}${query ? `?${query}` : ''}`
    const currentPath = window.sessionStorage.getItem(CURRENT_IN_APP_PATH_KEY)

    if (currentPath && currentPath !== nextPath) {
      window.sessionStorage.setItem(PREVIOUS_IN_APP_PATH_KEY, currentPath)
    }
    window.sessionStorage.setItem(CURRENT_IN_APP_PATH_KEY, nextPath)
  }, [pathname, query])

  return null
}
