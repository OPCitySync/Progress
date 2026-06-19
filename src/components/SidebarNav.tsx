'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'

export type NavItem = { href: string; label: string }

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname()
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active =
          pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'))
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              'rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors',
              active ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white',
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
