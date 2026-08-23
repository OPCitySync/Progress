import { randomUUID } from 'crypto'
import { and, asc, eq, gte, lt } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { organizationCalendarEntries } from '@/lib/db/schema'

export const ORGANIZATION_CALENDAR_COLORS = ['blue', 'gold', 'mint', 'coral'] as const
export const ORGANIZATION_CALENDAR_REMINDERS = ['none', 'at_start', 'one_hour_before', 'one_day_before'] as const

export type OrganizationCalendarColor = (typeof ORGANIZATION_CALENDAR_COLORS)[number]
export type OrganizationCalendarReminder = (typeof ORGANIZATION_CALENDAR_REMINDERS)[number]

function reminderTime(startsAt: number, reminder: OrganizationCalendarReminder) {
  if (reminder === 'at_start') return startsAt
  if (reminder === 'one_hour_before') return startsAt - 60 * 60 * 1000
  if (reminder === 'one_day_before') return startsAt - 24 * 60 * 60 * 1000
  return null
}

export async function createOrganizationCalendarEntry(input: {
  orgId: string
  cityId: string
  createdByUserId: string
  title: string
  details?: string
  startsAt: number
  endsAt: number
  color: string
  reminder: string
}) {
  const title = input.title.trim()
  if (!title) return { ok: false as const, error: 'Add a title for this calendar item.' }
  if (title.length > 140) return { ok: false as const, error: 'Calendar titles must be 140 characters or fewer.' }
  if (!Number.isFinite(input.startsAt) || !Number.isFinite(input.endsAt)) return { ok: false as const, error: 'Choose a valid date range.' }
  if (input.endsAt <= input.startsAt) return { ok: false as const, error: 'The end date must be after the start date.' }
  if (!ORGANIZATION_CALENDAR_COLORS.includes(input.color as OrganizationCalendarColor)) return { ok: false as const, error: 'Choose a valid calendar color.' }
  if (!ORGANIZATION_CALENDAR_REMINDERS.includes(input.reminder as OrganizationCalendarReminder)) return { ok: false as const, error: 'Choose a valid notification option.' }

  const now = Date.now()
  const reminder = input.reminder as OrganizationCalendarReminder
  const entry = {
    id: randomUUID(),
    orgId: input.orgId,
    cityId: input.cityId,
    createdByUserId: input.createdByUserId,
    title,
    details: input.details?.trim().slice(0, 500) ?? '',
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    color: input.color as OrganizationCalendarColor,
    reminderKind: reminder,
    reminderAt: reminderTime(input.startsAt, reminder),
    notifiedAt: null,
    createdAt: now,
    updatedAt: now,
  }
  await db.insert(organizationCalendarEntries).values(entry)
  return { ok: true as const, entry }
}

export async function getOrganizationCalendarEntries(orgId: string, cityId: string, from: number, to: number) {
  return db
    .select()
    .from(organizationCalendarEntries)
    .where(
      and(
        eq(organizationCalendarEntries.orgId, orgId),
        eq(organizationCalendarEntries.cityId, cityId),
        lt(organizationCalendarEntries.startsAt, to),
        gte(organizationCalendarEntries.endsAt, from),
      ),
    )
    .orderBy(asc(organizationCalendarEntries.startsAt))
}
