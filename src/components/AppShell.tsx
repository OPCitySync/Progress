import type { ReactNode } from 'react'
import Link from 'next/link'
import { CirclePlus, HelpCircle, Settings2 } from 'lucide-react'
import { eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { Logo } from '@/components/brand/Logo'
import { SidebarNav, type NavItem } from '@/components/SidebarNav'
import { WorkspaceTabs } from '@/components/WorkspaceTabs'
import { IdentitySwitcher } from '@/components/IdentitySwitcher'
import { WorkspaceChrome } from '@/components/WorkspaceChrome'
import { ThemeToggle } from '@/components/ThemeToggle'
import { ParticipantAccountMenu } from '@/components/ParticipantAccountMenu'
import { signOutAction } from '@/app/actions'
import type { Session } from '@/lib/auth/session'
import { features, type Features } from '@/lib/config'
import { getParticipantOrganizations } from '@/lib/services/participant-workspace'
import { getActiveCity, getCityNetworks } from '@/lib/services/city-networks'
import { db } from '@/lib/db/client'
import { orgProfiles, orgs, users } from '@/lib/db/schema'
import { getActorContexts } from '@/lib/services/identity-access'
import { CITY_RAIL_COOKIE } from '@/lib/city-rail-preference'
import { THEME_COOKIE, type WorkspaceTheme } from '@/lib/theme-preference'

type NavDef = NavItem & { feature?: keyof Features }
type Navigation = { sidebar: NavDef[]; workspace: NavDef[] }

const navigationByRole: Record<Session['role'], Navigation> = {
  participant: {
    sidebar: [
      { href: '/participant', label: 'Home', icon: 'dashboard' },
      { href: '/workspace/orgs', label: 'Discover Orgs', icon: 'organizations' },
      { href: '/feed', label: 'MyCity Feed', icon: 'feed' },
      { href: '/workspace/ledger', label: 'Public Ledger', icon: 'ledger' },
    ],
    workspace: [
      { href: '/participant/opportunities', label: 'Opportunities', icon: 'opportunities' },
    ],
  },
  issuer: {
    sidebar: [
      { href: '/issuer', label: 'Overview', icon: 'dashboard' },
      { href: '/issuer/profile', label: 'Public Profile', icon: 'profile' },
      { href: '/feed', label: 'MyCity Feed', icon: 'feed' },
      { href: '/workspace/ledger', label: 'Public Ledger', icon: 'ledger' },
    ],
    workspace: [
      { href: '/issuer/catalog', label: 'Opportunity Catalog', icon: 'catalog', feature: 'catalog' },
      { href: '/issuer/volunteers', label: 'Volunteers', icon: 'volunteers' },
      { href: '/issuer/reports', label: 'Reports', icon: 'reports' },
      { href: '/issuer/waiver', label: 'Liability Waiver', icon: 'waiver' },
    ],
  },
  redeemer: {
    sidebar: [
      { href: '/redeemer', label: 'Overview', icon: 'dashboard' },
      { href: '/workspace/orgs', label: 'Discover Orgs', icon: 'organizations' },
      { href: '/feed', label: 'MyCity Feed', icon: 'feed' },
      { href: '/workspace/ledger', label: 'Public Ledger', icon: 'ledger' },
    ],
    workspace: [],
  },
  admin: {
    sidebar: [
      { href: '/admin', label: 'Organizations', icon: 'organizations' },
      { href: '/admin/users', label: 'Users', icon: 'users' },
      { href: '/admin/catalog', label: 'Catalog Review', icon: 'catalog', feature: 'catalogApproval' },
      { href: '/admin/oversight', label: 'Oversight', icon: 'oversight' },
      { href: '/admin/reports', label: 'Reports', icon: 'reports' },
      { href: '/workspace/orgs', label: 'Discover Orgs', icon: 'organizations' },
      { href: '/admin/ledger', label: 'Ledger & Anchors', icon: 'ledger' },
      { href: '/feed', label: 'MyCity Feed', icon: 'feed' },
      { href: '/workspace/ledger', label: 'Public Ledger', icon: 'ledger' },
    ],
    workspace: [],
  },
}

const roleLabels: Record<Session['role'], string> = {
  participant: 'Civic Participant',
  issuer: 'Issuer Organization',
  redeemer: 'Redeemer Organization',
  admin: 'Network Administrator',
}

/** The shared signed-in workspace: city rail, navigation rail, and context tabs. */
export async function AppShell({
  session,
  children,
  topRail,
}: {
  session: Session
  children: ReactNode
  /** Page-specific controls that belong in the shared main-content header. */
  topRail?: ReactNode
}) {
  const f = features()
  const navigation = navigationByRole[session.role]
  const sidebarItems = navigation.sidebar.filter((n) => !n.feature || f[n.feature])
  const workspaceItems = navigation.workspace.filter((n) => !n.feature || f[n.feature])
  const [organizations, cities, activeCity, organization, account, actorContexts] = await Promise.all([
    session.role === 'participant' ? getParticipantOrganizations(session.sub) : Promise.resolve([]),
    getCityNetworks(session),
    getActiveCity(session),
    session.orgId
      ? db
          .select({ name: orgs.name, contactEmail: orgProfiles.contactEmail, logoUrl: orgProfiles.logoUrl })
          .from(orgs)
          .leftJoin(orgProfiles, eq(orgProfiles.orgId, orgs.id))
          .where(eq(orgs.id, session.orgId))
          .limit(1)
      : Promise.resolve([]),
    db.select({ avatarUrl: users.avatarUrl }).from(users).where(eq(users.id, session.sub)).limit(1),
    session.role === 'admin' ? Promise.resolve([]) : getActorContexts(session.sub),
  ])
  const homeHref = sidebarItems[0].href
  const isParticipant = session.role === 'participant'
  const workspaceTitle = isParticipant ? session.name : organization[0]?.name ?? roleLabels[session.role]
  const currentCityName = isParticipant || session.role === 'admin' ? activeCity?.name ?? 'Choose a city' : null
  const railMembershipKind = session.orgId && session.role !== 'participant' ? 'organization' : 'user'
  const railCities = cities.filter((city) => city.memberKinds.includes(railMembershipKind))
  const isIssuerOrganization = session.role === 'issuer' && Boolean(organization[0])
  const railIdentityName = isIssuerOrganization ? organization[0]?.name ?? session.name : session.name
  const railIdentityEmail = isIssuerOrganization ? organization[0]?.contactEmail || 'No organizational email' : session.email
  const railAvatarUrl = isIssuerOrganization ? organization[0]?.logoUrl ?? '' : account[0]?.avatarUrl ?? ''
  const initialCityRailCollapsed = cookies().get(CITY_RAIL_COOKIE)?.value === 'true'
  const initialTheme: WorkspaceTheme = cookies().get(THEME_COOKIE)?.value === 'dark' ? 'dark' : 'light'

  const sidebar = (
    <>
        <div className="flex items-center justify-between gap-3 px-2">
          <Logo variant="light" size={25} href={homeHref} />
          {!isParticipant ? (
            <form action={signOutAction}>
              <button className="whitespace-nowrap text-xs font-semibold text-white/50 transition-colors hover:text-white">Sign out →</button>
            </form>
          ) : null}
        </div>

        <div className="mt-7 px-1">
          <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">
            {roleLabels[session.role]}
          </p>
          {(session.role === 'issuer' || session.role === 'redeemer') && organization[0]?.name ? (
            <Link
              href={session.role === 'issuer' ? '/settings' : '/redeemer'}
              title="Manage organization access"
              className="mt-1 block truncate px-2 text-[10px] font-semibold tracking-[0.22em] text-white/90 transition-colors hover:text-gold-200"
            >
              {organization[0].name}
            </Link>
          ) : null}
          <div className="mt-2">
            <SidebarNav items={sidebarItems} />
          </div>
        </div>

        {session.role === 'participant' ? (
          <div className="mt-7 px-1">
            <div className="flex items-center justify-between px-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">Organizations</p>
              <Link href="/workspace/orgs" title="Discover organizations" className="text-gold-300 hover:text-gold-200">
                <CirclePlus size={16} />
              </Link>
            </div>
            {organizations.length === 0 ? (
              <div className="mt-2 rounded-xl border border-dashed border-white/10 px-3 py-3">
                <p className="text-xs leading-relaxed text-white/45">Complete an organization’s onboarding task to add it here.</p>
                <Link href="/workspace/orgs" className="mt-2 inline-block text-xs font-semibold text-gold-300 hover:text-gold-200">
                  Discover organizations →
                </Link>
              </div>
            ) : (
              <div className="mt-2 space-y-1">
                {organizations.map((org) => (
                  <Link
                    key={org.id}
                    href={org.slug ? `/orgs/${org.slug}` : '/orgs'}
                    className="block rounded-xl px-3 py-2.5 transition-colors hover:bg-white/5"
                  >
                    <p className="truncate text-sm font-semibold text-white/80">{org.name}</p>
                    <p className="mt-0.5 truncate text-xs text-white/40">{org.onboardingTask}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {!isParticipant ? (
          <div className="mt-auto border-t border-white/10 pt-4">
            <div className="mb-4 flex items-center justify-between px-2 text-white/40">
              <div className="flex items-center gap-3">
                <Link href="/workspace/ledger" title="Public ledger" className="transition-colors hover:text-white">
                  <HelpCircle size={17} />
                </Link>
                <Link href="/settings" title="Account settings" className="transition-colors hover:text-white">
                  <Settings2 size={17} />
                </Link>
              </div>
              <ThemeToggle />
            </div>
            <div className="flex items-center gap-2 px-2">
              {railAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={railAvatarUrl} alt="" className="h-8 w-8 rounded-xl border border-white/15 object-cover" />
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-xs font-semibold text-white/80">
                  {railIdentityName.slice(0, 1).toUpperCase() || 'U'}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white/80">{railIdentityName}</p>
                <p className="truncate text-xs text-white/40">{railIdentityEmail}</p>
              </div>
            </div>
            <IdentitySwitcher session={session} contexts={actorContexts} />
          </div>
        ) : null}
    </>
  )

  const header = (
    <>
          <div className="flex items-center justify-between gap-4 px-5 py-4 md:px-8">
            <p className="font-display text-xl font-semibold text-ink-900">
              {workspaceTitle}
              {currentCityName ? <span className="ml-2 text-sm font-medium text-ink-400">— {currentCityName}</span> : null}
            </p>
            {isParticipant ? (
              <ParticipantAccountMenu
                session={session}
                avatarUrl={account[0]?.avatarUrl ?? ''}
                cities={railCities}
                activeCityId={activeCity?.id}
                contexts={actorContexts}
              />
            ) : null}
          </div>
          {workspaceItems.length > 0 ? (
            <WorkspaceTabs items={workspaceItems} overviewHref={homeHref} overviewLabel={isParticipant ? 'Home' : 'Overview'} />
          ) : null}
          {topRail}
    </>
  )

  return (
    <WorkspaceChrome homeHref={homeHref} cities={railCities} activeCityId={activeCity?.id} initialCityRailCollapsed={initialCityRailCollapsed} initialTheme={initialTheme} cityRailEnabled={!isParticipant} sidebar={sidebar} header={header}>
      {children}
    </WorkspaceChrome>
  )
}
