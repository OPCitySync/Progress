import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { users, orgs, tasks, claims, redemptions, events, anchors, cityMemberships } from '@/lib/db/schema'
import { getCityFinanceStats } from '@/lib/services/city-wallets'

export async function getPublicStats() {
  const [participantCount] = await db
    .select({ n: sql<number>`count(*)` })
    .from(users)
    .where(eq(users.role, 'participant'))
  const [issuerCount] = await db
    .select({ n: sql<number>`count(*)` })
    .from(orgs)
    .where(sql`${orgs.type} = 'issuer' AND ${orgs.status} = 'approved'`)
  const [redeemerCount] = await db
    .select({ n: sql<number>`count(*)` })
    .from(orgs)
    .where(sql`${orgs.type} = 'redeemer' AND ${orgs.status} = 'approved'`)
  const [taskCount] = await db.select({ n: sql<number>`count(*)` }).from(tasks)
  const [verifiedCount] = await db
    .select({ n: sql<number>`count(*)` })
    .from(claims)
    .where(eq(claims.status, 'verified'))
  const [minted] = await db
    .select({ n: sql<number>`coalesce(sum(${users.lifetimeEarned}), 0)` })
    .from(users)
  const [outstanding] = await db
    .select({ n: sql<number>`coalesce(sum(${users.creditBalance}), 0)` })
    .from(users)
  const [burned] = await db
    .select({ n: sql<number>`coalesce(sum(${redemptions.cost}), 0)` })
    .from(redemptions)
    .where(eq(redemptions.status, 'finalized'))
  const [eventCount] = await db.select({ n: sql<number>`count(*)` }).from(events)

  const anchorList = await db.select().from(anchors).orderBy(desc(anchors.createdAt)).limit(20)

  return {
    participants: Number(participantCount?.n ?? 0),
    issuers: Number(issuerCount?.n ?? 0),
    redeemers: Number(redeemerCount?.n ?? 0),
    tasks: Number(taskCount?.n ?? 0),
    verifiedCompletions: Number(verifiedCount?.n ?? 0),
    creditsMinted: Number(minted?.n ?? 0),
    creditsOutstanding: Number(outstanding?.n ?? 0),
    creditsBurned: Number(burned?.n ?? 0),
    ledgerEvents: Number(eventCount?.n ?? 0),
    anchors: anchorList,
  }
}

/** Headline figures for one independently operated City Network. */
export async function getCityAdminStats(cityId: string) {
  const [participantCount, issuerCount, redeemerCount, taskCount, verifiedCount, finance] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)` })
      .from(cityMemberships)
      .innerJoin(users, eq(cityMemberships.memberId, users.id))
      .where(
        and(
          eq(cityMemberships.cityId, cityId),
          eq(cityMemberships.memberKind, 'user'),
          eq(users.role, 'participant'),
        ),
      ),
    db
      .select({ n: sql<number>`count(*)` })
      .from(orgs)
      .where(and(eq(orgs.requestedCityId, cityId), eq(orgs.type, 'issuer'), eq(orgs.status, 'approved'))),
    db
      .select({ n: sql<number>`count(*)` })
      .from(orgs)
      .where(and(eq(orgs.requestedCityId, cityId), eq(orgs.type, 'redeemer'), eq(orgs.status, 'approved'))),
    db.select({ n: sql<number>`count(*)` }).from(tasks).where(eq(tasks.cityId, cityId)),
    db
      .select({ n: sql<number>`count(*)` })
      .from(claims)
      .innerJoin(tasks, eq(claims.taskId, tasks.id))
      .where(and(eq(tasks.cityId, cityId), eq(claims.status, 'verified'))),
    getCityFinanceStats(cityId),
  ])

  return {
    participants: Number(participantCount[0]?.n ?? 0),
    issuers: Number(issuerCount[0]?.n ?? 0),
    redeemers: Number(redeemerCount[0]?.n ?? 0),
    tasks: Number(taskCount[0]?.n ?? 0),
    verifiedCompletions: Number(verifiedCount[0]?.n ?? 0),
    creditsMinted: finance.creditsMinted,
    creditsOutstanding: finance.creditsOutstanding,
    creditsBurned: finance.creditsBurned,
    ledgerEvents: finance.ledgerEvents,
    anchors: finance.anchors,
  }
}
