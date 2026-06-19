import type { ReactNode } from 'react'
import { Logo } from '@/components/brand/Logo'
import { SidebarNav } from '@/components/SidebarNav'
import { signOutAction } from '@/app/actions'
import type { Session } from '@/lib/auth/session'
import { features, type Features } from '@/lib/config'

type NavDef = { href: string; label: string; feature?: keyof Features }

const navByRole: Record<Session['role'], NavDef[]> = {
  participant: [
    { href: '/participant', label: 'My Dashboard' },
    { href: '/participant/opportunities', label: 'Opportunities' },
    { href: '/participant/interests', label: 'My Interests' },
    { href: '/participant/resume', label: 'My Résumé' },
    { href: '/orgs', label: 'Discover Orgs' },
    { href: '/participant/redeem', label: 'Redeem Credits', feature: 'credits' },
    { href: '/feed', label: 'MyCity Feed' },
    { href: '/transparency', label: 'Public Ledger' },
  ],
  issuer: [
    { href: '/issuer', label: 'Dashboard' },
    { href: '/issuer/catalog', label: 'Opportunity Catalog', feature: 'catalog' },
    { href: '/issuer/profile', label: 'Public Profile' },
    { href: '/issuer/volunteers', label: 'Volunteers' },
    { href: '/issuer/reports', label: 'Reports' },
    { href: '/issuer/waiver', label: 'Liability Waiver' },
    { href: '/feed', label: 'MyCity Feed' },
    { href: '/transparency', label: 'Public Ledger' },
  ],
  redeemer: [
    { href: '/redeemer', label: 'Dashboard' },
    { href: '/orgs', label: 'Discover Orgs' },
    { href: '/feed', label: 'MyCity Feed' },
    { href: '/transparency', label: 'Public Ledger' },
  ],
  admin: [
    { href: '/admin', label: 'Organizations' },
    { href: '/admin/users', label: 'Users' },
    { href: '/admin/catalog', label: 'Catalog Review', feature: 'catalogApproval' },
    { href: '/admin/oversight', label: 'Oversight' },
    { href: '/admin/reports', label: 'Reports' },
    { href: '/orgs', label: 'Discover Orgs' },
    { href: '/admin/ledger', label: 'Ledger & Anchors' },
    { href: '/feed', label: 'MyCity Feed' },
    { href: '/transparency', label: 'Public Ledger' },
  ],
}

const roleLabels: Record<Session['role'], string> = {
  participant: 'Civic Participant',
  issuer: 'Issuer Organization',
  redeemer: 'Redeemer Organization',
  admin: 'Network Administrator',
}

export function AppShell({ session, children }: { session: Session; children: ReactNode }) {
  const f = features()
  const items = navByRole[session.role].filter((n) => !n.feature || f[n.feature])
  return (
    <div className="flex min-h-screen bg-ink-50">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col bg-brand-900 px-4 py-6 md:flex">
        <div className="px-2">
          <Logo variant="light" size={26} href={items[0].href} />
        </div>
        <p className="mt-2 px-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/40">
          {roleLabels[session.role]}
        </p>
        <div className="mt-8 flex-1">
          <SidebarNav items={items} />
        </div>
        <div className="border-t border-white/10 pt-4">
          <p className="truncate px-2 text-sm font-medium text-white/80">{session.name}</p>
          <p className="truncate px-2 text-xs text-white/40">{session.email}</p>
          <form action={signOutAction} className="mt-3 px-2">
            <button className="text-xs font-semibold text-white/50 hover:text-white">Sign out →</button>
          </form>
        </div>
      </aside>
      <main className="min-h-screen w-full px-5 py-8 md:ml-60 md:px-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  )
}
