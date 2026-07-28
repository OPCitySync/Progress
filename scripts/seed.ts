/**
 * Seed: demo accounts and sample data for City/Sync.
 * Run after db:migrate: npm run db:seed
 *
 * All writes go through the protocol services so the event ledger is
 * populated exactly as real usage would populate it.
 */
import { eq } from 'drizzle-orm'
import { db, client } from '../src/lib/db/client'
import { cityMemberships, users, opportunityTypes } from '../src/lib/db/schema'
import { registerParticipant, registerOrg, setOrgStatus } from '../src/lib/services/identity'
import { createWaiverVersion } from '../src/lib/services/waivers'
import { createTask, createShift } from '../src/lib/services/opportunities'
import { createOffering } from '../src/lib/services/redemption'
import { saveProfile } from '../src/lib/services/profile'
import { createPost } from '../src/lib/services/feed'
import { hashPassword } from '../src/lib/auth/password'
import { appendEvent } from '../src/lib/ledger/ledger'
import { EventTypes } from '../src/lib/ledger/events'
import { randomUUID } from 'crypto'
import { BERKELEY_CITY_ID } from '../src/lib/services/city-networks'

const ADMIN_EMAIL = 'admin@city-sync.org'
const DAY = 86_400_000

/** Next occurrence of a weekday (0=Sun … 6=Sat) at a given local hour:minute, epoch ms. */
function nextDow(targetDow: number, hour: number, minute = 0): number {
  const d = new Date()
  d.setHours(hour, minute, 0, 0)
  let add = (targetDow - d.getDay() + 7) % 7
  if (add === 0 && d.getTime() < Date.now()) add = 7
  return d.getTime() + add * DAY
}

async function main() {
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, ADMIN_EMAIL)).limit(1)
  if (existing.length > 0) {
    console.log('Seed skipped — admin account already exists.')
    client.close()
    return
  }

  // --- admin -------------------------------------------------------------
  const adminId = randomUUID()
  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id: adminId,
      email: ADMIN_EMAIL,
      name: 'Network Admin',
      passwordHash: await hashPassword('admin-citysync'),
      role: 'admin',
      orgId: null,
      createdAt: Date.now(),
    })
    await tx.insert(cityMemberships).values({
      id: randomUUID(),
      cityId: BERKELEY_CITY_ID,
      memberKind: 'user',
      memberId: adminId,
      joinedAt: Date.now(),
    })
    await appendEvent(tx, EventTypes.USER_REGISTERED, { userId: adminId, role: 'admin' }, adminId)
  })

  // --- opportunity catalog: network reference types + suggested rate bands ---
  const TYPES = [
    { category: 'Environment', name: 'Park / lake cleanup', description: 'Litter removal, planting, trail upkeep.', min: 10, typ: 15, max: 20 },
    { category: 'Food security', name: 'Food sorting & distribution', description: 'Sort, pack, and hand out food.', min: 10, typ: 15, max: 20 },
    { category: 'Seniors', name: 'Senior support', description: 'Visits, grocery delivery, companionship.', min: 20, typ: 25, max: 35 },
    { category: 'Community', name: 'Information booth', description: 'Staff a table and answer questions.', min: 5, typ: 8, max: 12 },
    { category: 'Onboarding', name: 'Volunteer orientation', description: 'New-volunteer welcome session.', min: 5, typ: 5, max: 10 },
  ]
  for (const t of TYPES) {
    await db.insert(opportunityTypes).values({
      id: randomUUID(),
      category: t.category,
      name: t.name,
      description: t.description,
      suggestedMin: t.min,
      suggestedTypical: t.typ,
      suggestedMax: t.max,
      active: 1,
      createdAt: Date.now(),
    })
  }

  // --- issuer org ----------------------------------------------------------
  const issuer = await registerOrg({
    orgName: 'Riverside Food Bank',
    orgType: 'issuer',
    description: 'Community food bank serving the Riverside district since 1998.',
    name: 'Maria Lopez',
    email: 'issuer@demo.city-sync.org',
    password: 'demo1234',
    cityId: BERKELEY_CITY_ID,
  })
  if (!issuer.ok) throw new Error(issuer.error)
  await setOrgStatus(issuer.orgId, 'approved', adminId)

  await createWaiverVersion({
    orgId: issuer.orgId,
    actorId: issuer.userId,
    title: 'Volunteer Liability Release',
    body: `RIVERSIDE FOOD BANK — VOLUNTEER LIABILITY RELEASE (v1)

In consideration of being permitted to volunteer, I acknowledge and agree:

1. I am volunteering of my own free will and receive civic credits as recognition, not wages.
2. I will follow all posted safety rules and staff instructions while on site.
3. I release Riverside Food Bank, its staff, and the City/Sync network from liability for
   ordinary negligence arising out of my volunteer activities, to the extent permitted by law.
4. I grant permission for anonymized records of my participation to appear on the public ledger.
5. This release applies to all opportunities I claim from Riverside Food Bank under this version.

If under 18, a parent or guardian must also review this waiver during in-person onboarding.`,
  })

  const pantry = await createTask({
    orgId: issuer.orgId,
    cityId: BERKELEY_CITY_ID,
    actorId: issuer.userId,
    title: 'Saturday pantry sorting shift',
    description:
      'Sort and shelve incoming donations in the main warehouse. Closed-toe shoes required. Completion = full 3-hour shift, confirmed by the shift lead.',
    location: '41 Main St warehouse',
    credits: 15,
    slots: 6,
    startsAt: '',
  })
  if (!pantry.ok) throw new Error(pantry.error)
  for (let w = 0; w < 3; w++) {
    const start = nextDow(6, 9) + w * 7 * DAY // Saturdays 9am
    await createShift({
      taskId: pantry.id,
      orgId: issuer.orgId,
      actorId: issuer.userId,
      startsAt: start,
      endsAt: start + 3 * 60 * 60 * 1000,
      label: '',
      capacity: 6,
    })
  }
  // A shift happening right now, so on-site check-in is demoable immediately.
  const nowStart = Date.now() - 30 * 60 * 1000
  await createShift({
    taskId: pantry.id,
    orgId: issuer.orgId,
    actorId: issuer.userId,
    startsAt: nowStart,
    endsAt: nowStart + 3 * 60 * 60 * 1000,
    label: 'Happening now (demo)',
    capacity: 6,
  })

  const delivery = await createTask({
    orgId: issuer.orgId,
    cityId: BERKELEY_CITY_ID,
    actorId: issuer.userId,
    title: 'Senior grocery delivery route',
    description:
      'Deliver pre-packed grocery boxes to 8 homebound seniors. Valid driver’s license required. Completion = all deliveries confirmed.',
    location: 'Riverside district',
    credits: 25,
    slots: 3,
    startsAt: '',
  })
  if (!delivery.ok) throw new Error(delivery.error)
  for (const dow of [1, 3]) {
    const start = nextDow(dow, 9) // Mon & Wed 9am
    await createShift({
      taskId: delivery.id,
      orgId: issuer.orgId,
      actorId: issuer.userId,
      startsAt: start,
      endsAt: start + 3 * 60 * 60 * 1000,
      label: '',
      capacity: 3,
    })
  }

  // --- issuer onboarding task + public profile -------------------------------
  const orientation = await createTask({
    orgId: issuer.orgId,
    cityId: BERKELEY_CITY_ID,
    actorId: issuer.userId,
    title: 'New volunteer orientation',
    description:
      'A 45-minute welcome session covering safety, our facilities, and how shifts work. Required once before your first regular shift. New volunteers start here.',
    location: '41 Main St warehouse',
    credits: 5,
    slots: 40,
    startsAt: 'Every Tuesday, 6–6:45pm',
  })
  if (!orientation.ok) throw new Error(orientation.error)
  for (let w = 0; w < 2; w++) {
    const start = nextDow(2, 18) + w * 7 * DAY // Tuesdays 6pm
    await createShift({
      taskId: orientation.id,
      orgId: issuer.orgId,
      actorId: issuer.userId,
      startsAt: start,
      endsAt: start + 45 * 60 * 1000,
      label: '',
      capacity: 40,
    })
  }

  await saveProfile({
    orgId: issuer.orgId,
    actorId: issuer.userId,
    tagline: 'Feeding the Riverside district since 1998',
    mission:
      'Riverside Food Bank has served the Riverside district since 1998. Every week we distribute fresh groceries to more than 400 families and deliver meals to homebound seniors.\n\nWe run entirely on community support. Whether you can give three hours on a Saturday or a weekday morning, there is a place for you here — no experience required.',
    logoUrl: '',
    coverUrl: '',
    website: 'https://riverside-food-bank.example.org',
    contactEmail: 'volunteer@riverside-food-bank.example.org',
    phone: '(555) 014-2200',
    location: 'Riverside District',
    socials: {
      instagram: 'https://instagram.com/riversidefoodbank',
      facebook: 'https://facebook.com/riversidefoodbank',
    },
    causes: ['Food security', 'Seniors', 'Community'],
    onboardingTaskId: orientation.id,
    published: true,
  })

  // --- redeemer org ----------------------------------------------------------
  const redeemer = await registerOrg({
    orgName: 'Metro Transit Authority',
    orgType: 'redeemer',
    description: 'Public transit operator. Civic credit redemption fills off-peak capacity.',
    name: 'James Chen',
    email: 'redeemer@demo.city-sync.org',
    password: 'demo1234',
    cityId: BERKELEY_CITY_ID,
  })
  if (!redeemer.ok) throw new Error(redeemer.error)
  await setOrgStatus(redeemer.orgId, 'approved', adminId)

  await createOffering({
    orgId: redeemer.orgId,
    cityId: BERKELEY_CITY_ID,
    actorId: redeemer.userId,
    title: '10-ride transit pass',
    description: 'Ten rides on any metro bus or light-rail line. Off-peak and peak.',
    cost: 30,
  })
  await createOffering({
    orgId: redeemer.orgId,
    cityId: BERKELEY_CITY_ID,
    actorId: redeemer.userId,
    title: 'Monthly transit pass',
    description: 'Unlimited rides for one calendar month.',
    cost: 90,
  })

  // --- MyCity Feed -----------------------------------------------------------
  await createPost({
    orgId: issuer.orgId,
    actorId: issuer.userId,
    body: 'Welcome to City/Sync! Our Saturday pantry shifts are now live — 15 credits per shift, and every verified hour helps us reach 200 more families this month. 🥫',
  })
  await createPost({
    orgId: redeemer.orgId,
    actorId: redeemer.userId,
    body: 'Metro Transit is proud to be City/Sync’s first redeemer. Your civic credits are good for 10-ride and monthly passes — empty seats become earned rides.',
  })

  // --- participant ----------------------------------------------------------
  const participant = await registerParticipant({
    name: 'Alex Rivera',
    email: 'participant@demo.city-sync.org',
    password: 'demo1234',
    homeCityId: BERKELEY_CITY_ID,
  })
  if (!participant.ok) throw new Error(participant.error)

  console.log(`
✓ Seed complete.

  Admin:        ${ADMIN_EMAIL} / admin-citysync
  Issuer:       issuer@demo.city-sync.org / demo1234     (Riverside Food Bank — approved)
  Redeemer:     redeemer@demo.city-sync.org / demo1234   (Metro Transit Authority — approved)
  Participant:  participant@demo.city-sync.org / demo1234

  3 opportunities with dated shifts (incl. onboarding), 2 offerings, and 1 active liability waiver are live.
  Riverside Food Bank has a published public profile with a featured onboarding task — browse it at /orgs.
`)
  client.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
