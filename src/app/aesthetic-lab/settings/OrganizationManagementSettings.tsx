import { Check, ChevronDown, Crown, KeyRound, Plus, ShieldCheck, UsersRound } from 'lucide-react'
import {
  createOrganizationInviteAction,
  createOrganizationRoleAction,
  revokeOrganizationDelegationAction,
  updateOrganizationRoleAction,
} from '@/app/actions'
import type { Session } from '@/lib/auth/session'
import { participantDisplayName } from '@/lib/participant-name'
import {
  activeSessionIsOrganizationOwner,
  listOrganizationDelegations,
  listOrganizationRoles,
  ORGANIZATION_PERMISSION_OPTIONS,
} from '@/lib/services/identity-access'
import { listOrganizationActivity } from '@/lib/services/organization-activity'
import type { OrgProfile } from '@/lib/services/profile'
import { IssuerActivityFeed } from '../issuer/IssuerActivityFeed'
import { IssuerInviteLink } from '../issuer/IssuerInviteLink'
import { IssuerOrganizationIdentityForm } from './IssuerOrganizationIdentityForm'
import styles from '../prototype.module.css'

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
          <input type="hidden" name="redirectTo" value="/aesthetic-lab/settings" />
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
            <input type="hidden" name="redirectTo" value="/aesthetic-lab/settings" />
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
        <input type="hidden" name="redirectTo" value="/aesthetic-lab/settings" />
        <label>Role name<input name="roleName" maxLength={50} required placeholder="e.g. Volunteer coordinator" /></label>
        <PermissionSelector />
        <div><button type="submit">Create role</button></div>
      </form>
    </details>
  )
}

export async function OrganizationManagementSettings({
  organization,
  profile,
  session,
  inviteCode,
  inviteRoleId,
}: {
  organization: { id: string; name: string; ownerUserId: string }
  profile: OrgProfile
  session: Session
  inviteCode?: string
  inviteRoleId?: string
}) {
  const [roles, delegations, isOwner, activity] = await Promise.all([
    listOrganizationRoles(organization.id),
    listOrganizationDelegations(organization.id),
    activeSessionIsOrganizationOwner(session),
    listOrganizationActivity(organization.id),
  ])
  const owner = delegations.find(({ delegation }) => delegation.userId === organization.ownerUserId)
    ?? delegations.find(({ delegation }) => delegation.role === 'owner')
  const members = delegations.filter(({ delegation }) => delegation.id !== owner?.delegation.id)

  return (
    <>
      {isOwner ? <IssuerOrganizationIdentityForm organizationId={organization.id} organizationName={organization.name} profile={profile} /> : (
        <section className={`${styles.labPanel} ${styles.labStack}`}>
          <div><p className={styles.eyebrow}>Organization identity</p><h2>{organization.name}</h2><p className={styles.waiverHelper}>Only an organization owner can change the organization name or primary email.</p></div>
        </section>
      )}

      <section id="staff-access" className={styles.manageOrganizationCard}>
        <div className={styles.manageSectionHeading}><div><p className={styles.eyebrow}>Staff access</p><h2>Who can operate this organization</h2><span>Every staff member has an accountable identity and access based on their assigned role.</span></div><UsersRound size={19} /></div>
        <div className={styles.managePeopleList}>
          {owner ? <article className={styles.managePerson}><span className={styles.managePersonAvatar}>{participantDisplayName(owner.user).slice(0, 2).toUpperCase()}</span><div><p><b>{participantDisplayName(owner.user)}</b><em>Organization owner</em></p><small>{owner.role?.name ?? 'Owner'} · All organizational powers</small></div><Crown size={16} /></article> : null}
          {members.map(({ delegation, user, role }) => {
            const memberPowers = role ? rolePermissions(role) : []
            return <details key={delegation.id} className={styles.managePersonDetails}>
              <summary><span className={styles.managePersonAvatar}>{participantDisplayName(user).slice(0, 2).toUpperCase()}</span><div><p><b>{participantDisplayName(user)}</b><em data-status={delegation.status}>{delegation.status}</em></p><small>{role?.name ?? delegation.role} · {memberPowers.length} functional power{memberPowers.length === 1 ? '' : 's'}</small></div><ChevronDown size={16} /></summary>
              <div><p><b>Role:</b> {role?.name ?? delegation.role}</p><ul>{memberPowers.map((permission) => <li key={permission.key}><Check size={13} /> {permission.label}</li>)}</ul>{isOwner && delegation.status === 'active' ? <form action={revokeOrganizationDelegationAction}><input type="hidden" name="redirectTo" value="/aesthetic-lab/settings" /><input type="hidden" name="delegationId" value={delegation.id} /><button type="submit">Revoke access</button></form> : null}</div>
            </details>
          })}
        </div>
      </section>

      <section className={styles.manageRolesSection}>
        <div className={styles.manageSectionHeading}><div><p className={styles.eyebrow}>Roles &amp; functional powers</p><h2>Build a team around real responsibilities.</h2><span>Changes to a role take effect for every active account assigned to it.</span></div><ShieldCheck size={19} /></div>
        <div className={styles.manageRoleGrid}>
          {roles.map((role) => <RoleCard key={role.id} role={role} canManage={isOwner} inviteCode={inviteRoleId === role.id ? inviteCode : undefined} />)}
          {isOwner ? <CreateRoleCard /> : null}
        </div>
      </section>

      <IssuerActivityFeed activity={activity} />
    </>
  )
}
