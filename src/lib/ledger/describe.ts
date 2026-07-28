import { db } from '@/lib/db/client'
import { orgs, tasks, offerings } from '@/lib/db/schema'

export type Lookups = {
  orgName: (id: unknown) => string
  taskTitle: (id: unknown) => string
  offeringTitle: (id: unknown) => string
  who: (id: unknown) => string
}

/** Resolve names for human-readable event descriptions (users stay pseudonymous). */
export async function buildLookups(): Promise<Lookups> {
  const allOrgs = await db.select({ id: orgs.id, name: orgs.name }).from(orgs)
  const allTasks = await db.select({ id: tasks.id, title: tasks.title }).from(tasks)
  const allOfferings = await db.select({ id: offerings.id, title: offerings.title }).from(offerings)

  const orgMap = new Map(allOrgs.map((o) => [o.id, o.name]))
  const taskMap = new Map(allTasks.map((t) => [t.id, t.title]))
  const offeringMap = new Map(allOfferings.map((o) => [o.id, o.title]))

  return {
    orgName: (id) => (typeof id === 'string' && orgMap.get(id)) || 'an organization',
    taskTitle: (id) => (typeof id === 'string' && taskMap.get(id)) || 'an opportunity',
    offeringTitle: (id) => (typeof id === 'string' && offeringMap.get(id)) || 'an offering',
    who: (id) => (typeof id === 'string' ? `member ${id.slice(0, 8)}` : 'someone'),
  }
}

/** Turn a ledger event into a plain-English sentence. */
export function describeEvent(type: string, payloadJson: string, actorId: string | null, l: Lookups): string {
  let p: Record<string, unknown> = {}
  try {
    p = JSON.parse(payloadJson)
  } catch {
    /* tolerate */
  }

  switch (type) {
    case 'IDENTITY_CREATED':
      return p.orgId
        ? `Organization identity created for ${l.orgName(p.orgId)}.`
        : `New identity created for ${l.who(p.userId)}.`
    case 'USER_REGISTERED':
      return `New ${String(p.role ?? 'user')} account registered (${l.who(p.userId)}).`
    case 'ORG_REGISTERED':
      return `${l.orgName(p.orgId)} registered as ${String(p.orgType ?? 'an')} organization.`
    case 'ORG_APPROVED':
      return p.sandbox
        ? `${l.orgName(p.orgId)} auto-approved (sandbox mode).`
        : `${l.orgName(p.orgId)} approved by the network administrator.`
    case 'ORG_SUSPENDED':
      return `${l.orgName(p.orgId)} was suspended.`
    case 'ORG_PROFILE_UPDATED':
      return `${l.orgName(p.orgId)} updated its organizational identity.`
    case 'CITY_LAUNCH_REQUESTED':
      return `${l.orgName(p.orgId)} requested a City/Sync network for ${String(p.cityName ?? 'a new city')}.`
    case 'CITY_LAUNCH_APPROVED':
      return `${l.orgName(p.orgId)}’s City/Sync network for ${String(p.cityName ?? 'a new city')} was approved and provisioned.`
    case 'CITY_LAUNCH_REJECTED':
      return `${l.orgName(p.orgId)}’s City/Sync network request was not approved.`
    case 'CITY_LAUNCH_OWNER_ASSIGNED':
      return `Ownership of ${l.orgName(p.orgId)} in ${String(p.cityName ?? 'its city')} was assigned to ${l.who(p.ownerUserId)}.`
    case 'ORG_AUTHORITY_GRANTED':
      return `${l.orgName(p.orgId)} authorized ${l.who(p.userId)} to act for the organization.`
    case 'ORG_AUTHORITY_REVOKED':
      return `${l.orgName(p.orgId)} revoked an authorized account.`
    case 'ORG_INVITE_CREATED':
      return `${l.orgName(p.orgId)} created an invitation for the ${String(p.roleName ?? 'selected')} role.`
    case 'ORG_INVITE_ACCEPTED':
      return `${l.who(p.userId)} accepted an invitation to ${l.orgName(p.orgId)}.`
    case 'ORG_ROLE_CREATED':
      return `${l.orgName(p.orgId)} created the “${String(p.roleName ?? 'Unnamed')}” role.`
    case 'ORG_ROLE_UPDATED':
      return `${l.orgName(p.orgId)} updated the “${String(p.roleName ?? 'Unnamed')}” role.`
    case 'CATALOG_ENTRY_SUBMITTED':
      return `${l.orgName(p.orgId)} submitted an opportunity catalog entry for review.`
    case 'CATALOG_ENTRY_APPROVED':
      return `${l.orgName(p.orgId)} had an opportunity catalog entry approved.`
    case 'CATALOG_ENTRY_REJECTED':
      return `${l.orgName(p.orgId)} had an opportunity catalog entry rejected.`
    case 'CATALOG_ENTRY_CHANGES_REQUESTED':
      return `${l.orgName(p.orgId)} received requested changes on an opportunity catalog entry.`
    case 'WAIVER_VERSION_CREATED':
      return `${l.orgName(p.orgId)} published liability waiver v${String(p.version ?? '?')} (hash ${String(p.sha256 ?? '').slice(0, 12)}…).`
    case 'WAIVER_ACCEPTED':
      return `${l.who(actorId)} accepted ${l.orgName(p.orgId)}'s waiver v${String(p.version ?? '?')} against hash ${String(p.sha256 ?? '').slice(0, 12)}…`
    case 'TASK_CREATED':
      return `${l.orgName(p.orgId)} published “${String(p.title ?? l.taskTitle(p.taskId))}” — ${String(p.credits ?? '?')} credits, ${String(p.slots ?? '?')} slot(s).`
    case 'TASK_CLOSED':
      return `“${l.taskTitle(p.taskId)}” was closed.`
    case 'TASK_REOPENED':
      return `“${l.taskTitle(p.taskId)}” was reopened.`
    case 'SHIFT_CREATED':
      return `A new shift was created for “${l.taskTitle(p.taskId)}”.`
    case 'SHIFT_CLOSED':
      return `A shift for “${l.taskTitle(p.taskId)}” was closed.`
    case 'TASK_CLAIMED':
      return `${l.who(actorId)} claimed “${l.taskTitle(p.taskId)}”.`
    case 'CLAIM_UNCLAIMED':
      return `${l.who(actorId)} withdrew their claim on “${l.taskTitle(p.taskId)}”.`
    case 'COMPLETION_SUBMITTED':
      return `${l.who(actorId)} submitted completion of “${l.taskTitle(p.taskId)}” for verification.`
    case 'COMPLETION_VERIFIED':
      return `Completion of “${l.taskTitle(p.taskId)}” verified — ${String(p.credits ?? '?')} credits to ${l.who(p.participantId)}.`
    case 'COMPLETION_REJECTED':
      return `Completion of “${l.taskTitle(p.taskId)}” was rejected.`
    case 'CLAIM_CHECKED_IN':
      return `${l.who(actorId)} was checked in for “${l.taskTitle(p.taskId)}”.`
    case 'CLAIM_NO_SHOW':
      return `${l.who(p.userId)} was marked as a no-show for “${l.taskTitle(p.taskId)}”.`
    case 'CREDITS_MINTED':
      return `⬆ ${String(p.amount ?? '?')} civic credits minted to ${l.who(p.userId)} (${String(p.reason ?? '')}).`
    case 'CREDITS_BURNED':
      return `⬇ ${String(p.amount ?? '?')} civic credits burned from ${l.who(p.userId)} (${String(p.reason ?? '')}).`
    case 'OFFERING_CREATED':
      return `${l.orgName(p.orgId)} listed “${String(p.title ?? l.offeringTitle(p.offeringId))}” for ${String(p.cost ?? '?')} credits.`
    case 'OFFERING_UPDATED':
      return `“${l.offeringTitle(p.offeringId)}” was ${p.active ? 'activated' : 'deactivated'}.`
    case 'REDEMPTION_REQUESTED':
      return `${l.who(actorId)} requested redemption of “${l.offeringTitle(p.offeringId)}” (${String(p.cost ?? '?')} credits) at ${l.orgName(p.orgId)}.`
    case 'REDEMPTION_FINALIZED':
      return `Redemption of “${l.offeringTitle(p.offeringId)}” finalized — ${String(p.cost ?? '?')} credits extinguished.`
    case 'REDEMPTION_CANCELLED':
      return `A pending redemption was cancelled.`
    case 'ANCHOR_CREATED':
      return `Anchor committed: Merkle root over events ${String(p.fromSeq)}–${String(p.toSeq)} (${String(p.eventCount)} events) on ${String(p.network)}.`
    case 'POST_CREATED':
      return `${l.orgName(p.orgId)} posted to the MyCity Feed.`
    case 'POST_HEARTED':
      return `${l.who(actorId)} hearted a MyCity post.`
    case 'POST_UNHEARTED':
      return `${l.who(actorId)} removed their heart from a MyCity post.`
    case 'MESSAGE_SENT':
      return `${l.orgName(p.orgId)} messaged ${String(p.recipientCount ?? '?')} volunteer(s): “${String(p.subject ?? '')}”.`
    case 'POST_REMOVED':
      return `An administrator removed a MyCity post by ${l.orgName(p.orgId)} (reason: ${String(p.reason ?? 'unspecified')}).`
    case 'USER_DISABLED':
      return `An administrator disabled the account of ${l.who(p.userId)}.`
    case 'USER_ENABLED':
      return `An administrator re-enabled the account of ${l.who(p.userId)}.`
    case 'USER_PASSWORD_RESET':
      return `An administrator reset the password for ${l.who(p.userId)}.`
    case 'CREDITS_ADJUSTED': {
      const amt = Number(p.amount ?? 0)
      return `Administrative adjustment: ${amt > 0 ? '+' : ''}${amt} credits for ${l.who(p.userId)} (reason: ${String(p.reason ?? '')}).`
    }
    default:
      return type
  }
}
