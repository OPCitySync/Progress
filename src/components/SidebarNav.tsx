'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import {
  Award,
  BarChart3,
  BookOpenCheck,
  Building2,
  ClipboardList,
  Compass,
  FileText,
  Heart,
  LayoutDashboard,
  ReceiptText,
  Scale,
  ScrollText,
  ShieldCheck,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'

export type NavIcon =
  | 'dashboard'
  | 'opportunities'
  | 'interests'
  | 'resume'
  | 'organizations'
  | 'redeem'
  | 'feed'
  | 'ledger'
  | 'catalog'
  | 'profile'
  | 'volunteers'
  | 'reports'
  | 'waiver'
  | 'users'
  | 'oversight'

export type NavItem = { href: string; label: string; icon: NavIcon }

const icons: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  opportunities: ClipboardList,
  interests: Heart,
  resume: Award,
  organizations: Building2,
  redeem: ReceiptText,
  feed: BookOpenCheck,
  ledger: ScrollText,
  catalog: Compass,
  profile: FileText,
  volunteers: UsersRound,
  reports: BarChart3,
  waiver: ShieldCheck,
  users: UsersRound,
  oversight: Scale,
}

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname()
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const isLandingPage = item.href === '/participant' || item.href === '/issuer' || item.href === '/redeemer' || item.href === '/admin'
        const active = isLandingPage ? pathname === item.href : pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'))
        const Icon = icons[item.icon]
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              'skeuo-nav-item flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium',
              active ? 'skeuo-nav-active text-white' : 'text-white/60 hover:text-white',
            )}
          >
            <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
