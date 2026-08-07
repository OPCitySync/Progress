'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/participant', label: 'Home' },
  { href: '/participant/resume', label: 'Service History' },
]

/** The focused top rail shared by the participant Home and Service History views. */
export function ParticipantHomeTabs() {
  const pathname = usePathname()
  const isHomeSection = pathname === '/participant'
  const isServiceHistorySection = pathname === '/participant/resume'

  if (!isHomeSection && !isServiceHistorySection) return null

  return (
    <div className="skeuo-workspace-tabs border-t border-ink-100">
      <nav aria-label="Home" className="flex flex-nowrap gap-1 overflow-x-auto px-5 md:px-8">
        {tabs.map((tab) => {
          const active = tab.href === '/participant' ? isHomeSection : isServiceHistorySection
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
