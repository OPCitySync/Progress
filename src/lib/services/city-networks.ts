import { randomUUID } from 'crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { db } from '@/lib/db/client'
import { cities, cityMemberships, cityParticipantStatuses, organizationDelegations, users } from '@/lib/db/schema'
import type { Session } from '@/lib/auth/session'

export const BERKELEY_CITY_ID = 'berkeley'
export const ACTIVE_CITY_COOKIE = 'cs_active_city'
export type CityMembershipKind = 'user' | 'organization'
export type CityParticipationStatus = 'new' | 'active' | 'barred'

export type CityParticipation = {
  status: CityParticipationStatus
  noShowCount: number
  barredUntil: number | null
  activatedAt: number | null
}

export type CityNetwork = {
  id: string
  name: string
  slug: string
  description: string
  memberKinds: CityMembershipKind[]
  participation: CityParticipation | null
  isHomeCity: boolean
}

function parseCityScope(value: string | null | undefined): string[] {
  try {
    const parsed: unknown = JSON.parse(value ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

/** The two launch cities. New cities can use the same table and flow later. */
export async function getAvailableCities() {
  return db.select().from(cities).orderBy(cities.name)
}

/** City networks attached to the signed-in account and, where present, its organization. */
export async function getCityNetworks(session: Session): Promise<CityNetwork[]> {
  // Network Administrators oversee every city. Their rail is an operating
  // context selector, not a membership list, so a newly provisioned city is
  // immediately available to administer without manually adding each admin
  // as a city participant.
  if (session.role === 'admin') {
    const rows = await getAvailableCities()
    return rows.map((city) => ({
      id: city.id,
      name: city.name,
      slug: city.slug,
      description: city.description,
      memberKinds: ['user'],
      participation: null,
      isHomeCity: false,
    }))
  }

  const memberIds = [session.sub, ...(session.orgId ? [session.orgId] : [])]
  const [rows, delegatedScope] = await Promise.all([
    db
    .select({ city: cities, memberKind: cityMemberships.memberKind })
    .from(cityMemberships)
    .innerJoin(cities, eq(cityMemberships.cityId, cities.id))
    .where(
      and(
        inArray(cityMemberships.memberId, memberIds),
        inArray(cityMemberships.memberKind, session.orgId ? ['user', 'organization'] : ['user']),
      ),
    ),
    session.authorityId && session.orgId && (session.role === 'issuer' || session.role === 'redeemer')
      ? db
          .select({ cityIds: organizationDelegations.cityIds })
          .from(organizationDelegations)
          .where(and(eq(organizationDelegations.id, session.authorityId), eq(organizationDelegations.status, 'active')))
          .limit(1)
      : Promise.resolve([]),
  ])
  const scopedCityIds = parseCityScope(delegatedScope[0]?.cityIds)
  const hasCityScope = scopedCityIds.length > 0
  const permittedCities = new Set(scopedCityIds)

  const [statusRows, user] = await Promise.all([
    db.select().from(cityParticipantStatuses).where(eq(cityParticipantStatuses.userId, session.sub)),
    db.select({ homeCityId: users.homeCityId }).from(users).where(eq(users.id, session.sub)).limit(1),
  ])
  const homeCityId = user[0]?.homeCityId
  const participationByCity = new Map(
    statusRows.map((row) => [
      row.cityId,
      {
        status: row.status,
        noShowCount: row.noShowCount,
        barredUntil: row.barredUntil,
        activatedAt: row.activatedAt,
      } satisfies CityParticipation,
    ]),
  )

  const networks = new Map<string, CityNetwork>()
  for (const row of rows) {
    // A delegated authority with an explicit city scope cannot select another
    // organization city in the rail. Personal participant city networks stay
    // separate and remain available when the person switches context.
    if (row.memberKind === 'organization' && hasCityScope && !permittedCities.has(row.city.id)) continue
    const existing = networks.get(row.city.id)
    if (existing) {
      existing.memberKinds.push(row.memberKind)
    } else {
      networks.set(row.city.id, {
        id: row.city.id,
        name: row.city.name,
        slug: row.city.slug,
        description: row.city.description,
        memberKinds: [row.memberKind],
        participation: participationByCity.get(row.city.id) ?? null,
        isHomeCity: row.city.id === homeCityId,
      })
    }
  }

  return Array.from(networks.values()).sort((a, b) => {
    if (a.id === BERKELEY_CITY_ID) return -1
    if (b.id === BERKELEY_CITY_ID) return 1
    return a.name.localeCompare(b.name)
  })
}

/** Resolve the city selected on the left rail for this signed-in workspace. */
export async function getActiveCity(session: Session): Promise<CityNetwork | null> {
  const networks = await getCityNetworks(session)
  const requiredKind: CityMembershipKind = session.orgId && session.role !== 'participant' ? 'organization' : 'user'
  const eligible = networks.filter((city) => city.memberKinds.includes(requiredKind))
  if (eligible.length === 0) return null

  const selectedId = cookies().get(ACTIVE_CITY_COOKIE)?.value
  return eligible.find((city) => city.id === selectedId) ?? eligible[0]
}

/** Persist a rail selection after validating that the account belongs to that city. */
export async function setActiveCity(session: Session, cityId: string): Promise<boolean> {
  const city = (await getCityNetworks(session)).find((network) => network.id === cityId)
  const requiredKind: CityMembershipKind = session.orgId && session.role !== 'participant' ? 'organization' : 'user'
  if (!city || !city.memberKinds.includes(requiredKind)) return false

  cookies().set(ACTIVE_CITY_COOKIE, cityId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  })
  return true
}

/** Add a person to a city immediately. Organizations are city-admin onboarded separately. */
export async function joinCityNetwork(input: {
  cityId: string
  session: Session
}): Promise<{ ok: true; cityName: string; alreadyMember: boolean } | { ok: false; error: string }> {
  const city = (await db.select().from(cities).where(eq(cities.id, input.cityId)).limit(1))[0]
  if (!city) return { ok: false, error: 'That city network is not available.' }

  const existing = await db
    .select({ id: cityMemberships.id })
    .from(cityMemberships)
    .where(
      and(
        eq(cityMemberships.cityId, city.id),
        eq(cityMemberships.memberKind, 'user'),
        eq(cityMemberships.memberId, input.session.sub),
      ),
    )
    .limit(1)
  if (existing.length > 0) return { ok: true, cityName: city.name, alreadyMember: true }

  const now = Date.now()
  await db.transaction(async (tx) => {
    await tx.insert(cityMemberships).values({
      id: randomUUID(),
      cityId: city.id,
      memberKind: 'user',
      memberId: input.session.sub,
      joinedAt: now,
    })
    await tx.insert(cityParticipantStatuses).values({
      id: randomUUID(),
      cityId: city.id,
      userId: input.session.sub,
      status: 'new',
      noShowCount: 0,
      barredUntil: null,
      activatedAt: null,
      createdAt: now,
      updatedAt: now,
    })
  })

  return { ok: true, cityName: city.name, alreadyMember: false }
}

/** A bar expires into a fresh New Participant attempt after six months. */
export async function getCityParticipantStatus(
  userId: string,
  cityId: string,
): Promise<CityParticipation | null> {
  const row = (
    await db
      .select()
      .from(cityParticipantStatuses)
      .where(and(eq(cityParticipantStatuses.userId, userId), eq(cityParticipantStatuses.cityId, cityId)))
      .limit(1)
  )[0]
  if (!row) return null

  if (row.status === 'barred' && row.barredUntil && row.barredUntil <= Date.now()) {
    const now = Date.now()
    await db
      .update(cityParticipantStatuses)
      .set({ status: 'new', noShowCount: 0, barredUntil: null, updatedAt: now })
      .where(eq(cityParticipantStatuses.id, row.id))
    return { status: 'new', noShowCount: 0, barredUntil: null, activatedAt: row.activatedAt }
  }

  return {
    status: row.status,
    noShowCount: row.noShowCount,
    barredUntil: row.barredUntil,
    activatedAt: row.activatedAt,
  }
}
