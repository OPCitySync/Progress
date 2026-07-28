import { ChevronDown, KeyRound, ShieldCheck, UsersRound } from 'lucide-react'
import { eq } from 'drizzle-orm'
import { AppShell } from '@/components/AppShell'
import { AccountSettingsForm } from '@/components/account/AccountSettingsForm'
import { InviteLinkDetails } from '@/components/organization/InviteLinkDetails'
import { OrganizationActivityLog } from '@/components/organization/OrganizationActivityLog'
import { OrganizationIdentityForm } from '@/components/organization/OrganizationIdentityForm'
import { CityLaunchLocations } from '@/components/organization/CityLaunchLocations'
import { OrganizationSettingsTabs, type OrganizationSettingsTab } from '@/components/organization/OrganizationSettingsTabs'
import { RoleNameEditor } from '@/components/organization/RoleNameEditor'
import { Badge, Button, Card, Flash, Input, Mono, PageHeader } from '@/components/ui'
import {
  activeSessionIsOrganizationOwner,
  listOrganizationDelegations,
  listOrganizationRoles,
  ORGANIZATION_PERMISSION_OPTIONS,
} from '@/lib/services/identity-access'
import { participantDisplayName } from '@/lib/participant-name'
import { listCityLaunchApplicationsForSponsor } from '@/lib/services/city-launch'
import {
  createOrganizationInviteAction,
  createOrganizationRoleAction,
  revokeOrganizationDelegationAction,
} from '@/app/actions'
import { requireSession } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { orgProfiles, orgs, users } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

type OrganizationRole = { id: string; tierNumber: number; name: string; permissions: string; isOwnerRole: number }

function permissionsFrom(value: string) {
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function powerLabels(permissions: string[]) {
  const all = permissions.includes('*')
  return ORGANIZATION_PERMISSION_OPTIONS.filter((permission) => all || permissions.includes(permission.key)).map((permission) => permission.label)
}

function PlainPowers({ permissions }: { permissions: string[] }) {
  const powers = powerLabels(permissions)
  return <p className="mt-1 text-sm leading-relaxed text-ink-600"><span className="font-semibold text-ink-700">Powers:</span> {powers.length ? powers.join(', ') : 'None assigned'}</p>
}

function RolePowerList({ permissions }: { permissions: string[] }) {
  const all = permissions.includes('*')
  const selected = ORGANIZATION_PERMISSION_OPTIONS.filter((permission) => all || permissions.includes(permission.key))
  const columns = [
    selected.filter((_, index) => index % 2 === 0),
    selected.filter((_, index) => index % 2 === 1),
  ]

  return selected.length ? (
    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
      {columns.map((column, index) => (
        <li key={index} className="space-y-2">
          <ul className="space-y-2">
            {column.map((permission) => (
              <li key={permission.key} className="flex gap-2 text-xs leading-relaxed text-ink-600">
                <span className="font-bold text-emerald-600">✓</span>
                <span><strong className="text-ink-700">{permission.label}.</strong> {permission.description}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  ) : <p className="mt-3 text-xs text-ink-500">No functional powers are assigned to this role.</p>
}

function PermissionCheckboxes({ assigned }: { assigned: string[] }) {
  const editablePermissions = ORGANIZATION_PERMISSION_OPTIONS.filter((permission) => !('ownerOnly' in permission && permission.ownerOnly))
  const columns = [
    editablePermissions.filter((_, index) => index % 2 === 0),
    editablePermissions.filter((_, index) => index % 2 === 1),
  ]

  return (
    <fieldset className="mt-4">
      <legend className="text-sm font-semibold text-ink-800">Functional Powers</legend>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 sm:gap-x-3">
        {columns.map((column, index) => (
          <div key={index} className="space-y-3">
            {column.map((permission) => (
              <label key={permission.key} className="flex gap-2 rounded-xl border border-ink-100 bg-ink-50/60 p-3 text-sm text-ink-700">
                <input type="checkbox" name="permission" value={permission.key} defaultChecked={assigned.includes(permission.key)} className="mt-0.5 h-4 w-4 rounded border-ink-300" />
                <span><strong>{permission.label}</strong><span className="mt-0.5 block text-xs leading-relaxed text-ink-500">{permission.description}</span></span>
              </label>
            ))}
          </div>
        ))}
      </div>
    </fieldset>
  )
}

function RoleInviteControl({ role, inviteCode }: { role: OrganizationRole; inviteCode?: string }) {
  return (
    <details open={Boolean(inviteCode)} className="group">
      <summary className="absolute right-6 top-6 flex cursor-pointer list-none items-center gap-2 rounded-xl px-1 py-1 text-sm font-semibold text-brand-700 hover:text-brand-600">
        <span className="inline-flex items-center gap-2"><KeyRound size={16} /> Invite New {role.name}</span>
        <ChevronDown size={17} className="text-ink-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-5 border-t border-ink-100 pt-4">
        <p className="text-sm text-ink-600">The invitee receives this role only for the city your organization is currently operating in.</p>
        <form action={createOrganizationInviteAction} className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="redirectTo" value="/settings?tab=permissions" />
          <input type="hidden" name="roleId" value={role.id} />
          <label className="min-w-44 text-sm font-semibold text-ink-700">Expires in
            <select name="expiresInDays" defaultValue="7" className="mt-1.5 block w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800">
              <option value="1">1 day</option><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option>
            </select>
          </label>
          <Button type="submit">Generate Link</Button>
        </form>
        {inviteCode ? (
          <details open className="mt-4 rounded-xl border border-gold-200 bg-gold-50/70 px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-ink-900">Invite Link<ChevronDown size={17} className="text-ink-400" /></summary>
            <InviteLinkDetails code={inviteCode} />
          </details>
        ) : null}
      </div>
    </details>
  )
}

function RoleEditor({
  role,
  canManage,
  inviteCode,
}: {
  role: OrganizationRole
  canManage: boolean
  inviteCode?: string
}) {
  const assigned = permissionsFrom(role.permissions)
  if (role.isOwnerRole) {
    return (
      <Card className={canManage ? 'relative' : undefined}>
        <div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-ink-900">{role.name}</p><Badge tone="gold">Owner</Badge></div>
        <p className="mt-1 text-sm text-ink-500">The organization creator retains every functional power.</p>
        <RolePowerList permissions={['*']} />
        {canManage ? <RoleInviteControl role={role} inviteCode={inviteCode} /> : null}
      </Card>
    )
  }

  if (!canManage) {
    return <Card><p className="font-semibold text-ink-900">{role.name}</p><RolePowerList permissions={assigned} /></Card>
  }

  return (
    <Card className="relative">
      <RoleNameEditor roleId={role.id} initialName={role.name} permissions={assigned} />
      <RolePowerList permissions={assigned} />
      <RoleInviteControl role={role} inviteCode={inviteCode} />
    </Card>
  )
}

function CreateRoleCard() {
  return (
    <Card className="border-dashed p-0">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-5">
          <p className="font-semibold text-ink-900">Create New Role</p>
          <ChevronDown size={18} className="text-ink-400 transition-transform group-open:rotate-180" />
        </summary>
        <form action={createOrganizationRoleAction} className="border-t border-ink-100 px-6 py-5">
          <input type="hidden" name="redirectTo" value="/settings?tab=permissions" />
          <label className="block max-w-md text-sm font-semibold text-ink-700" htmlFor="roleName">Role name
            <Input id="roleName" name="roleName" maxLength={50} required className="mt-1.5" />
          </label>
          <PermissionCheckboxes assigned={[]} />
          <div className="mt-5 flex justify-end"><Button type="submit">Create Role</Button></div>
        </form>
      </details>
    </Card>
  )
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string; invite?: string; inviteRole?: string; tab?: string }
}) {
  const session = await requireSession()
  const user = (await db.select().from(users).where(eq(users.id, session.sub)).limit(1))[0]
  if (!user) return null

  if (session.role !== 'issuer' || !session.orgId) {
    return (
      <AppShell session={session}>
        <PageHeader title="Account Settings" subtitle="Manage the information attached to your City/Sync account." />
        <Flash searchParams={searchParams} />
        <div className="max-w-3xl"><AccountSettingsForm initial={{ name: user.name, email: user.email, username: user.username, avatarUrl: user.avatarUrl }} /></div>
      </AppShell>
    )
  }

  const orgId = session.orgId
  const [organization, profile, roles, delegations, isOwner, cityLaunchApplications] = await Promise.all([
    db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1),
    db.select().from(orgProfiles).where(eq(orgProfiles.orgId, orgId)).limit(1),
    listOrganizationRoles(orgId),
    listOrganizationDelegations(orgId),
    activeSessionIsOrganizationOwner(session),
    listCityLaunchApplicationsForSponsor(orgId),
  ])
  const org = organization[0]
  if (!org) return null
  const activeTab: OrganizationSettingsTab =
    searchParams.tab === 'permissions' || searchParams.tab === 'activity' || searchParams.tab === 'locations' ? searchParams.tab : 'profile'
  const subtitleByTab: Record<OrganizationSettingsTab, string> = {
    profile: 'Manage the organizational identity shown throughout City/Sync.',
    permissions: 'Manage authorized accounts, roles, and each role’s functional powers.',
    activity: 'Review the auditable history of actions taken for this organization.',
    locations: 'Request City/Sync for another physical location and assign its local owner after approval.',
  }
  const owner = delegations.find(({ delegation }) => delegation.userId === org.ownerUserId)
    ?? delegations.find(({ delegation }) => delegation.role === 'owner')
  const members = delegations.filter(({ delegation }) => delegation.id !== owner?.delegation.id)

  return (
    <AppShell session={session} topRail={<OrganizationSettingsTabs activeTab={activeTab} />}>
      <PageHeader title="Organization Settings" subtitle={subtitleByTab[activeTab]} />
      <Flash searchParams={searchParams} />

      {activeTab === 'profile' ? (
        isOwner ? (
          <OrganizationIdentityForm initial={{ name: org.name, logoUrl: profile[0]?.logoUrl ?? '', contactEmail: profile[0]?.contactEmail ?? '' }} />
        ) : (
          <Card><p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Organizational Name</p><p className="mt-1 text-sm font-medium text-ink-900">{org.name}</p></Card>
        )
      ) : null}

      {activeTab === 'permissions' ? (
        <>
          <section>
            <div className="mb-3 flex items-center gap-2"><ShieldCheck size={20} className="text-gold-700" /><h2 className="font-display text-xl font-semibold text-ink-900">Owner</h2></div>
            {owner ? (
              <Card>
                <div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-ink-900">{participantDisplayName(owner.user)}</p><Badge tone="gold">Account creator</Badge></div>
                <p className="mt-2 text-sm text-ink-600">Account ID <Mono>{owner.user.id}</Mono></p>
                <p className="mt-1 text-sm leading-relaxed text-ink-600"><span className="font-semibold text-ink-700">Role:</span> {owner.role?.name ?? 'Owner'}</p>
                <PlainPowers permissions={owner.role ? permissionsFrom(owner.role.permissions) : ['*']} />
              </Card>
            ) : <Card><p className="text-sm text-ink-600">No owner delegation was found.</p></Card>}
          </section>

          <section className="mt-8">
            <div className="mb-3 flex items-center gap-2"><UsersRound size={20} className="text-brand-700" /><h2 className="font-display text-xl font-semibold text-ink-900">Delegated Accounts</h2></div>
            {members.length === 0 ? <Card><p className="text-sm text-ink-600">No delegated accounts yet. Create an invite from the role you want to assign.</p></Card> : (
              <div className="space-y-3">
                {members.map(({ delegation, user: member, role }) => {
                  const powers = role ? permissionsFrom(role.permissions) : permissionsFrom(delegation.capabilities)
                  return (
                    <Card key={delegation.id} className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-ink-900">{participantDisplayName(member)}</p><Badge tone={delegation.status === 'active' ? 'green' : 'gray'}>{delegation.status}</Badge></div>
                        <p className="mt-2 text-sm text-ink-600">Account ID <Mono>{member.id}</Mono></p>
                        <p className="mt-1 text-sm text-ink-600"><span className="font-semibold text-ink-700">Role:</span> {role?.name ?? delegation.role}</p>
                        <PlainPowers permissions={powers} />
                      </div>
                      {isOwner && delegation.status === 'active' ? <form action={revokeOrganizationDelegationAction}><input type="hidden" name="redirectTo" value="/settings?tab=permissions" /><input type="hidden" name="delegationId" value={delegation.id} /><Button type="submit" variant="danger">Revoke access</Button></form> : null}
                    </Card>
                  )
                })}
              </div>
            )}
          </section>

          <section className="mt-10">
            <div className="mb-3 flex items-center gap-2"><ShieldCheck size={20} className="text-brand-700" /><h2 className="font-display text-xl font-semibold text-ink-900">Roles &amp; Functional Powers</h2></div>
            <p className="mb-4 text-sm text-ink-600">Changing a role’s check marks immediately updates the powers of every delegated account assigned to it.</p>
            <div className="space-y-4">
              {roles.map((role) => <RoleEditor key={role.id} role={role} canManage={isOwner} inviteCode={searchParams.inviteRole === role.id ? searchParams.invite : undefined} />)}
              {isOwner ? <CreateRoleCard /> : null}
            </div>
          </section>
        </>
      ) : null}

      {activeTab === 'activity' ? (
        <section>
          <div className="mb-4 flex items-center gap-2"><ShieldCheck size={20} className="text-brand-700" /><h2 className="font-display text-xl font-semibold text-ink-900">Activity Log</h2></div>
          <OrganizationActivityLog orgId={org.id} />
        </section>
      ) : null}

      {activeTab === 'locations' ? (
        <CityLaunchLocations applications={cityLaunchApplications} canManage={isOwner} />
      ) : null}
    </AppShell>
  )
}
