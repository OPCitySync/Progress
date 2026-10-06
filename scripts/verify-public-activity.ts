import assert from 'node:assert/strict'
import { copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const directory = mkdtempSync(join(tmpdir(), 'mycity-public-activity-'))
const database = join(directory, 'application.db')
const source = resolve(existsSync('.integration-preview/application.db') ? '.integration-preview/application.db' : 'local.db')
copyFileSync(source, database)
process.env.CITYSYNC_PREVIEW_DATABASE_DIR = directory
process.env.DATABASE_URL = `file:${database}`
delete process.env.DATABASE_AUTH_TOKEN

async function main() {
  const [{ db, client }, schema, drizzle, service, opportunities] = await Promise.all([
    import('../src/lib/db/client'),
    import('../src/lib/db/schema'),
    import('drizzle-orm'),
    import('../src/lib/services/public-activities'),
    import('../src/lib/services/opportunities'),
  ])
  const { eq } = drizzle
  const city = (await db.select().from(schema.cities).limit(1))[0]
  assert.ok(city, 'verification database needs one city')

  const now = Date.now()
  const orgId = 'public-activity-verification-org'
  const taskId = 'public-activity-verification-task'
  const publicShiftId = 'public-activity-verification-public'
  const privateShiftId = 'public-activity-verification-private'
  const pastShiftId = 'public-activity-verification-past'
  const participantId = 'public-activity-verification-participant'

  await db.insert(schema.orgs).values({
    id: orgId,
    name: 'Public Activity Verification Organization',
    slug: 'public-activity-verification',
    type: 'issuer',
    description: '',
    status: 'approved',
    ownerUserId: 'verification-owner',
    createdAt: now,
  })
  await db.insert(schema.tasks).values({
    id: taskId,
    orgId,
    cityId: city.id,
    title: 'Community cleanup verification',
    description: 'A disposable public activity fixture.',
    location: 'Test Plaza',
    credits: 1,
    slots: 3,
    defaultDurationMinutes: 60,
    startsAt: '',
    status: 'open',
    createdBy: 'verification-owner',
    createdAt: now,
  })
  await db.insert(schema.shifts).values([
    { id: publicShiftId, taskId, orgId, startsAt: now + 86_400_000, endsAt: now + 90_000_000, label: '', capacity: 3, status: 'open', visibility: 'public', enrollmentMode: 'open_claims', checkInCode: 'PUBLIC', createdAt: now },
    { id: privateShiftId, taskId, orgId, startsAt: now + 86_400_000, endsAt: now + 90_000_000, label: '', capacity: 3, status: 'open', visibility: 'private', enrollmentMode: 'organization_managed', checkInCode: 'PRIVATE', createdAt: now },
    { id: pastShiftId, taskId, orgId, startsAt: now - 7_200_000, endsAt: now - 3_600_000, label: '', capacity: 3, status: 'open', visibility: 'public', enrollmentMode: 'open_claims', checkInCode: 'PASTQA', createdAt: now },
  ])
  await db.insert(schema.claims).values({
    id: 'public-activity-verification-claim',
    taskId,
    shiftId: publicShiftId,
    userId: 'existing-volunteer',
    status: 'claimed',
    createdAt: now,
    updatedAt: now,
  })
  await db.insert(schema.cityParticipantStatuses).values({
    id: 'public-activity-verification-city-status',
    cityId: city.id,
    userId: participantId,
    status: 'new',
    noShowCount: 0,
    createdAt: now,
    updatedAt: now,
  })

  const activity = await service.getPublicActivity(publicShiftId)
  assert.ok(activity, 'a public open-claim shift has a public page')
  assert.equal(activity.spotsLeft, 2, 'the page uses the live active-claim count')
  assert.equal(activity.availability, 'open')
  assert.equal(await service.getPublicActivity(privateShiftId), null, 'private shifts are never exposed')

  const directPublicGate = await opportunities.checkClaimGate(publicShiftId, participantId)
  assert.equal(directPublicGate.ok, true, 'a new city participant may join a direct public activity')

  const pastGate = await opportunities.checkClaimGate(pastShiftId, participantId)
  assert.equal(pastGate.ok, false, 'a past public activity cannot be claimed')
  if (!pastGate.ok && pastGate.reason === 'error') assert.match(pastGate.error, /begins/)

  await db.update(schema.shifts).set({ status: 'closed' }).where(eq(schema.shifts.id, publicShiftId))
  const closed = await service.getPublicActivity(publicShiftId)
  assert.equal(closed?.availability, 'closed', 'shared links remain informative after sign-ups close')

  client.close()
  rmSync(directory, { recursive: true, force: true })
  console.log('✓ Public activity visibility, availability, capacity, and first-time signup gates verified')
}

main().catch((error) => {
  rmSync(directory, { recursive: true, force: true })
  console.error(error)
  process.exit(1)
})
