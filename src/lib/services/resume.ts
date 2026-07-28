import { randomUUID } from 'crypto'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { users, orgs, tasks, shifts, claims } from '@/lib/db/schema'
import { participantDisplayName } from '@/lib/participant-name'

export type ResumeContribution = {
  org: string
  orgSlug: string | null
  opportunity: string
  when: number | null
  whenLabel: string
  hours: number | null
  credits: number
  verifiedAt: number
}

export type ResumeData = {
  name: string
  joinedAt: number
  totals: { contributions: number; hours: number; credits: number; organizations: number }
  contributions: ResumeContribution[]
  isPublic: boolean
  token: string | null
}

type UserRow = typeof users.$inferSelect

async function buildResume(u: UserRow): Promise<ResumeData> {
  const rows = await db
    .select({
      orgId: orgs.id,
      org: orgs.name,
      orgSlug: orgs.slug,
      opportunity: tasks.title,
      credits: tasks.credits,
      verifiedAt: claims.updatedAt,
      sStart: shifts.startsAt,
      sEnd: shifts.endsAt,
      sLabel: shifts.label,
    })
    .from(claims)
    .innerJoin(tasks, eq(claims.taskId, tasks.id))
    .innerJoin(orgs, eq(tasks.orgId, orgs.id))
    .leftJoin(shifts, eq(claims.shiftId, shifts.id))
    .where(and(eq(claims.userId, u.id), eq(claims.status, 'verified')))
    .orderBy(desc(claims.updatedAt))

  let hours = 0
  let credits = 0
  const orgSet = new Set<string>()
  const contributions: ResumeContribution[] = rows.map((r) => {
    const h = r.sStart && r.sEnd && r.sEnd > r.sStart ? (r.sEnd - r.sStart) / 3_600_000 : null
    if (h) hours += h
    credits += r.credits
    orgSet.add(r.orgId)
    return {
      org: r.org,
      orgSlug: r.orgSlug,
      opportunity: r.opportunity,
      when: r.sStart,
      whenLabel: r.sLabel ?? '',
      hours: h != null ? Math.round(h * 10) / 10 : null,
      credits: r.credits,
      verifiedAt: r.verifiedAt,
    }
  })

  return {
    name: participantDisplayName(u),
    joinedAt: u.createdAt,
    totals: {
      contributions: rows.length,
      hours: Math.round(hours * 10) / 10,
      credits,
      organizations: orgSet.size,
    },
    contributions,
    isPublic: u.resumePublic === 1,
    token: u.resumeToken ?? null,
  }
}

/** The signed-in participant's own résumé (private preview). */
export async function getMyResume(userId: string): Promise<ResumeData | null> {
  const u = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0]
  return u ? buildResume(u) : null
}

/** Public résumé by share token — only resolves when the volunteer has enabled sharing. */
export async function getResumeByToken(token: string): Promise<ResumeData | null> {
  const u = (
    await db.select().from(users).where(and(eq(users.resumeToken, token), eq(users.resumePublic, 1))).limit(1)
  )[0]
  return u ? buildResume(u) : null
}

export async function setResumePublic(userId: string, isPublic: boolean): Promise<{ token: string | null }> {
  const u = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0]
  if (!u) return { token: null }
  let token = u.resumeToken
  if (isPublic && !token) token = randomUUID().replace(/-/g, '').slice(0, 16)
  await db.update(users).set({ resumePublic: isPublic ? 1 : 0, resumeToken: token }).where(eq(users.id, userId))
  return { token: token ?? null }
}
