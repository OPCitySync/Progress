import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { users, tasks, shifts, claims } from '@/lib/db/schema'

const datedShift = sql`${shifts.startsAt} is not null and ${shifts.endsAt} is not null and ${shifts.endsAt} > ${shifts.startsAt}`

export type CityImpact = { volunteers: number; contributions: number; hours: number; credits: number }

export async function getCityImpact(): Promise<CityImpact> {
  const [v] = await db
    .select({
      volunteers: sql<number>`count(distinct ${claims.userId})`,
      contributions: sql<number>`count(*)`,
      credits: sql<number>`coalesce(sum(${tasks.credits}), 0)`,
    })
    .from(claims)
    .innerJoin(tasks, eq(claims.taskId, tasks.id))
    .where(eq(claims.status, 'verified'))

  const [h] = await db
    .select({ ms: sql<number>`coalesce(sum(${shifts.endsAt} - ${shifts.startsAt}), 0)` })
    .from(claims)
    .innerJoin(shifts, eq(claims.shiftId, shifts.id))
    .where(and(eq(claims.status, 'verified'), datedShift))

  return {
    volunteers: Number(v?.volunteers ?? 0),
    contributions: Number(v?.contributions ?? 0),
    credits: Number(v?.credits ?? 0),
    hours: Math.round((Number(h?.ms ?? 0) / 3_600_000) * 10) / 10,
  }
}

export type NeighborhoodRow = {
  neighborhood: string
  volunteers: number
  contributions: number
  hours: number
  credits: number
}

/** Verified contributions aggregated by the volunteer's neighborhood, ranked. */
export async function getNeighborhoodLeaderboard(limit = 8): Promise<NeighborhoodRow[]> {
  const rows = await db
    .select({
      neighborhood: users.neighborhood,
      volunteers: sql<number>`count(distinct ${claims.userId})`,
      contributions: sql<number>`count(*)`,
      credits: sql<number>`coalesce(sum(${tasks.credits}), 0)`,
    })
    .from(claims)
    .innerJoin(tasks, eq(claims.taskId, tasks.id))
    .innerJoin(users, eq(claims.userId, users.id))
    .where(and(eq(claims.status, 'verified'), sql`${users.neighborhood} <> ''`))
    .groupBy(users.neighborhood)

  const hrows = await db
    .select({
      neighborhood: users.neighborhood,
      ms: sql<number>`coalesce(sum(${shifts.endsAt} - ${shifts.startsAt}), 0)`,
    })
    .from(claims)
    .innerJoin(users, eq(claims.userId, users.id))
    .innerJoin(shifts, eq(claims.shiftId, shifts.id))
    .where(and(eq(claims.status, 'verified'), sql`${users.neighborhood} <> ''`, datedShift))
    .groupBy(users.neighborhood)
  const hoursBy = new Map(hrows.map((r) => [r.neighborhood, Number(r.ms)]))

  return rows
    .map((r) => ({
      neighborhood: r.neighborhood,
      volunteers: Number(r.volunteers),
      contributions: Number(r.contributions),
      credits: Number(r.credits),
      hours: Math.round((hoursBy.get(r.neighborhood) ?? 0) / 3_600_000 * 10) / 10,
    }))
    .sort((a, b) => b.hours - a.hours || b.credits - a.credits || b.contributions - a.contributions)
    .slice(0, limit)
}
