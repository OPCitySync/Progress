import { eq } from 'drizzle-orm'
import { Check, ChevronDown, Crown, KeyRound, Plus, ShieldCheck, UsersRound } from 'lucide-react'
import {
  createOrganizationInviteAction,
  createOrganizationRoleAction,
  revokeOrganizationDelegationAction,
  updateOrganizationRoleAction,
} from '@/app/actions'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { orgs } from '@/lib/db/schema'
import { participantDisplayName } from '@/lib/participant-name'
import {
  activeSessionIsOrganizationOwner,
  listOrganizationDelegations,
  listOrganizationRoles,
  ORGANIZATION_PERMISSION_OPTIONS,
} from '@/lib/services/identity-access'
import { listOrganizationActivity } from '@/lib/services/organization-activity'
import { LabHeader } from '../../LabHeader'
import { getLabWorkspace } from '../../lab-workspace'
import { IssuerActivityFeed } from '../IssuerActivityFeed'
import { IssuerInviteLink } from '../IssuerInviteLink'
import { IssuerLabSidebar } from '../IssuerLabSidebar'
import styles from '../../prototype.module.css'

export const dynamic = 'force-dynamic'

type OrganizationRole = Awaited<ReturnType<typeof listOrganizationRoles>>[number]

function permissionsFrom(value: string) {
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : []
  } catch {
    return []
  }
}

function rolePermissions(role: OrganizationRole) {
  const permissions = role.isOwnerRole ? ['*'] : permissionsFrom(role.permissions)
  return ORGANIZATION_PERMISSION_OPTIONS.filter((permission) => permissions.includes('*') || permissions.includes(permission.key))
}

function PermissionList({ role }: { role: OrganizationRole }) {
  const permissions = rolePermissions(role)
  return permissions.length ? (
    <ul className={styles.managePowerList}>
      {permissions.map((permission) => <li key={permission.key}><Check size={13} /><span><b>{permission.label}</b><small>{permission.description}</small></span></li>)}
    </ul>
  ) : <p className={styles.manageEmptyPowers}>No functional powers are assigned to this role.</p>
}

function PermissionSelector({ assigned = [] }: { assigned?: string[] }) {
  return (
    <fieldset className={styles.managePermissionSelector}>
      <legend>Functional powers</legend>
      <p>Select what people assigned to this role can do in the organization workspace.</p>
      <div>
        {ORGANIZATION_PERMISSION_OPTIONS.filter((permission) => !('ownerOnly' in permission && permission.ownerOnly)).map((permission) => (
          <label key={permission.key}>
            <input type="checkbox" name="permission" value={permission.key} defaultChecked={assigned.includes(permission.key)} />
            <span><b>{permission.label}</b><small>{permission.description}</small></span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function RoleInviteControl({ role, inviteCode }: { role: OrganizationRole; inviteCode?: string }) {
  return (
    <details className={styles.manageInviteControl} open={Boolean(inviteCode)}>
      <summary><KeyRound size={15} /> Invite New {role.name}<ChevronDown size={15} /></summary>
      <div>
        <p>Invite a person to operate as <b>{role.name}</b> in your current City Network. They receive only the powers listed for this role. Staff access takes priority, so this person cannot also volunteer for your organization while their access is active.</p>
        <form action={createOrganizationInviteAction}>
          <input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer/manage" />
          <input type="hidden" name="roleId" value={role.id} />
          <label>Expires in
            <select name="expiresInDays" defaultValue="7">
              <option value="1">1 day</option>
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
            </select>
          </label>
          {role.isOwnerRole ? (
            <div className={styles.manageInviteOwnerWarning}>
              <b>Owner access</b>
              <span>This gives the recipient full control of the organization, including roles, invitations, and access removal.</span>
              <label><input type="checkbox" name="confirmOwnerRole" value="yes" required /> I understand this creates another organization owner.</label>
            </div>
          ) : null}
          <button type="submit">Generate link</button>
        </form>
        {inviteCode ? <IssuerInviteLink code={inviteCode} /> : null}
      </div>
    </details>
  )
}

function RoleCard({ role, canManage, inviteCode }: { role: OrganizationRole; canManage: boolean; inviteCode?: string }) {
  const assigned = permissionsFrom(role.permissions)
  return (
    <article className={`${styles.manageRoleCard} ${role.isOwnerRole ? styles.manageOwnerRole : ''}`}>
      <div className={styles.manageRoleHeading}>
        <div><span>{role.isOwnerRole ? <Crown size={15} /> : <ShieldCheck size={15} />}</span><div><p>{role.isOwnerRole ? 'Organization owner' : 'Active role'}</p><h3>{role.name}</h3></div></div>
        {canManage ? <RoleInviteControl role={role} inviteCode={inviteCode} /> : null}
      </div>
      <PermissionList role={role} />
      {!role.isOwnerRole && canManage ? (
        <details className={styles.manageRoleEditor}>
          <summary>Manage role <ChevronDown size={15} /></summary>
          <form action={updateOrganizationRoleAction}>
            <input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer/manage" />
            <input type="hidden" name="roleId" value={role.id} />
            <label>Role name<input name="roleName" defaultValue={role.name} maxLength={50} required /></label>
            <PermissionSelector assigned={assigned} />
            <div><button type="submit">Save role</button></div>
          </form>
        </details>
      ) : null}
    </article>
  )
}

function CreateRoleCard() {
  return (
    <details className={styles.manageCreateRole}>
      <summary><span><Plus size={17} /></span><div><p>Create a new role</p><small>Give people only the practical access they need.</small></div><ChevronDown size={17} /></summary>
      <form action={createOrganizationRoleAction}>
        <input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer/manage" />
        <label>Role name<input name="roleName" maxLength={50} required placeholder="e.g. Volunteer coordinator" /></label>
        <PermissionSelector />
        <div><button type="submit">Create role</button></div>
      </form>
    </details>
  )
}

export default async function ManageOrganizationLabPage({
  searchParams,
}: {
  searchParams: { invite?: string; inviteRole?: string }
}) {
  const session = await requireRole('issuer')
  const orgId = session.orgId!
  const { city, cities, contexts } = await getLabWorkspace(session)
  const [org, roles, delegations, isOwner, activity] = await Promise.all([
    db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1).then((rows) => rows[0] ?? null),
    listOrganizationRoles(orgId),
    listOrganizationDelegations(orgId),
    activeSessionIsOrganizationOwner(session),
    listOrganizationActivity(orgId),
  ])
  if (!org) return null

  const owner = delegations.find(({ delegation }) => delegation.userId === org.ownerUserId)
    ?? delegations.find(({ delegation }) => delegation.role === 'owner')
  const members = delegations.filter(({ delegation }) => delegation.id !== owner?.delegation.id)

  return (
    <main className={styles.app}>
      <LabHeader activeSection="issuer-utility" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
      <div className={styles.issuerLayout}>
        <IssuerLabSidebar organizationId={org.id} organizationName={org.name} cityName={city?.name} />
        <section className={styles.issuerMain} aria-label="Manage organization permissions">
          <section className={styles.issuerPageHero}>
            <div><p className={styles.eyebrow}>Manage organization</p></div>
            <span className={styles.issuerOrganizationId}><b>Organizational ID</b><code>{org.id}</code></span>
          </section>

          <section className={styles.manageOrganizationCard}>
            <div className={styles.manageSectionHeading}><div><p className={styles.eyebrow}>Organization access</p><h2>Who can operate this organization</h2><span>Every person has their own accountable organizational identity and can be removed at any time.</span></div><UsersRound size={19} /></div>
            <div className={styles.managePeopleList}>
              {owner ? <article className={styles.managePerson}><span className={styles.managePersonAvatar}>{participantDisplayName(owner.user).slice(0, 2).toUpperCase()}</span><div><p><b>{participantDisplayName(owner.user)}</b><em>Organization owner</em></p><small>{owner.role?.name ?? 'Owner'} · All organizational powers</small></div><Crown size={16} /></article> : null}
              {members.length ? members.map(({ delegation, user, role }) => {
                const memberPowers = role ? rolePermissions(role) : []
                return <details key={delegation.id} className={styles.managePersonDetails}>
                  <summary><span className={styles.managePersonAvatar}>{participantDisplayName(user).slice(0, 2).toUpperCase()}</span><div><p><b>{participantDisplayName(user)}</b><em data-status={delegation.status}>{delegation.status}</em></p><small>{role?.name ?? delegation.role} · {memberPowers.length} functional power{memberPowers.length === 1 ? '' : 's'}</small></div><ChevronDown size={16} /></summary>
                  <div><p><b>Role:</b> {role?.name ?? delegation.role}</p><ul>{memberPowers.map((permission) => <li key={permission.key}><Check size={13} /> {permission.label}</li>)}</ul>{isOwner && delegation.status === 'active' ? <form action={revokeOrganizationDelegationAction}><input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer/manage" /><input type="hidden" name="delegationId" value={delegation.id} /><button type="submit">Revoke access</button></form> : null}</div>
                </details>
              }) : null}
            </div>
          </section>

          <section className={styles.manageRolesSection}>
            <div className={styles.manageSectionHeading}><div><p className={styles.eyebrow}>Roles &amp; functional powers</p><h2>Build a team around real responsibilities.</h2><span>Changes to a role take effect for every active account assigned to it.</span></div><ShieldCheck size={19} /></div>
            <div className={styles.manageRoleGrid}>
              {roles.map((role) => <RoleCard key={role.id} role={role} canManage={isOwner} inviteCode={searchParams.inviteRole === role.id ? searchParams.invite : undefined} />)}
              {isOwner ? <CreateRoleCard /> : null}
            </div>
          </section>

          <IssuerActivityFeed activity={activity} />
        </section>
      </div>
    </main>
  )
}
