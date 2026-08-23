/**
 * Local-only simulated onboarding roster data for visual review.
 *
 * This script refuses a remote DATABASE_URL. It does not append ledger events,
 * issue credits, or create usable login accounts; it only creates fictional
 * participants, shifts, and operational states in the local demo database.
 */
import { randomUUID } from 'crypto'
import { and, eq } from 'drizzle-orm'
import { db, client } from '../src/lib/db/client'
import {
  claims,
  cityMemberships,
  cityParticipantStatuses,
  orgProfiles,
  orgs,
  shifts,
  tasks,
  users,
  volunteerEligibilityRecords,
  volunteerTaskEligibilityGrants,
  waiverAcceptances,
  waiverVersions,
} from '../src/lib/db/schema'
import { hashPassword } from '../src/lib/auth/password'

const DAY = 24 * 60 * 60 * 1000
const SIMULATED_EMAIL_DOMAIN = 'simulated.city-sync.test'

type SimulatedVolunteer = {
  key: string
  name: string
  username: string
  eligibility?: 'adult_verified' | 'minor_consent_verified'
}

const volunteers: SimulatedVolunteer[] = [
  { key: 'marisol-chen', name: 'Marisol Chen', username: 'marisol_chen', eligibility: 'adult_verified' },
  { key: 'jamal-wright', name: 'Jamal Wright', username: 'jamal_wright' },
  { key: 'elena-morales', name: 'Elena Morales', username: 'elena_morales', eligibility: 'minor_consent_verified' },
  { key: 'tyler-nguyen', name: 'Tyler Nguyen', username: 'tyler_nguyen', eligibility: 'adult_verified' },
  { key: 'priya-shah', name: 'Priya Shah', username: 'priya_shah', eligibility: 'adult_verified' },
  { key: 'devon-lee', name: 'Devon Lee', username: 'devon_lee' },
  { key: 'sasha-ortiz', name: 'Sasha Ortiz', username: 'sasha_ortiz', eligibility: 'minor_consent_verified' },
  { key: 'noah-parker', name: 'Noah Parker', username: 'noah_parker', eligibility: 'adult_verified' },
]

function previousTuesdayAtSix(offsetWeeks: number) {
  const date = new Date()
  date.setHours(18, 0, 0, 0)
  const daysSinceTuesday = (date.getDay() + 5) % 7
  date.setDate(date.getDate() - daysSinceTuesday - offsetWeeks * 7)
  return date.getTime()
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL ?? 'file:local.db'
  if (!databaseUrl.startsWith('file:')) {
    throw new Error('Simulated onboarding data is local-only. Refusing to write to a remote database.')
  }

  const target = (
    await db
      .select({ org: orgs, task: tasks })
      .from(orgProfiles)
      .innerJoin(orgs, eq(orgProfiles.orgId, orgs.id))
      .innerJoin(tasks, eq(orgProfiles.onboardingTaskId, tasks.id))
      .where(eq(orgs.name, 'Riverside Food Bank'))
      .limit(1)
  )[0]
  if (!target) throw new Error('The local Riverside Food Bank onboarding program was not found.')

  const activeWaiver = (
    await db
      .select()
      .from(waiverVersions)
      .where(and(eq(waiverVersions.orgId, target.org.id), eq(waiverVersions.active, 1)))
      .limit(1)
  )[0]
  if (!activeWaiver) throw new Error('The local onboarding program needs an active waiver before it can be simulated.')

  const now = Date.now()
  const existingFutureShifts = await db
    .select()
    .from(shifts)
    .where(eq(shifts.taskId, target.task.id))
  const futureShifts = existingFutureShifts
    .filter((shift) => (shift.startsAt ?? 0) > now)
    .sort((a, b) => (a.startsAt ?? 0) - (b.startsAt ?? 0))
    .slice(0, 2)
  if (futureShifts.length < 2) throw new Error('The local onboarding program needs at least two upcoming sessions.')

  const pastStarts = [1, 2, 3].map((weeksAgo) => previousTuesdayAtSix(weeksAgo))
  const pastShifts = [] as typeof shifts.$inferSelect[]
  for (const startsAt of pastStarts) {
    const label = `Simulated onboarding history · ${new Date(startsAt).toISOString().slice(0, 10)}`
    const existing = existingFutureShifts.find((shift) => shift.label === label)
    if (existing) {
      pastShifts.push(existing)
      continue
    }
    const shift = {
      id: randomUUID(),
      taskId: target.task.id,
      orgId: target.org.id,
      startsAt,
      endsAt: startsAt + 45 * 60 * 1000,
      label,
      capacity: target.task.slots,
      status: 'closed' as const,
      checkInCode: 'DEMO01',
      createdAt: now,
    }
    await db.insert(shifts).values(shift)
    pastShifts.push(shift)
  }

  // A one-off, unknown value keeps these display-only accounts from becoming
  // demo credentials anyone can use to sign in.
  const passwordHash = await hashPassword(randomUUID())
  const userIds = new Map<string, string>()
  for (const volunteer of volunteers) {
    const email = `${volunteer.key}@${SIMULATED_EMAIL_DOMAIN}`
    const existing = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0]
    const id = existing?.id ?? randomUUID()
    if (!existing) {
      await db.insert(users).values({
        id,
        email,
        name: volunteer.name,
        username: volunteer.username,
        passwordHash,
        role: 'participant',
        status: 'active',
        orgId: null,
        creditBalance: 0,
        lifetimeEarned: 0,
        interests: '[]',
        neighborhood: '',
        resumeToken: null,
        resumePublic: 0,
        avatarUrl: '',
        homeCityId: target.task.cityId,
        createdAt: now,
      })
      await db.insert(cityMemberships).values({
        id: randomUUID(),
        cityId: target.task.cityId,
        memberKind: 'user',
        memberId: id,
        joinedAt: now,
      }).onConflictDoNothing()
    } else {
      await db.update(users).set({ passwordHash }).where(eq(users.id, id))
    }
    userIds.set(volunteer.key, id)
  }

  const byKey = (key: string) => userIds.get(key)!
  const participation = [
    { shift: futureShifts[0], volunteer: 'marisol-chen', status: 'claimed' as const, acceptedWaiver: true },
    { shift: futureShifts[0], volunteer: 'jamal-wright', status: 'claimed' as const, acceptedWaiver: false },
    { shift: futureShifts[0], volunteer: 'elena-morales', status: 'claimed' as const, acceptedWaiver: true },
    { shift: futureShifts[1], volunteer: 'tyler-nguyen', status: 'claimed' as const, acceptedWaiver: true },
    { shift: futureShifts[1], volunteer: 'priya-shah', status: 'claimed' as const, acceptedWaiver: true },
    { shift: pastShifts[0], volunteer: 'marisol-chen', status: 'verified' as const, checkedIn: true, acceptedWaiver: true },
    { shift: pastShifts[0], volunteer: 'elena-morales', status: 'submitted' as const, checkedIn: true, acceptedWaiver: true },
    { shift: pastShifts[0], volunteer: 'jamal-wright', status: 'no_show' as const, acceptedWaiver: true },
    { shift: pastShifts[1], volunteer: 'tyler-nguyen', status: 'verified' as const, checkedIn: true, acceptedWaiver: true },
    { shift: pastShifts[1], volunteer: 'devon-lee', status: 'submitted' as const, checkedIn: true, acceptedWaiver: false },
    { shift: pastShifts[2], volunteer: 'sasha-ortiz', status: 'verified' as const, checkedIn: true, acceptedWaiver: true },
    { shift: pastShifts[2], volunteer: 'noah-parker', status: 'no_show' as const, acceptedWaiver: true },
  ]

  for (const signup of participation) {
    const userId = byKey(signup.volunteer)
    const signedAt = Math.min(now, (signup.shift.startsAt ?? now) - DAY)
    await db.insert(claims).values({
      id: randomUUID(),
      taskId: target.task.id,
      shiftId: signup.shift.id,
      userId,
      status: signup.status,
      note: signup.status === 'submitted' ? 'Simulated attendance awaiting organization verification.' : '',
      checkedInAt: signup.checkedIn ? (signup.shift.startsAt ?? now) + 8 * 60 * 1000 : null,
      waiverVersionId: activeWaiver.id,
      waiverCollectionMethod: 'digital',
      paperWaiverConfirmedAt: null,
      paperWaiverConfirmedBy: null,
      noShowAt: signup.status === 'no_show' ? (signup.shift.endsAt ?? now) + 2 * 60 * 60 * 1000 : null,
      createdAt: signedAt,
      updatedAt: now,
    }).onConflictDoNothing()
    if (signup.acceptedWaiver) {
      await db.insert(waiverAcceptances).values({
        id: randomUUID(),
        waiverVersionId: activeWaiver.id,
        orgId: target.org.id,
        userId,
        sha256: activeWaiver.sha256,
        acceptedAt: signedAt,
      }).onConflictDoNothing()
    }
  }

  for (const volunteer of volunteers) {
    if (!volunteer.eligibility) continue
    const userId = byKey(volunteer.key)
    await db.insert(volunteerEligibilityRecords).values({
      id: randomUUID(),
      orgId: target.org.id,
      userId,
      status: volunteer.eligibility,
      verifiedByUserId: target.org.ownerUserId,
      verifiedAt: now - 2 * DAY,
      expiresAt: null,
      createdAt: now - 2 * DAY,
      updatedAt: now - 2 * DAY,
    }).onConflictDoNothing()
    await db.insert(cityParticipantStatuses).values({
      id: randomUUID(),
      cityId: target.task.cityId,
      userId,
      status: 'active',
      noShowCount: 0,
      barredUntil: null,
      activatedAt: now - DAY,
      createdAt: now - 2 * DAY,
      updatedAt: now - DAY,
    }).onConflictDoNothing()
  }

  const taskEligibility = [
    { volunteer: 'marisol-chen', scope: 'all' as const, taskId: 'all' },
    { volunteer: 'tyler-nguyen', scope: 'all' as const, taskId: 'all' },
    { volunteer: 'elena-morales', scope: 'task' as const, taskId: target.task.id },
    { volunteer: 'sasha-ortiz', scope: 'task' as const, taskId: target.task.id },
  ]
  for (const grant of taskEligibility) {
    await db.insert(volunteerTaskEligibilityGrants).values({
      id: randomUUID(),
      orgId: target.org.id,
      userId: byKey(grant.volunteer),
      scope: grant.scope,
      taskId: grant.taskId,
      status: 'active',
      grantedByUserId: target.org.ownerUserId,
      grantedAt: now - DAY,
      revokedByUserId: null,
      revokedAt: null,
      createdAt: now - DAY,
      updatedAt: now - DAY,
    }).onConflictDoNothing()
  }

  console.log(`✓ Prepared ${participation.length} simulated onboarding signups across ${futureShifts.length} upcoming and ${pastShifts.length} past sessions.`)
  client.close()
}

main().catch((error) => {
  console.error(error)
  client.close()
  process.exit(1)
})
