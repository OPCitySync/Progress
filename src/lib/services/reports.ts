import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { cityMemberships, users, orgs, tasks, shifts, claims, redemptions, offerings } from '@/lib/db/schema'
import { participantDisplayName } from '@/lib/participant-name'
import { getCityWallet } from '@/lib/services/city-wallets'

export type Report = { filename: string; headers: string[]; rows: (string | number | null)[][] }

/** RFC-4180-ish CSV: quote fields containing comma, quote, or newline. */
export function toCsv(report: Report): string {
  const esc = (v: string | number | null) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [report.headers, ...report.rows].map((r) => r.map(esc).join(',')).join('\r\n')
}

function isoDate(ms: number | null | undefined): string {
  return ms ? new Date(ms).toISOString() : ''
}

function shiftWhen(startsAt: number | null, label: string | null): string {
  if (startsAt) return new Date(startsAt).toISOString()
  return label ?? ''
}

function hours(startsAt: number | null, endsAt: number | null): string {
  if (startsAt && endsAt && endsAt > startsAt) return ((endsAt - startsAt) / 3_600_000).toFixed(2)
  return ''
}

/**
 * Per-sign-up contributions. Network-wide for admins; org-scoped (grant/CSR
 * ready) when orgId is given. Every row is backed by a ledger event.
 */
export async function contributionsReport(orgId?: string, cityId?: string): Promise<Report> {
  const rows = await db
    .select({
      org: orgs.name,
      task: tasks.title,
      credits: tasks.credits,
      status: claims.status,
      checkedInAt: claims.checkedInAt,
      updatedAt: claims.updatedAt,
      vName: users.name,
      vUsername: users.username,
      vEmail: users.email,
      sStart: shifts.startsAt,
      sEnd: shifts.endsAt,
      sLabel: shifts.label,
    })
    .from(claims)
    .innerJoin(tasks, eq(claims.taskId, tasks.id))
    .innerJoin(orgs, eq(tasks.orgId, orgs.id))
    .innerJoin(users, eq(claims.userId, users.id))
    .leftJoin(shifts, eq(claims.shiftId, shifts.id))
    .where(
      orgId && cityId
        ? and(eq(tasks.orgId, orgId), eq(tasks.cityId, cityId))
        : orgId
          ? eq(tasks.orgId, orgId)
          : cityId
            ? eq(tasks.cityId, cityId)
            : sql`1 = 1`,
    )
    .orderBy(desc(claims.updatedAt))
    .limit(10000)

  return {
    filename: orgId ? 'contributions.csv' : 'contributions-network.csv',
    headers: [
      'Organization',
      'Opportunity',
      'Shift',
      'Volunteer',
      'Email',
      'Status',
      'Checked in',
      'Credits awarded',
      'Hours',
      'Last updated',
    ],
    rows: rows.map((r) => [
      r.org,
      r.task,
      shiftWhen(r.sStart, r.sLabel),
      participantDisplayName({ name: r.vName, username: r.vUsername }),
      r.vEmail,
      r.status,
      isoDate(r.checkedInAt),
      r.status === 'verified' ? r.credits : '',
      hours(r.sStart, r.sEnd),
      isoDate(r.updatedAt),
    ]),
  }
}

/** Per-organization roll-up (admin). */
export async function organizationsReport(cityId?: string): Promise<Report> {
  const orgRows = await db
    .select()
    .from(orgs)
    .where(cityId ? eq(orgs.requestedCityId, cityId) : sql`1 = 1`)
    .orderBy(orgs.name)

  const verified = await db
    .select({
      orgId: tasks.orgId,
      volunteers: sql<number>`count(distinct ${claims.userId})`,
      completions: sql<number>`count(*)`,
      credits: sql<number>`coalesce(sum(${tasks.credits}), 0)`,
    })
    .from(claims)
    .innerJoin(tasks, eq(claims.taskId, tasks.id))
    .where(cityId ? and(eq(claims.status, 'verified'), eq(tasks.cityId, cityId)) : eq(claims.status, 'verified'))
    .groupBy(tasks.orgId)
  const vById = new Map(verified.map((v) => [v.orgId, v]))

  const hoursByOrg = await db
    .select({
      orgId: tasks.orgId,
      ms: sql<number>`coalesce(sum(${shifts.endsAt} - ${shifts.startsAt}), 0)`,
    })
    .from(claims)
    .innerJoin(tasks, eq(claims.taskId, tasks.id))
    .innerJoin(shifts, eq(claims.shiftId, shifts.id))
    .where(
      cityId
        ? and(
            eq(claims.status, 'verified'),
            eq(tasks.cityId, cityId),
            sql`${shifts.startsAt} is not null and ${shifts.endsAt} is not null and ${shifts.endsAt} > ${shifts.startsAt}`,
          )
        : and(
            eq(claims.status, 'verified'),
            sql`${shifts.startsAt} is not null and ${shifts.endsAt} is not null and ${shifts.endsAt} > ${shifts.startsAt}`,
          ),
    )
    .groupBy(tasks.orgId)
  const hoursById = new Map(hoursByOrg.map((h) => [h.orgId, Number(h.ms)]))

  const openByOrg = await db
    .select({ orgId: tasks.orgId, n: sql<number>`count(*)` })
    .from(tasks)
    .where(cityId ? and(eq(tasks.status, 'open'), eq(tasks.cityId, cityId)) : eq(tasks.status, 'open'))
    .groupBy(tasks.orgId)
  const openById = new Map(openByOrg.map((o) => [o.orgId, Number(o.n)]))

  return {
    filename: 'organizations.csv',
    headers: [
      'Organization',
      'Type',
      'Status',
      'Volunteers',
      'Verified contributions',
      'Credits issued',
      'Volunteer hours',
      'Open opportunities',
    ],
    rows: orgRows.map((o) => {
      const v = vById.get(o.id)
      return [
        o.name,
        o.type,
        o.status,
        Number(v?.volunteers ?? 0),
        Number(v?.completions ?? 0),
        Number(v?.credits ?? 0),
        ((hoursById.get(o.id) ?? 0) / 3_600_000).toFixed(2),
        openById.get(o.id) ?? 0,
      ]
    }),
  }
}

/** Per-participant roll-up (admin). */
export async function participantsReport(cityId?: string): Promise<Report> {
  const people = cityId
    ? (
        await db
          .select({ user: users })
          .from(cityMemberships)
          .innerJoin(users, eq(cityMemberships.memberId, users.id))
          .where(
            and(
              eq(cityMemberships.cityId, cityId),
              eq(cityMemberships.memberKind, 'user'),
              eq(users.role, 'participant'),
            ),
          )
      ).map(({ user }) => user)
    : await db.select().from(users).where(eq(users.role, 'participant'))
  const ppl = people.sort((a, b) => participantDisplayName(a).localeCompare(participantDisplayName(b)))

  const verified = await db
    .select({ userId: claims.userId, n: sql<number>`count(*)` })
    .from(claims)
    .where(cityId ? and(eq(claims.status, 'verified'), eq(tasks.cityId, cityId)) : eq(claims.status, 'verified'))
    .groupBy(claims.userId)
  const vById = new Map(verified.map((v) => [v.userId, Number(v.n)]))

  const hoursByUser = await db
    .select({ userId: claims.userId, ms: sql<number>`coalesce(sum(${shifts.endsAt} - ${shifts.startsAt}), 0)` })
    .from(claims)
    .innerJoin(tasks, eq(claims.taskId, tasks.id))
    .innerJoin(shifts, eq(claims.shiftId, shifts.id))
    .where(
      cityId
        ? and(
            eq(claims.status, 'verified'),
            eq(tasks.cityId, cityId),
            sql`${shifts.startsAt} is not null and ${shifts.endsAt} is not null and ${shifts.endsAt} > ${shifts.startsAt}`,
          )
        : and(
            eq(claims.status, 'verified'),
            sql`${shifts.startsAt} is not null and ${shifts.endsAt} is not null and ${shifts.endsAt} > ${shifts.startsAt}`,
          ),
    )
    .groupBy(claims.userId)
  const hoursById = new Map(hoursByUser.map((h) => [h.userId, Number(h.ms)]))

  const walletByUser = cityId
    ? new Map(await Promise.all(ppl.map(async (person) => [person.id, await getCityWallet(cityId, person.id)] as const)))
    : null

  return {
    filename: 'participants.csv',
    headers: ['Name', 'Email', 'Verified contributions', 'Volunteer hours', 'Lifetime credits', 'Current balance'],
    rows: ppl.map((u) => [
      participantDisplayName(u),
      u.email,
      vById.get(u.id) ?? 0,
      ((hoursById.get(u.id) ?? 0) / 3_600_000).toFixed(2),
      walletByUser?.get(u.id)?.lifetimeEarned ?? u.lifetimeEarned,
      walletByUser?.get(u.id)?.creditBalance ?? u.creditBalance,
    ]),
  }
}

/** Credit mints (verified work) and burns (finalized redemptions) (admin). */
export async function creditsReport(cityId?: string): Promise<Report> {
  const mints = await db
    .select({
      ts: claims.updatedAt,
      amount: tasks.credits,
      reason: tasks.title,
      org: orgs.name,
      vName: users.name,
      vUsername: users.username,
      vEmail: users.email,
    })
    .from(claims)
    .innerJoin(tasks, eq(claims.taskId, tasks.id))
    .innerJoin(orgs, eq(tasks.orgId, orgs.id))
    .innerJoin(users, eq(claims.userId, users.id))
    .where(cityId ? and(eq(claims.status, 'verified'), eq(tasks.cityId, cityId)) : eq(claims.status, 'verified'))

  const burns = await db
    .select({
      ts: redemptions.finalizedAt,
      amount: redemptions.cost,
      reason: offerings.title,
      org: orgs.name,
      vName: users.name,
      vUsername: users.username,
      vEmail: users.email,
    })
    .from(redemptions)
    .innerJoin(offerings, eq(redemptions.offeringId, offerings.id))
    .innerJoin(orgs, eq(redemptions.orgId, orgs.id))
    .innerJoin(users, eq(redemptions.userId, users.id))
    .where(cityId ? and(eq(redemptions.status, 'finalized'), eq(redemptions.cityId, cityId)) : eq(redemptions.status, 'finalized'))

  const rows = [
    ...mints.map((m) => ({
      ts: Number(m.ts ?? 0),
      type: 'mint',
      amount: m.amount,
      vName: participantDisplayName({ name: m.vName, username: m.vUsername }),
      vEmail: m.vEmail,
      org: m.org,
      reason: m.reason,
    })),
    ...burns.map((b) => ({
      ts: Number(b.ts ?? 0),
      type: 'burn',
      amount: b.amount,
      vName: participantDisplayName({ name: b.vName, username: b.vUsername }),
      vEmail: b.vEmail,
      org: b.org,
      reason: b.reason,
    })),
  ].sort((a, b) => b.ts - a.ts)

  return {
    filename: 'credits.csv',
    headers: ['Date', 'Type', 'Amount', 'Participant', 'Email', 'Organization', 'Reason'],
    rows: rows.map((r) => [isoDate(r.ts), r.type, r.amount, r.vName, r.vEmail, r.org, r.reason]),
  }
}

/** Headline numbers for an org's reports page. */
export async function orgReportSummary(orgId: string): Promise<{
  volunteers: number
  verifiedCompletions: number
  creditsIssued: number
  hours: number
}> {
  const [v] = await db
    .select({
      volunteers: sql<number>`count(distinct ${claims.userId})`,
      completions: sql<number>`count(*)`,
      credits: sql<number>`coalesce(sum(${tasks.credits}), 0)`,
    })
    .from(claims)
    .innerJoin(tasks, eq(claims.taskId, tasks.id))
    .where(and(eq(tasks.orgId, orgId), eq(claims.status, 'verified')))

  const [h] = await db
    .select({ ms: sql<number>`coalesce(sum(${shifts.endsAt} - ${shifts.startsAt}), 0)` })
    .from(claims)
    .innerJoin(tasks, eq(claims.taskId, tasks.id))
    .innerJoin(shifts, eq(claims.shiftId, shifts.id))
    .where(
      and(
        eq(tasks.orgId, orgId),
        eq(claims.status, 'verified'),
        sql`${shifts.startsAt} is not null and ${shifts.endsAt} is not null and ${shifts.endsAt} > ${shifts.startsAt}`,
      ),
    )

  return {
    volunteers: Number(v?.volunteers ?? 0),
    verifiedCompletions: Number(v?.completions ?? 0),
    creditsIssued: Number(v?.credits ?? 0),
    hours: Math.round((Number(h?.ms ?? 0) / 3_600_000) * 10) / 10,
  }
}
