'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { NavItem } from '@/components/SidebarNav'

export function WorkspaceTabs({ items, overviewHref, overviewLabel = 'Overview' }: { items: NavItem[]; overviewHref: string; overviewLabel?: string }) {
  const pathname = usePathname()
  const isWorkspaceRoute = items.some(
    (item) => pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/')),
  )
  if (pathname !== overviewHref && !isWorkspaceRoute) return null

  return (
    <div className="skeuo-workspace-tabs border-t border-ink-100">
      <nav
        aria-label="Workspace functions"
        className="flex flex-nowrap gap-1 overflow-x-auto px-5 md:px-8"
      >
        {[{ href: overviewHref, label: overviewLabel }, ...items].map((item) => {
          // The overview tab represents only the landing page. Unlike the
          // other workspace tabs, it must not remain active for every nested
          // route beneath /issuer or /participant.
          const active =
            item.href === overviewHref
              ? pathname === overviewHref
              : pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                active
                  ? 'skeuo-tab skeuo-tab-active shrink-0 px-3 py-3 text-sm font-semibold text-brand-800'
                  : 'skeuo-tab shrink-0 px-3 py-3 text-sm font-semibold text-ink-500 hover:text-ink-800'
              }
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
