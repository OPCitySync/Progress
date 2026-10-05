'use client'

import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { CURRENT_IN_APP_PATH_KEY, PREVIOUS_IN_APP_PATH_KEY } from './NavigationHistoryTracker'
import styles from './prototype.module.css'

type HistoryBackButtonProps = {
  fallback: string
  className?: string
  variant?: 'app' | 'plain' | 'dark'
}

type NavigationEntryLike = { index: number; url: string }
type NavigationLike = {
  currentEntry?: NavigationEntryLike
  entries?: () => NavigationEntryLike[]
}

function pathFromUrl(value: string) {
  try {
    const url = new URL(value, window.location.origin)
    return url.origin === window.location.origin ? `${url.pathname}${url.search}${url.hash}` : null
  } catch {
    return null
  }
}

function previousNavigationPath() {
  const navigation = (window as Window & { navigation?: NavigationLike }).navigation
  const currentIndex = navigation?.currentEntry?.index
  const entries = navigation?.entries?.()
  if (typeof currentIndex !== 'number' || !entries) return null
  const previousEntry = entries.find((entry) => entry.index === currentIndex - 1)
  return previousEntry ? pathFromUrl(previousEntry.url) : null
}

function previousStoredPath() {
  const here = `${window.location.pathname}${window.location.search}${window.location.hash}`
  const trackedCurrent = window.sessionStorage.getItem(CURRENT_IN_APP_PATH_KEY)
  const trackedPrevious = window.sessionStorage.getItem(PREVIOUS_IN_APP_PATH_KEY)

  if (trackedCurrent && trackedCurrent !== here) return trackedCurrent
  if (trackedPrevious && trackedPrevious !== here) return trackedPrevious

  return document.referrer ? pathFromUrl(document.referrer) : null
}

function priorPath() {
  return previousNavigationPath() ?? previousStoredPath()
}

function destinationName(value: string) {
  const path = value.split('#')[0].split('?')[0].replace(/\/$/, '') || '/'

  if (path === '/aesthetic-lab/issuer') return 'Home'
  if (path === '/aesthetic-lab') return 'Home'
  if (path === '/aesthetic-lab/issuer/catalog') return 'Workspace'
  if (/^\/aesthetic-lab\/issuer\/programs\/[^/]+/.test(path)) return 'Program Control Center'
  if (/^\/aesthetic-lab\/issuer\/shifts\/[^/]+\/verify/.test(path)) return 'Shift Verification'
  if (path === '/aesthetic-lab/issuer/volunteers') return 'Volunteers'
  if (/^\/aesthetic-lab\/issuer\/volunteers\/[^/]+/.test(path)) return 'Volunteer Profile'
  if (path === '/aesthetic-lab/issuer/profile') return 'Public Profile'
  if (path === '/aesthetic-lab/issuer/profile/edit') return 'Organization Information'
  if (path.startsWith('/aesthetic-lab/settings')) return 'Settings'
  if (path.startsWith('/aesthetic-lab/issuer/notifications')) return 'Inbox'
  if (path === '/aesthetic-lab/issuer/notification-history') return 'Notification History'
  if (path.startsWith('/aesthetic-lab/issuer/documents')) return 'Document Library'
  if (path === '/aesthetic-lab/issuer/onboarding' || path.startsWith('/aesthetic-lab/onboarding/')) return 'Onboarding'
  if (path === '/aesthetic-lab/issuer/waiver') return 'Waiver'
  if (/^\/aesthetic-lab\/issuer\/opportunities\/[^/]+/.test(path)) return 'Opportunity'
  if (path === '/aesthetic-lab/issuer/events') return 'City-Wide Schedule'
  if (path === '/aesthetic-lab/issuer/feed') return 'MyCity Feed'
  if (path === '/aesthetic-lab/opportunities') return 'Opportunities'
  if (/^\/aesthetic-lab\/opportunities\/[^/]+/.test(path)) return 'Opportunity'
  if (path === '/aesthetic-lab/profile') return 'Volunteer Profile'
  if (path === '/aesthetic-lab/organizations') return 'Organizations'
  if (/^\/aesthetic-lab\/organizations\/[^/]+/.test(path) || /^\/orgs\/[^/]+/.test(path)) return 'Organization Profile'
  if (path.startsWith('/aesthetic-lab/reflections') || path === '/aesthetic-lab/history') return 'Activity History'
  if (path.startsWith('/aesthetic-lab/messages') || path.startsWith('/aesthetic-lab/chats')) return 'Messages'
  if (path.startsWith('/transparency') || path.startsWith('/workspace/ledger')) return 'Public Ledger'
  if (path === '/issuer') return 'Dashboard'
  if (path.startsWith('/issuer/catalog')) return 'Catalog'
  if (path.startsWith('/issuer/profile')) return 'Public Profile'
  if (/^\/issuer\/tasks\/[^/]+/.test(path)) return 'Task'
  if (path === '/orgs') return 'Organizations'
  if (path === '/opportunities') return 'Opportunities'
  if (path === '/participant/opportunities') return 'Opportunities'
  if (/^\/participant\/opportunities\/[^/]+/.test(path) || /^\/opportunities\/[^/]+/.test(path)) return 'Opportunity'
  return 'Previous Page'
}

/** Return to the actual prior page, with a safe in-app destination for direct visits. */
export function HistoryBackButton({ fallback, className, variant = 'app' }: HistoryBackButtonProps) {
  const router = useRouter()
  const [label, setLabel] = useState(() => destinationName(fallback))

  useEffect(() => {
    setLabel(destinationName(priorPath() ?? fallback))
  }, [fallback])

  function goBack() {
    if (priorPath() && window.history.length > 1) {
      router.back()
      return
    }
    router.push(fallback)
  }

  return (
    <button
      type="button"
      className={[
        styles.historyBackButton,
        variant === 'plain' ? styles.historyBackButtonPlain : '',
        variant === 'dark' ? styles.historyBackButtonDark : '',
        className,
      ].filter(Boolean).join(' ')}
      onClick={goBack}
      aria-label={`Return to ${label}`}
    >
      <ArrowLeft size={15} /> {label}
    </button>
  )
}
