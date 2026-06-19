import { and, asc, desc, eq, inArray, like, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { orgs, orgProfiles, tasks, shifts, claims } from '@/lib/db/schema'
import { appendEvent } from '@/lib/ledger/ledger'
import { EventTypes } from '@/lib/ledger/events'
import type { Result } from '@/lib/services/identity'

export type OrgProfile = {
  orgId: string
  tagline: string
  mission: string
  logoUrl: string
  coverUrl: string
  website: string
  contactEmail: string
  phone: string
  location: string
  socials: Record<string, string>
  causes: string[]
  onboardingTaskId: string | null
  published: boolean
  updatedAt: number | null
}

export type OrgRow = typeof orgs.$inferSelect
type ProfileRow = typeof orgProfiles.$inferSelect

function jsonObject(raw: string): Record<string, string> {
  try {
    const o = JSON.parse(raw)
    if (o && typeof o === 'object' && !Array.isArray(o)) {
      const out: Record<string, string> = {}
      for (const [k, v] of Object.entries(o)) if (typeof v === 'string' && v.trim()) out[k] = v
      return out
    }
  } catch {
    /* ignore */
  }
  return {}
}

function jsonStringArray(raw: string): string[] {
  try {
    const a = JSON.parse(raw)
    if (Array.isArray(a)) return a.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
  } catch {
    /* ignore */
  }
  return []
}

function rowToProfile(row: ProfileRow): OrgProfile {
  return {
    orgId: row.orgId,
    tagline: row.tagline,
    mission: row.mission,
    logoUrl: row.logoUrl,
    coverUrl: row.coverUrl,
    website: row.website,
    contactEmail: row.contactEmail,
    phone: row.phone,
    location: row.location,
    socials: jsonObject(row.socials),
    causes: jsonStringArray(row.causes),
    onboardingTaskId: row.onboardingTaskId,
    published: row.published === 1,
    updatedAt: row.updatedAt,
  }
}

/** Raw profile row for an org, or null if none has been saved yet. */
export async function getProfile(orgId: string): Promise<OrgProfile | null> {
  const row = (await db.select().from(orgProfiles).where(eq(orgProfiles.orgId, orgId)).limit(1))[0]
  return row ? rowToProfile(row) : null
}

/** Profile for the issuer editor: the saved one, or an empty default scaffold. */
export async function getEditorProfile(org: OrgRow): Promise<OrgProfile> {
  const existing = await getProfile(org.id)
  if (existing) return existing
  return {
    orgId: org.id,
    tagline: '',
    mission: org.description ?? '',
    logoUrl: '',
    coverUrl: '',
    website: '',
    contactEmail: '',
    phone: '',
    location: '',
    socials: {},
    causes: [],
    onboardingTaskId: null,
    published: false,
    updatedAt: null,
  }
}

export async function saveProfile(input: {
  orgId: string
  actorId: string
  tagline: string
  mission: string
  logoUrl: string
  coverUrl: string
  website: string
  contactEmail: string
  phone: string
  location: string
  socials: Record<string, string>
  causes: string[]
  onboardingTaskId: string | null
  published: boolean
}): Promise<Result> {
  const org = (await db.select().from(orgs).where(eq(orgs.id, input.orgId)).limit(1))[0]
  if (!org || org.type !== 'issuer') {
    return { ok: false, error: 'Only issuer organizations have public profiles.' }
  }

  // Only accept an onboarding task that belongs to this org.
  let onboardingTaskId: string | null = null
  if (input.onboardingTaskId) {
    const t = (await db.select({ orgId: tasks.orgId }).from(tasks).where(eq(tasks.id, input.onboardingTaskId)).limit(1))[0]
    if (t && t.orgId === input.orgId) onboardingTaskId = input.onboardingTaskId
  }

  const now = Date.now()
  const values = {
    orgId: input.orgId,
    tagline: input.tagline.trim(),
    mission: input.mission.trim(),
    logoUrl: input.logoUrl.trim(),
    coverUrl: input.coverUrl.trim(),
    website: input.website.trim(),
    contactEmail: input.contactEmail.trim(),
    phone: input.phone.trim(),
    location: input.location.trim(),
    socials: JSON.stringify(input.socials ?? {}),
    causes: JSON.stringify(input.causes ?? []),
    onboardingTaskId,
    published: input.published ? 1 : 0,
    updatedAt: now,
  }

  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ orgId: orgProfiles.orgId })
      .from(orgProfiles)
      .where(eq(orgProfiles.orgId, input.orgId))
      .limit(1)
    if (existing.length > 0) {
      const { orgId: _omit, ...update } = values
      await tx.update(orgProfiles).set(update).where(eq(orgProfiles.orgId, input.orgId))
    } else {
      await tx.insert(orgProfiles).values(values)
    }
    // Editorial audit event — no financial meaning, never replayed on-chain.
    await appendEvent(
      tx,
      EventTypes.ORG_PROFILE_UPDATED,
      { orgId: input.orgId, published: input.published },
      input.actorId,
    )
  })

  return { ok: true }
}

export type PublicOpportunity = {
  id: string
  title: string
  description: string
  location: string
  credits: number
  status: 'open' | 'closed'
  openShiftCount: number
  totalOpenSlots: number
  nextShiftAt: number | null
  nextShiftLabel: string
}

const ACTIVE = ['claimed', 'submitted', 'verified'] as const
type TaskRow = typeof tasks.$inferSelect
type ShiftRow = typeof shifts.$inferSelect

/** Build opportunity cards with open-shift aggregates for the given tasks. */
export async function aggregateOpportunities(taskRows: TaskRow[]): Promise<Map<string, PublicOpportunity>> {
  const out = new Map<string, PublicOpportunity>()
  if (taskRows.length === 0) return out
  const ids = taskRows.map((t) => t.id)

  const openShifts = await db
    .select()
    .from(shifts)
    .where(and(inArray(shifts.taskId, ids), eq(shifts.status, 'open')))
    .orderBy(asc(shifts.startsAt), asc(shifts.createdAt))

  const counts = await db
    .select({ shiftId: claims.shiftId, n: sql<number>`count(*)` })
    .from(claims)
    .where(and(inArray(claims.taskId, ids), inArray(claims.status, [...ACTIVE])))
    .groupBy(claims.shiftId)
  const taken = new Map(counts.map((c) => [c.shiftId, Number(c.n)]))

  const byTask = new Map<string, ShiftRow[]>()
  for (const s of openShifts) {
    const arr = byTask.get(s.taskId) ?? []
    arr.push(s)
    byTask.set(s.taskId, arr)
  }

  for (const t of taskRows) {
    const sh = byTask.get(t.id) ?? []
    const totalOpenSlots = sh.reduce((sum, s) => sum + Math.max(0, s.capacity - (taken.get(s.id) ?? 0)), 0)
    const next = sh[0] // ordered by startsAt asc, createdAt asc
    out.set(t.id, {
      id: t.id,
      title: t.title,
      description: t.description,
      location: t.location,
      credits: t.credits,
      status: t.status,
      openShiftCount: sh.length,
      totalOpenSlots,
      nextShiftAt: next?.startsAt ?? null,
      nextShiftLabel: next?.label ?? '',
    })
  }
  return out
}

/** Open opportunities for an org that have at least one open shift to join. */
export async function getOpenOpportunities(
  orgId: string,
  opts: { excludeTaskId?: string | null; limit?: number } = {},
): Promise<PublicOpportunity[]> {
  const rows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.orgId, orgId), eq(tasks.status, 'open')))
    .orderBy(desc(tasks.createdAt))

  const filtered = opts.excludeTaskId ? rows.filter((t) => t.id !== opts.excludeTaskId) : rows
  const agg = await aggregateOpportunities(filtered)
  const cards = filtered
    .map((t) => agg.get(t.id)!)
    .filter((c) => c.openShiftCount > 0)
    .sort((a, b) => {
      if (a.nextShiftAt == null && b.nextShiftAt == null) return 0
      if (a.nextShiftAt == null) return 1
      if (b.nextShiftAt == null) return -1
      return a.nextShiftAt - b.nextShiftAt
    })
  return opts.limit && opts.limit > 0 ? cards.slice(0, opts.limit) : cards
}

/** A single opportunity card (returned whenever the task belongs to the org). */
export async function getOpportunityCard(taskId: string, orgId: string): Promise<PublicOpportunity | null> {
  const t = (await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.orgId, orgId))).limit(1))[0]
  if (!t) return null
  const agg = await aggregateOpportunities([t])
  return agg.get(t.id) ?? null
}

/** Map of taskId -> this viewer's claim status, for the given tasks. */
export async function getViewerClaims(userId: string, taskIds: string[]): Promise<Map<string, string>> {
  if (taskIds.length === 0) return new Map()
  const rows = await db
    .select({ taskId: claims.taskId, status: claims.status })
    .from(claims)
    .where(and(eq(claims.userId, userId), inArray(claims.taskId, taskIds)))
  return new Map(rows.map((r) => [r.taskId, r.status]))
}

/** The org's tasks for the onboarding-task dropdown in the editor. */
export async function getOrgTasksForSelect(orgId: string): Promise<{ id: string; title: string; status: string }[]> {
  return db
    .select({ id: tasks.id, title: tasks.title, status: tasks.status })
    .from(tasks)
    .where(eq(tasks.orgId, orgId))
    .orderBy(desc(tasks.createdAt))
}

export type OrgImpact = {
  volunteers: number
  creditsMinted: number
  verifiedCompletions: number
  openOpportunities: number
}

export async function getOrgImpact(orgId: string): Promise<OrgImpact> {
  const [verified] = await db
    .select({
      volunteers: sql<number>`count(distinct ${claims.userId})`,
      completions: sql<number>`count(*)`,
      credits: sql<number>`coalesce(sum(${tasks.credits}), 0)`,
    })
    .from(claims)
    .innerJoin(tasks, eq(claims.taskId, tasks.id))
    .where(and(eq(tasks.orgId, orgId), eq(claims.status, 'verified')))

  const [open] = await db
    .select({ n: sql<number>`count(*)` })
    .from(tasks)
    .where(and(eq(tasks.orgId, orgId), eq(tasks.status, 'open')))

  return {
    volunteers: Number(verified?.volunteers ?? 0),
    creditsMinted: Number(verified?.credits ?? 0),
    verifiedCompletions: Number(verified?.completions ?? 0),
    openOpportunities: Number(open?.n ?? 0),
  }
}

export type PublicProfile = {
  org: OrgRow
  profile: OrgProfile | null
  /** Whether the org has published a profile (vs. the default fallback view). */
  published: boolean
}

/** Public profile for an approved issuer org, or null (404) otherwise. */
export async function getPublicProfileBySlug(slug: string): Promise<PublicProfile | null> {
  const org = (
    await db
      .select()
      .from(orgs)
      .where(and(eq(orgs.slug, slug), eq(orgs.type, 'issuer'), eq(orgs.status, 'approved')))
      .limit(1)
  )[0]
  if (!org) return null
  const profile = await getProfile(org.id)
  return { org, profile, published: !!profile && profile.published }
}

export type DirectoryEntry = {
  org: OrgRow
  tagline: string
  logoUrl: string
  causes: string[]
  openCount: number
}

/** Approved issuer orgs for the public directory, with open-opportunity counts. */
export async function listPublicIssuers(opts: { search?: string; cause?: string } = {}): Promise<DirectoryEntry[]> {
  const search = opts.search?.trim()
  const conds = [eq(orgs.type, 'issuer'), eq(orgs.status, 'approved')]
  if (search) {
    const q = `%${search.toLowerCase()}%`
    conds.push(or(like(sql`lower(${orgs.name})`, q), like(sql`lower(${orgs.description})`, q))!)
  }

  const rows = await db
    .select({ org: orgs, profile: orgProfiles })
    .from(orgs)
    .leftJoin(orgProfiles, eq(orgProfiles.orgId, orgs.id))
    .where(and(...conds))
    .orderBy(desc(orgs.createdAt))

  const openCounts = await db
    .select({ orgId: tasks.orgId, n: sql<number>`count(*)` })
    .from(tasks)
    .where(eq(tasks.status, 'open'))
    .groupBy(tasks.orgId)
  const openByOrg = new Map(openCounts.map((c) => [c.orgId, Number(c.n)]))

  let entries: DirectoryEntry[] = rows.map(({ org, profile }) => ({
    org,
    tagline: profile?.tagline ?? '',
    logoUrl: profile?.logoUrl ?? '',
    causes: profile ? jsonStringArray(profile.causes) : [],
    openCount: openByOrg.get(org.id) ?? 0,
  }))

  if (opts.cause) {
    entries = entries.filter((e) => e.causes.includes(opts.cause!))
  }
  return entries
}
