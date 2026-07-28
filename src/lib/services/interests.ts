import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { users, orgs, orgProfiles, tasks } from '@/lib/db/schema'
import { aggregateOpportunities, type PublicOpportunity } from './profile'
import { notifyOpportunityMatch } from './notifications'

function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const a = JSON.parse(raw)
    if (Array.isArray(a)) return a.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
  } catch {
    /* ignore */
  }
  return []
}

export async function getInterests(userId: string): Promise<string[]> {
  const u = (await db.select({ interests: users.interests }).from(users).where(eq(users.id, userId)).limit(1))[0]
  return parseTags(u?.interests)
}

export async function setInterests(userId: string, interests: string[]): Promise<void> {
  const clean = Array.from(new Set(interests.map((s) => s.trim()).filter(Boolean))).slice(0, 30)
  await db.update(users).set({ interests: JSON.stringify(clean) }).where(eq(users.id, userId))
}

export async function getNeighborhood(userId: string): Promise<string> {
  const u = (await db.select({ neighborhood: users.neighborhood }).from(users).where(eq(users.id, userId)).limit(1))[0]
  return u?.neighborhood ?? ''
}

export async function setNeighborhood(userId: string, neighborhood: string): Promise<void> {
  await db.update(users).set({ neighborhood: neighborhood.trim().slice(0, 80) }).where(eq(users.id, userId))
}

/** Distinct cause tags across approved issuer orgs — interest suggestions. */
export async function listAllCauses(): Promise<string[]> {
  const rows = await db
    .select({ causes: orgProfiles.causes })
    .from(orgProfiles)
    .innerJoin(orgs, eq(orgProfiles.orgId, orgs.id))
    .where(and(eq(orgs.type, 'issuer'), eq(orgs.status, 'approved')))
  const set = new Set<string>()
  for (const r of rows) for (const c of parseTags(r.causes)) set.add(c)
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}

export type RecommendedOpportunity = { card: PublicOpportunity; orgName: string; orgSlug: string }

/** Open-shift opportunities from orgs whose causes intersect the user's interests. */
export async function recommendedOpportunities(userId: string, cityId?: string): Promise<RecommendedOpportunity[]> {
  const interests = (await getInterests(userId)).map((s) => s.toLowerCase())
  if (interests.length === 0) return []

  const orgRows = await db
    .select({ org: orgs, causes: orgProfiles.causes })
    .from(orgs)
    .leftJoin(orgProfiles, eq(orgProfiles.orgId, orgs.id))
    .where(and(eq(orgs.type, 'issuer'), eq(orgs.status, 'approved')))

  const matched = orgRows.filter((r) => parseTags(r.causes).some((c) => interests.includes(c.toLowerCase())))
  if (matched.length === 0) return []
  const orgById = new Map(matched.map((r) => [r.org.id, r.org]))
  const matchedIds = matched.map((r) => r.org.id)

  const taskRows = await db
    .select()
    .from(tasks)
    .where(and(inArray(tasks.orgId, matchedIds), eq(tasks.status, 'open'), ...(cityId ? [eq(tasks.cityId, cityId)] : [])))
    .orderBy(desc(tasks.createdAt))
  const agg = await aggregateOpportunities(taskRows)

  const out: RecommendedOpportunity[] = []
  for (const t of taskRows) {
    const card = agg.get(t.id)
    if (card && card.openShiftCount > 0) {
      const org = orgById.get(t.orgId)
      out.push({ card, orgName: org?.name ?? '', orgSlug: org?.slug ?? '' })
    }
  }
  return out
}

/** On a new opportunity, alert participants whose interests match the org's causes. */
export async function notifyMatchingParticipants(taskId: string): Promise<number> {
  const task = (await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1))[0]
  if (!task) return 0
  const org = (await db.select().from(orgs).where(eq(orgs.id, task.orgId)).limit(1))[0]
  if (!org || org.type !== 'issuer' || org.status !== 'approved') return 0
  const profile = (
    await db.select({ causes: orgProfiles.causes }).from(orgProfiles).where(eq(orgProfiles.orgId, org.id)).limit(1)
  )[0]
  const causes = parseTags(profile?.causes).map((c) => c.toLowerCase())
  if (causes.length === 0) return 0

  const participants = await db
    .select({ id: users.id, interests: users.interests })
    .from(users)
    .where(eq(users.role, 'participant'))
  const matchedIds = participants
    .filter((p) => parseTags(p.interests).some((i) => causes.includes(i.toLowerCase())))
    .map((p) => p.id)
  if (matchedIds.length === 0) return 0

  await notifyOpportunityMatch(matchedIds, {
    taskId,
    title: `New opportunity: ${task.title}`,
    body: `${org.name} just posted an opportunity matching your interests.`,
    link: `/opportunities/${taskId}`,
  })
  return matchedIds.length
}
