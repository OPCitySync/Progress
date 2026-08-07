'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/participant/opportunities', label: 'My Opportunities' },
  { href: '/participant/resume', label: 'Service History' },
]

/** The focused top rail shared by the participant opportunity and service-history views. */
export function ParticipantOpportunitiesTabs() {
  const pathname = usePathname()
  const isOpportunitiesSection = pathname === '/participant/opportunities' || pathname.startsWith('/participant/opportunities/')
  const isServiceHistorySection = pathname === '/participant/resume'

  if (!isOpportunitiesSection && !isServiceHistorySection) return null

  return (
    <div className="skeuo-workspace-tabs border-t border-ink-100">
      <nav aria-label="Opportunities" className="flex flex-nowrap gap-1 overflow-x-auto px-5 md:px-8">
        {tabs.map((tab) => {
          const active = tab.href === '/participant/opportunities' ? isOpportunitiesSection : isServiceHistorySection
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={
                active
                  ? 'skeuo-tab skeuo-tab-active shrink-0 px-3 py-3 text-sm font-semibold text-brand-800'
                  : 'skeuo-tab shrink-0 px-3 py-3 text-sm font-semibold text-ink-500 hover:text-ink-800'
              }
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
