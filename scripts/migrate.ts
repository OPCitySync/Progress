/**
 * Schema migration. Plain DDL kept deliberately simple and portable:
 * works identically against a local SQLite file and a remote Turso database.
 * Run: npm run db:migrate
 */
import { randomUUID } from 'crypto'
import { createClient } from '@libsql/client'
import { getCityClient } from '../src/lib/db/city-client'
import { flushAllCityLedgerOutbox } from '../src/lib/ledger/city-outbox'

const client = createClient({
  url: process.env.DATABASE_URL ?? 'file:local.db',
  authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
})

const statements = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    org_id TEXT,
    credit_balance INTEGER NOT NULL DEFAULT 0,
    lifetime_earned INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS orgs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    owner_user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS organization_locations (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    address TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(org_id, address)
  )`,
  `CREATE TABLE IF NOT EXISTS waiver_versions (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    document_url TEXT,
    document_name TEXT,
    document_mime_type TEXT,
    document_sha256 TEXT,
    sha256 TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS waiver_acceptances (
    id TEXT PRIMARY KEY,
    waiver_version_id TEXT NOT NULL,
    org_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    accepted_at INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS waiver_acceptances_user_version
     ON waiver_acceptances (user_id, waiver_version_id)`,
  `CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    credits INTEGER NOT NULL,
    slots INTEGER NOT NULL DEFAULT 1,
    starts_at TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS claims (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    shift_id TEXT,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'claimed',
    note TEXT NOT NULL DEFAULT '',
    checked_in_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS shifts (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    org_id TEXT NOT NULL,
    starts_at INTEGER,
    ends_at INTEGER,
    label TEXT NOT NULL DEFAULT '',
    capacity INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'open',
    check_in_code TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS offerings (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    cost INTEGER NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS redemptions (
    id TEXT PRIMARY KEY,
    offering_id TEXT NOT NULL,
    org_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    cost INTEGER NOT NULL,
    code TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL,
    finalized_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS volunteer_groups (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_by_user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(org_id, name)
  )`,
  `CREATE TABLE IF NOT EXISTS volunteer_group_members (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(group_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS org_messages (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    sender_user_id TEXT NOT NULL,
    scope TEXT NOT NULL,
    task_id TEXT,
    group_id TEXT,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    recipient_count INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS message_recipients (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    read_at INTEGER,
    created_at INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS message_recipients_msg_user
     ON message_recipients (message_id, user_id)`,
  `CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    author_user_id TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS post_hearts (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS post_hearts_post_user ON post_hearts (post_id, user_id)`,
  `CREATE TABLE IF NOT EXISTS events (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    actor_id TEXT,
    ts INTEGER NOT NULL,
    prev_hash TEXT NOT NULL,
    hash TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS city_ledger_outbox (
    event_id TEXT PRIMARY KEY,
    city_id TEXT NOT NULL,
    event_seq INTEGER NOT NULL,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    actor_id TEXT,
    ts INTEGER NOT NULL,
    delivered_at INTEGER,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS anchors (
    id TEXT PRIMARY KEY,
    from_seq INTEGER NOT NULL,
    to_seq INTEGER NOT NULL,
    event_count INTEGER NOT NULL,
    merkle_root TEXT NOT NULL,
    network TEXT NOT NULL,
    tx_hash TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS opportunity_types (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    suggested_min INTEGER,
    suggested_typical INTEGER,
    suggested_max INTEGER,
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS catalog_entries (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    type_id TEXT,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    default_credits INTEGER,
    required_credentials TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'draft',
    review_note TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS credentials (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'verified',
    granted_by_user_id TEXT NOT NULL,
    granted_by_org_id TEXT,
    note TEXT NOT NULL DEFAULT '',
    expires_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    link TEXT NOT NULL DEFAULT '',
    read_at INTEGER,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    shift_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    in_app INTEGER NOT NULL DEFAULT 0,
    email INTEGER NOT NULL DEFAULT 0,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    link TEXT NOT NULL DEFAULT '',
    send_after INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL,
    sent_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS org_profiles (
    org_id TEXT PRIMARY KEY,
    tagline TEXT NOT NULL DEFAULT '',
    mission TEXT NOT NULL DEFAULT '',
    logo_url TEXT NOT NULL DEFAULT '',
    cover_url TEXT NOT NULL DEFAULT '',
    website TEXT NOT NULL DEFAULT '',
    contact_email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    socials TEXT NOT NULL DEFAULT '{}',
    causes TEXT NOT NULL DEFAULT '[]',
    onboarding_task_id TEXT,
    published INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS cities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    join_code TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS city_memberships (
    id TEXT PRIMARY KEY,
    city_id TEXT NOT NULL,
    member_kind TEXT NOT NULL,
    member_id TEXT NOT NULL,
    joined_at INTEGER NOT NULL,
    UNIQUE(city_id, member_kind, member_id)
  )`,
  `CREATE TABLE IF NOT EXISTS city_participant_statuses (
    id TEXT PRIMARY KEY,
    city_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    no_show_count INTEGER NOT NULL DEFAULT 0,
    barred_until INTEGER,
    activated_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(city_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS city_launch_applications (
    id TEXT PRIMARY KEY,
    sponsor_org_id TEXT NOT NULL,
    bootstrap_user_id TEXT NOT NULL,
    created_by_delegation_id TEXT NOT NULL,
    city_name TEXT NOT NULL,
    city_slug TEXT NOT NULL,
    city_description TEXT NOT NULL DEFAULT '',
    proposed_owner_name TEXT NOT NULL,
    proposed_owner_email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'submitted',
    city_id TEXT,
    local_org_id TEXT,
    ownership_code_hash TEXT,
    ownership_expires_at INTEGER,
    ownership_accepted_at INTEGER,
    owner_user_id TEXT,
    reviewer_note TEXT NOT NULL DEFAULT '',
    approved_by_user_id TEXT,
    created_at INTEGER NOT NULL,
    reviewed_at INTEGER,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS identities (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    org_id TEXT,
    kind TEXT NOT NULL,
    address TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS organization_delegations (
    id TEXT PRIMARY KEY,
    identity_id TEXT NOT NULL UNIQUE,
    role_id TEXT,
    user_id TEXT NOT NULL,
    org_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    capabilities TEXT NOT NULL DEFAULT '[]',
    city_ids TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'active',
    granted_by_user_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revoked_at INTEGER,
    UNIQUE(user_id, org_id)
  )`,
  `CREATE TABLE IF NOT EXISTS organization_roles (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    tier_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    permissions TEXT NOT NULL DEFAULT '[]',
    is_owner_role INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(org_id, tier_number)
  )`,
  `CREATE TABLE IF NOT EXISTS organization_invites (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    role_id TEXT,
    code_hash TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'member',
    capabilities TEXT NOT NULL DEFAULT '[]',
    city_ids TEXT NOT NULL DEFAULT '[]',
    max_uses INTEGER NOT NULL DEFAULT 1,
    uses INTEGER NOT NULL DEFAULT 0,
    issued_by_delegation_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    revoked_at INTEGER,
    created_at INTEGER NOT NULL
  )`,
]

// Additive column migrations for databases created before these columns existed.
// SQLite has no ADD COLUMN IF NOT EXISTS; failures for existing columns are expected.
const columnMigrations = [
  `ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`,
  `ALTER TABLE orgs ADD COLUMN slug TEXT`,
  `ALTER TABLE org_profiles ADD COLUMN mission TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE org_profiles ADD COLUMN onboarding_task_id TEXT`,
  `ALTER TABLE claims ADD COLUMN shift_id TEXT`,
  `ALTER TABLE claims ADD COLUMN checked_in_at INTEGER`,
  `ALTER TABLE shifts ADD COLUMN check_in_code TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE tasks ADD COLUMN required_credentials TEXT NOT NULL DEFAULT '[]'`,
  `ALTER TABLE users ADD COLUMN interests TEXT NOT NULL DEFAULT '[]'`,
  `ALTER TABLE users ADD COLUMN neighborhood TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE users ADD COLUMN resume_token TEXT`,
  `ALTER TABLE users ADD COLUMN resume_public INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE tasks ADD COLUMN catalog_entry_id TEXT`,
  `ALTER TABLE users ADD COLUMN home_city_id TEXT`,
  `ALTER TABLE orgs ADD COLUMN requested_city_id TEXT`,
  `ALTER TABLE orgs ADD COLUMN parent_org_id TEXT`,
  `ALTER TABLE tasks ADD COLUMN city_id TEXT NOT NULL DEFAULT 'berkeley'`,
  `ALTER TABLE claims ADD COLUMN no_show_at INTEGER`,
  `ALTER TABLE offerings ADD COLUMN city_id TEXT NOT NULL DEFAULT 'berkeley'`,
  `ALTER TABLE redemptions ADD COLUMN city_id TEXT NOT NULL DEFAULT 'berkeley'`,
  `ALTER TABLE users ADD COLUMN username TEXT`,
  `ALTER TABLE users ADD COLUMN avatar_url TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE organization_delegations ADD COLUMN role_id TEXT`,
  `ALTER TABLE organization_invites ADD COLUMN role_id TEXT`,
  `ALTER TABLE org_messages ADD COLUMN group_id TEXT`,
  `ALTER TABLE waiver_versions ADD COLUMN document_url TEXT`,
  `ALTER TABLE waiver_versions ADD COLUMN document_name TEXT`,
  `ALTER TABLE waiver_versions ADD COLUMN document_mime_type TEXT`,
  `ALTER TABLE waiver_versions ADD COLUMN document_sha256 TEXT`,
]

const indexes = [
  // Unique handle per org. SQLite treats multiple NULLs as distinct, so this
  // is safe before the slug backfill runs.
  `CREATE UNIQUE INDEX IF NOT EXISTS orgs_slug ON orgs (slug)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS organization_locations_org_address ON organization_locations (org_id, address)`,
  `CREATE INDEX IF NOT EXISTS organization_locations_org ON organization_locations (org_id, is_default)`,
  `CREATE INDEX IF NOT EXISTS shifts_task ON shifts (task_id)`,
  // A volunteer claims a specific shift now, not a task — replace the old
  // (task_id,user_id) uniqueness with (shift_id,user_id). Multiple NULL
  // shift_ids are distinct in SQLite, so this is safe before the backfill.
  `DROP INDEX IF EXISTS claims_task_user`,
  `CREATE UNIQUE INDEX IF NOT EXISTS claims_shift_user ON claims (shift_id, user_id)`,
  `CREATE INDEX IF NOT EXISTS notifications_user ON notifications (user_id)`,
  `CREATE INDEX IF NOT EXISTS reminders_due ON reminders (status, send_after)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS credentials_user_type ON credentials (user_id, type)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS volunteer_groups_org_name ON volunteer_groups (org_id, name)`,
  `CREATE INDEX IF NOT EXISTS volunteer_groups_org ON volunteer_groups (org_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS volunteer_group_members_group_user ON volunteer_group_members (group_id, user_id)`,
  `CREATE INDEX IF NOT EXISTS volunteer_group_members_group ON volunteer_group_members (group_id)`,
  `CREATE INDEX IF NOT EXISTS volunteer_group_members_user ON volunteer_group_members (user_id)`,
  `CREATE INDEX IF NOT EXISTS org_messages_group ON org_messages (group_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_resume_token ON users (resume_token)`,
  `CREATE INDEX IF NOT EXISTS catalog_entries_org ON catalog_entries (org_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS cities_slug ON cities (slug)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS cities_join_code ON cities (join_code)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS city_memberships_city_member ON city_memberships (city_id, member_kind, member_id)`,
  `CREATE INDEX IF NOT EXISTS city_memberships_member ON city_memberships (member_kind, member_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS city_participant_statuses_city_user ON city_participant_statuses (city_id, user_id)`,
  `CREATE INDEX IF NOT EXISTS city_participant_statuses_user ON city_participant_statuses (user_id)`,
  `CREATE INDEX IF NOT EXISTS tasks_city ON tasks (city_id)`,
  `CREATE INDEX IF NOT EXISTS offerings_city ON offerings (city_id)`,
  `CREATE INDEX IF NOT EXISTS redemptions_city ON redemptions (city_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_username ON users (username)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS identities_address ON identities (address)`,
  `CREATE INDEX IF NOT EXISTS identities_user ON identities (user_id)`,
  `CREATE INDEX IF NOT EXISTS identities_org ON identities (org_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS identities_participant_user ON identities (user_id) WHERE kind = 'participant'`,
  `CREATE UNIQUE INDEX IF NOT EXISTS identities_organization_org ON identities (org_id) WHERE kind = 'organization'`,
  `CREATE UNIQUE INDEX IF NOT EXISTS organization_delegations_identity ON organization_delegations (identity_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS organization_delegations_user_org ON organization_delegations (user_id, org_id)`,
  `CREATE INDEX IF NOT EXISTS organization_delegations_org ON organization_delegations (org_id)`,
  `CREATE INDEX IF NOT EXISTS organization_delegations_user ON organization_delegations (user_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS organization_roles_org_tier ON organization_roles (org_id, tier_number)`,
  `CREATE INDEX IF NOT EXISTS organization_roles_org ON organization_roles (org_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS organization_invites_code_hash ON organization_invites (code_hash)`,
  `CREATE INDEX IF NOT EXISTS organization_invites_org ON organization_invites (org_id)`,
  `CREATE INDEX IF NOT EXISTS city_launch_applications_sponsor ON city_launch_applications (sponsor_org_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS city_launch_applications_status ON city_launch_applications (status, created_at)`,
  `CREATE INDEX IF NOT EXISTS city_launch_applications_slug ON city_launch_applications (city_slug)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS city_launch_applications_claim_code ON city_launch_applications (ownership_code_hash)`,
  `CREATE INDEX IF NOT EXISTS city_ledger_outbox_pending_city ON city_ledger_outbox (city_id, delivered_at, event_seq)`,
]

const INITIAL_CITIES = [
  {
    id: 'berkeley',
    name: 'Berkeley',
    slug: 'berkeley',
    description: 'The Berkeley City/Sync civic network.',
    joinCode: 'BERKELEY',
  },
  {
    id: 'mexico-city',
    name: 'Mexico City',
    slug: 'mexico-city',
    description: 'The Mexico City City/Sync civic network.',
    joinCode: 'MEXICOCITY',
  },
] as const

/** Seed Berkeley and Mexico City, then move pre-city data into Berkeley. */
async function ensureInitialCityData() {
  const now = Date.now()
  for (const city of INITIAL_CITIES) {
    await client.execute({
      sql: `INSERT OR IGNORE INTO cities (id, name, slug, description, join_code, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [city.id, city.name, city.slug, city.description, city.joinCode, now],
    })
  }

  // Earlier builds used City/Sync as a city. The brand remains City/Sync, but
  // the historic demo network belongs to Berkeley now.
  await client.execute(`UPDATE OR IGNORE city_memberships SET city_id = 'berkeley' WHERE city_id = 'citysync'`)
  await client.execute(`DELETE FROM cities WHERE id = 'citysync'`)
  await client.execute(`UPDATE tasks SET city_id = 'berkeley' WHERE city_id IS NULL OR city_id = ''`)
  await client.execute(`UPDATE users SET home_city_id = 'berkeley' WHERE home_city_id IS NULL OR home_city_id = ''`)

  let created = 0
  const userRows = await client.execute(`SELECT id FROM users`)
  for (const user of userRows.rows) {
    const result = await client.execute({
      sql: `INSERT OR IGNORE INTO city_memberships (id, city_id, member_kind, member_id, joined_at) VALUES (?, ?, 'user', ?, ?)`,
      args: [randomUUID(), 'berkeley', String(user.id), now],
    })
    created += Number(result.rowsAffected ?? 0)
  }
  const orgRows = await client.execute(`SELECT id FROM orgs`)
  for (const org of orgRows.rows) {
    const result = await client.execute({
      sql: `INSERT OR IGNORE INTO city_memberships (id, city_id, member_kind, member_id, joined_at) VALUES (?, ?, 'organization', ?, ?)`,
      args: [randomUUID(), 'berkeley', String(org.id), now],
    })
    created += Number(result.rowsAffected ?? 0)
  }

  const participantRows = await client.execute(
    `SELECT city_id, member_id FROM city_memberships WHERE member_kind = 'user'`,
  )
  let statuses = 0
  for (const membership of participantRows.rows) {
    const cityId = String(membership.city_id)
    const userId = String(membership.member_id)
    const attendance = await client.execute({
      sql: `SELECT 1 FROM claims INNER JOIN tasks ON tasks.id = claims.task_id
            WHERE claims.user_id = ? AND tasks.city_id = ?
              AND (claims.checked_in_at IS NOT NULL OR claims.status = 'verified') LIMIT 1`,
      args: [userId, cityId],
    })
    const active = attendance.rows.length > 0
    const result = await client.execute({
      sql: `INSERT OR IGNORE INTO city_participant_statuses
            (id, city_id, user_id, status, no_show_count, barred_until, activated_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, 0, NULL, ?, ?, ?)`,
      args: [randomUUID(), cityId, userId, active ? 'active' : 'new', active ? now : null, now, now],
    })
    statuses += Number(result.rowsAffected ?? 0)
  }
  return { memberships: created, statuses }
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'org'
  )
}

/** Give every org without a slug a unique, URL-safe handle derived from its name. */
async function backfillSlugs() {
  const rows = await client.execute(`SELECT id, name, slug FROM orgs`)
  const taken = new Set<string>()
  for (const r of rows.rows) {
    const slug = r.slug as string | null
    if (slug) taken.add(slug)
  }
  let filled = 0
  for (const r of rows.rows) {
    if (r.slug) continue
    const base = slugify(String(r.name))
    let candidate = base
    let n = 2
    while (taken.has(candidate)) candidate = `${base}-${n++}`
    taken.add(candidate)
    await client.execute({ sql: `UPDATE orgs SET slug = ? WHERE id = ?`, args: [candidate, String(r.id)] })
    filled++
  }
  return filled
}

/**
 * Preserve existing issuer locations as reusable location choices. A saved
 * public-profile location wins as the default; otherwise the first historic
 * catalog or task location becomes the default for that organization.
 */
async function backfillOrganizationLocations() {
  const now = Date.now()
  const [profileRows, catalogRows, taskRows] = await Promise.all([
    client.execute(`SELECT org_id, location FROM org_profiles WHERE trim(location) != '' ORDER BY updated_at, org_id`),
    client.execute(`SELECT org_id, location FROM catalog_entries WHERE trim(location) != '' ORDER BY created_at, org_id`),
    client.execute(`SELECT org_id, location FROM tasks WHERE trim(location) != '' ORDER BY created_at, org_id`),
  ])

  let saved = 0
  let defaults = 0
  const hasDefault = new Set<string>()

  async function remember(orgIdRaw: unknown, locationRaw: unknown, preferDefault: boolean) {
    const orgId = String(orgIdRaw)
    const address = String(locationRaw).trim().replace(/\s+/g, ' ')
    if (!orgId || !address) return

    if (!hasDefault.has(orgId)) {
      const existing = await client.execute({
        sql: `SELECT id FROM organization_locations WHERE org_id = ? AND is_default = 1 LIMIT 1`,
        args: [orgId],
      })
      if (existing.rows.length > 0) hasDefault.add(orgId)
    }
    const makeDefault = preferDefault || !hasDefault.has(orgId)
    if (makeDefault) {
      await client.execute({
        sql: `UPDATE organization_locations SET is_default = 0, updated_at = ? WHERE org_id = ?`,
        args: [now, orgId],
      })
    }
    const result = await client.execute({
      sql: `INSERT OR IGNORE INTO organization_locations (id, org_id, address, is_default, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [randomUUID(), orgId, address, makeDefault ? 1 : 0, now, now],
    })
    saved += Number(result.rowsAffected ?? 0)
    if (makeDefault) {
      await client.execute({
        sql: `UPDATE organization_locations SET is_default = 1, updated_at = ? WHERE org_id = ? AND address = ?`,
        args: [now, orgId, address],
      })
      hasDefault.add(orgId)
      defaults++
    }
  }

  for (const row of profileRows.rows) await remember(row.org_id, row.location, true)
  for (const row of catalogRows.rows) await remember(row.org_id, row.location, false)
  for (const row of taskRows.rows) await remember(row.org_id, row.location, false)
  return { saved, defaults }
}

// Unambiguous code alphabet (no 0/O/1/I).
function shiftCode(): string {
  const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)]
  return s
}

function identityAddress(kind: 'participant' | 'organization' | 'authority'): string {
  const prefix = kind === 'participant' ? 'person' : kind === 'organization' ? 'org' : 'authority'
  return `cs:${prefix}:${randomUUID().replace(/-/g, '')}`
}

/**
 * Establish the new identity graph without changing existing user ids or
 * organization records. Every person receives a personal participant identity;
 * every organization receives its own identity; historic issuer users retain
 * their existing access as owner/manager delegations.
 */
async function backfillIdentityGraph() {
  const now = Date.now()
  let identitiesCreated = 0
  let delegationsCreated = 0

  const people = await client.execute(`SELECT id FROM users`)
  for (const person of people.rows) {
    const userId = String(person.id)
    const existing = await client.execute({
      sql: `SELECT id FROM identities WHERE user_id = ? AND kind = 'participant' LIMIT 1`,
      args: [userId],
    })
    if (existing.rows.length === 0) {
      const result = await client.execute({
        sql: `INSERT INTO identities (id, user_id, org_id, kind, address, status, created_at) VALUES (?, ?, NULL, 'participant', ?, 'active', ?)`,
        args: [randomUUID(), userId, identityAddress('participant'), now],
      })
      identitiesCreated += Number(result.rowsAffected ?? 0)
    }
  }

  const organizations = await client.execute(`SELECT id, owner_user_id FROM orgs`)
  for (const organization of organizations.rows) {
    const orgId = String(organization.id)
    const existing = await client.execute({
      sql: `SELECT id FROM identities WHERE org_id = ? AND kind = 'organization' LIMIT 1`,
      args: [orgId],
    })
    if (existing.rows.length === 0) {
      const result = await client.execute({
        sql: `INSERT INTO identities (id, user_id, org_id, kind, address, status, created_at) VALUES (?, NULL, ?, 'organization', ?, 'active', ?)`,
        args: [randomUUID(), orgId, identityAddress('organization'), now],
      })
      identitiesCreated += Number(result.rowsAffected ?? 0)
    }

    const ownerId = String(organization.owner_user_id)
    const ownerDelegation = await client.execute({
      sql: `SELECT id FROM organization_delegations WHERE user_id = ? AND org_id = ? LIMIT 1`,
      args: [ownerId, orgId],
    })
    if (ownerDelegation.rows.length === 0) {
      const authorityId = randomUUID()
      await client.execute({
        sql: `INSERT INTO identities (id, user_id, org_id, kind, address, status, created_at) VALUES (?, ?, ?, 'authority', ?, 'active', ?)`,
        args: [authorityId, ownerId, orgId, identityAddress('authority'), now],
      })
      const result = await client.execute({
        sql: `INSERT INTO organization_delegations
              (id, identity_id, user_id, org_id, role, capabilities, city_ids, status, granted_by_user_id, created_at, updated_at, revoked_at)
              VALUES (?, ?, ?, ?, 'owner', '[\"*\"]', '[]', 'active', ?, ?, ?, NULL)`,
        args: [randomUUID(), authorityId, ownerId, orgId, ownerId, now, now],
      })
      identitiesCreated++
      delegationsCreated += Number(result.rowsAffected ?? 0)
    }
  }

  // Older builds put issuer/redeemer context directly on a person. Preserve
  // any such relationship as a separate manager delegation.
  const legacyAuthorities = await client.execute(
    `SELECT id, org_id FROM users WHERE org_id IS NOT NULL AND org_id != ''`,
  )
  for (const row of legacyAuthorities.rows) {
    const userId = String(row.id)
    const orgId = String(row.org_id)
    const existing = await client.execute({
      sql: `SELECT id FROM organization_delegations WHERE user_id = ? AND org_id = ? LIMIT 1`,
      args: [userId, orgId],
    })
    if (existing.rows.length > 0) continue
    const authorityId = randomUUID()
    await client.execute({
      sql: `INSERT INTO identities (id, user_id, org_id, kind, address, status, created_at) VALUES (?, ?, ?, 'authority', ?, 'active', ?)`,
      args: [authorityId, userId, orgId, identityAddress('authority'), now],
    })
    const result = await client.execute({
      sql: `INSERT INTO organization_delegations
            (id, identity_id, user_id, org_id, role, capabilities, city_ids, status, granted_by_user_id, created_at, updated_at, revoked_at)
            VALUES (?, ?, ?, ?, 'manager', '[\"org:operate\"]', '[]', 'active', NULL, ?, ?, NULL)`,
      args: [randomUUID(), authorityId, userId, orgId, now, now],
    })
    identitiesCreated++
    delegationsCreated += Number(result.rowsAffected ?? 0)
  }

  return { identitiesCreated, delegationsCreated }
}

/** Seed the owner role and retire the former built-in Tier 1 role. */
async function backfillOrganizationRoles() {
  const now = Date.now()
  const standardPermissions = JSON.stringify([
    'opportunities.manage',
    'participants.manage',
    'waiver.manage',
    'profile.manage',
    'reports.view',
    'feed.manage',
    'offerings.manage',
  ])
  const organizations = await client.execute(`SELECT id FROM orgs`)
  let rolesCreated = 0
  let assignments = 0
  let defaultsRemoved = 0

  for (const row of organizations.rows) {
    const orgId = String(row.id)
    const ownerRole = await client.execute({
      sql: `SELECT id FROM organization_roles WHERE org_id = ? AND is_owner_role = 1 LIMIT 1`,
      args: [orgId],
    })
    let ownerId: string
    if (ownerRole.rows.length === 0) {
      const id = randomUUID()
      const result = await client.execute({
        sql: `INSERT INTO organization_roles (id, org_id, tier_number, name, permissions, is_owner_role, created_at, updated_at)
              VALUES (?, ?, 0, 'Owner', '[\"*\"]', 1, ?, ?)`,
        args: [id, orgId, now, now],
      })
      rolesCreated += Number(result.rowsAffected ?? 0)
      ownerId = id
    } else {
      ownerId = String(ownerRole.rows[0].id)
    }

    const tierOne = await client.execute({
      sql: `SELECT id FROM organization_roles WHERE org_id = ? AND tier_number = 1 AND name = 'Tier 1' AND is_owner_role = 0 LIMIT 1`,
      args: [orgId],
    })
    if (tierOne.rows.length > 0) {
      const tierOneId = String(tierOne.rows[0].id)
      const references = await client.execute({
        sql: `SELECT
                (SELECT COUNT(*) FROM organization_delegations WHERE role_id = ?) +
                (SELECT COUNT(*) FROM organization_invites WHERE role_id = ?) AS count`,
        args: [tierOneId, tierOneId],
      })
      if (Number(references.rows[0]?.count ?? 0) === 0) {
        const result = await client.execute({ sql: `DELETE FROM organization_roles WHERE id = ?`, args: [tierOneId] })
        defaultsRemoved += Number(result.rowsAffected ?? 0)
      } else {
        await client.execute({
          sql: `UPDATE organization_roles SET name = 'Existing Role', updated_at = ? WHERE id = ?`,
          args: [now, tierOneId],
        })
      }
    }

    const ownerAssignment = await client.execute({
      sql: `UPDATE organization_delegations SET role_id = ? WHERE org_id = ? AND role = 'owner' AND (role_id IS NULL OR role_id = '')`,
      args: [ownerId, orgId],
    })
    const unassignedDelegations = await client.execute({
      sql: `SELECT COUNT(*) AS count FROM organization_delegations WHERE org_id = ? AND role != 'owner' AND (role_id IS NULL OR role_id = '')`,
      args: [orgId],
    })
    const unassignedInvites = await client.execute({
      sql: `SELECT COUNT(*) AS count FROM organization_invites WHERE org_id = ? AND (role_id IS NULL OR role_id = '')`,
      args: [orgId],
    })
    const missingAssignments = Number(unassignedDelegations.rows[0]?.count ?? 0) + Number(unassignedInvites.rows[0]?.count ?? 0)
    let preservedRoleId: string | null = null
    if (missingAssignments > 0) {
      const existingRole = await client.execute({
        sql: `SELECT id FROM organization_roles WHERE org_id = ? AND is_owner_role = 0 ORDER BY tier_number LIMIT 1`,
        args: [orgId],
      })
      if (existingRole.rows.length > 0) {
        preservedRoleId = String(existingRole.rows[0].id)
      } else {
        preservedRoleId = randomUUID()
        const result = await client.execute({
          sql: `INSERT INTO organization_roles (id, org_id, tier_number, name, permissions, is_owner_role, created_at, updated_at)
                VALUES (?, ?, 1, 'Existing Role', ?, 0, ?, ?)`,
          args: [preservedRoleId, orgId, standardPermissions, now, now],
        })
        rolesCreated += Number(result.rowsAffected ?? 0)
      }
    }
    const memberAssignment = preservedRoleId ? await client.execute({
      sql: `UPDATE organization_delegations SET role_id = ? WHERE org_id = ? AND role != 'owner' AND (role_id IS NULL OR role_id = '')`,
      args: [preservedRoleId, orgId],
    }) : { rowsAffected: 0 }
    const inviteAssignment = preservedRoleId ? await client.execute({
      sql: `UPDATE organization_invites SET role_id = ? WHERE org_id = ? AND (role_id IS NULL OR role_id = '')`,
      args: [preservedRoleId, orgId],
    }) : { rowsAffected: 0 }
    assignments += Number(ownerAssignment.rowsAffected ?? 0) + Number(memberAssignment.rowsAffected ?? 0) + Number(inviteAssignment.rowsAffected ?? 0)
  }
  return { rolesCreated, assignments, defaultsRemoved }
}

/** Give any shift missing a check-in code one. Idempotent. */
async function backfillCheckInCodes() {
  const rows = await client.execute(`SELECT id FROM shifts WHERE check_in_code IS NULL OR check_in_code = ''`)
  for (const r of rows.rows) {
    await client.execute({ sql: `UPDATE shifts SET check_in_code = ? WHERE id = ?`, args: [shiftCode(), String(r.id)] })
  }
  return rows.rows.length
}

/**
 * Give every pre-scheduling task a single shift derived from its legacy fields,
 * and point its existing claims at that shift. Idempotent.
 */
async function backfillShifts() {
  const tasksRows = await client.execute(`SELECT id, org_id, slots, starts_at, status, created_at FROM tasks`)
  let created = 0
  let linked = 0
  for (const t of tasksRows.rows) {
    const taskId = String(t.id)
    const existing = await client.execute({ sql: `SELECT id FROM shifts WHERE task_id = ? LIMIT 1`, args: [taskId] })
    let shiftId: string
    if (existing.rows.length > 0) {
      shiftId = String(existing.rows[0].id)
    } else {
      shiftId = randomUUID()
      await client.execute({
        sql: `INSERT INTO shifts (id, task_id, org_id, starts_at, ends_at, label, capacity, status, check_in_code, created_at)
              VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?)`,
        args: [
          shiftId,
          taskId,
          String(t.org_id),
          String(t.starts_at ?? ''),
          Number(t.slots ?? 1),
          String(t.status ?? 'open'),
          shiftCode(),
          Number(t.created_at ?? Date.now()),
        ],
      })
      created++
    }
    const res = await client.execute({
      sql: `UPDATE claims SET shift_id = ? WHERE task_id = ? AND (shift_id IS NULL OR shift_id = '')`,
      args: [shiftId, taskId],
    })
    linked += Number(res.rowsAffected ?? 0)
  }
  return { created, linked }
}

const cityStatements = [
  `CREATE TABLE IF NOT EXISTS city_meta (
    city_id TEXT PRIMARY KEY,
    schema_version INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS wallets (
    user_id TEXT PRIMARY KEY,
    credit_balance INTEGER NOT NULL DEFAULT 0,
    lifetime_earned INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS credit_entries (
    id TEXT PRIMARY KEY,
    ref_id TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    kind TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS credit_entries_user ON credit_entries (user_id)`,
  `CREATE TABLE IF NOT EXISTS events (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    actor_id TEXT,
    ts INTEGER NOT NULL,
    prev_hash TEXT NOT NULL,
    hash TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS anchors (
    id TEXT PRIMARY KEY,
    from_seq INTEGER NOT NULL,
    to_seq INTEGER NOT NULL,
    event_count INTEGER NOT NULL,
    merkle_root TEXT NOT NULL,
    network TEXT NOT NULL,
    tx_hash TEXT,
    created_at INTEGER NOT NULL
  )`,
]

/**
 * Provision one physical database per city. The control database never
 * receives city-wallet or city-ledger writes after this migration.
 */
async function ensureCityFinanceDatabases() {
  const now = Date.now()
  for (const city of INITIAL_CITIES) {
    const cityClient = getCityClient(city.id)
    for (const statement of cityStatements) await cityClient.execute(statement)
    await cityClient.execute({
      sql: `INSERT OR IGNORE INTO city_meta (city_id, schema_version, created_at) VALUES (?, 1, ?)`,
      args: [city.id, now],
    })
  }

  // All pre-isolation balances belonged to Berkeley. Seed its independent
  // wallets once; ledger history itself is backfilled through the durable
  // city-ledger outbox below so it gets a valid city-local hash chain.
  const berkeley = getCityClient('berkeley')
  const wallets = await client.execute(`SELECT id, credit_balance, lifetime_earned FROM users`)
  let walletCount = 0
  let legacyEntries = 0
  for (const user of wallets.rows) {
    const userId = String(user.id)
    const balance = Number(user.credit_balance ?? 0)
    const earned = Number(user.lifetime_earned ?? 0)
    const result = await berkeley.execute({
      sql: `INSERT OR IGNORE INTO wallets (user_id, credit_balance, lifetime_earned, updated_at) VALUES (?, ?, ?, ?)`,
      args: [userId, balance, earned, now],
    })
    walletCount += Number(result.rowsAffected ?? 0)
    // Give pre-isolation balances an auditable opening entry so the city
    // finance totals remain internally consistent after the migration.
    const openingMint = Math.max(balance, earned)
    if (openingMint > 0) {
      const mint = await berkeley.execute({
        sql: `INSERT OR IGNORE INTO credit_entries (id, ref_id, user_id, amount, kind, reason, created_at) VALUES (?, ?, ?, ?, 'mint', 'legacy_city_wallet_opening', ?)`,
        args: [randomUUID(), `legacy-mint:${userId}`, userId, openingMint, now],
      })
      legacyEntries += Number(mint.rowsAffected ?? 0)
      if (openingMint > balance) {
        const burn = await berkeley.execute({
          sql: `INSERT OR IGNORE INTO credit_entries (id, ref_id, user_id, amount, kind, reason, created_at) VALUES (?, ?, ?, ?, 'burn', 'legacy_city_wallet_reconciliation', ?)`,
          args: [randomUUID(), `legacy-burn:${userId}`, userId, openingMint - balance, now],
        })
        legacyEntries += Number(burn.rowsAffected ?? 0)
      }
    }
  }

  return { walletCount, legacyEntries }
}

function cityIdFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const cityId = (payload as Record<string, unknown>).cityId
  return typeof cityId === 'string' && cityId ? cityId : null
}

/**
 * Earlier versions wrote all events only to the control ledger. Build one
 * city-scoped outbox record for every such legacy event without copying the
 * control chain into a city database. Existing city copies are left alone.
 */
async function backfillLegacyCityLedgerOutbox() {
  const [taskRows, offeringRows, redemptionRows, orgRows, userRows, eventRows] = await Promise.all([
    client.execute(`SELECT id, city_id FROM tasks`),
    client.execute(`SELECT id, city_id FROM offerings`),
    client.execute(`SELECT id, city_id FROM redemptions`),
    client.execute(`SELECT id, requested_city_id FROM orgs`),
    client.execute(`SELECT id, home_city_id FROM users`),
    client.execute(`SELECT seq, id, type, payload, actor_id, ts FROM events ORDER BY seq`),
  ])

  const taskCities = new Map(taskRows.rows.map((row) => [String(row.id), String(row.city_id || 'berkeley')]))
  const offeringCities = new Map(offeringRows.rows.map((row) => [String(row.id), String(row.city_id || 'berkeley')]))
  const redemptionCities = new Map(redemptionRows.rows.map((row) => [String(row.id), String(row.city_id || 'berkeley')]))
  const orgCities = new Map(orgRows.rows.map((row) => [String(row.id), String(row.requested_city_id || 'berkeley')]))
  const userCities = new Map(userRows.rows.map((row) => [String(row.id), String(row.home_city_id || 'berkeley')]))
  const knownCityEventIds = new Map<string, Set<string>>()
  let queued = 0

  for (const event of eventRows.rows) {
    let payload: Record<string, unknown> = {}
    try {
      const parsed: unknown = JSON.parse(String(event.payload))
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) payload = parsed as Record<string, unknown>
    } catch {
      // The original hash chain remains authoritative. Preserve malformed
      // historical JSON in the control ledger but do not create an
      // undeliverable city event.
      continue
    }

    const cityId =
      cityIdFromPayload(payload) ??
      (typeof payload.taskId === 'string' ? taskCities.get(payload.taskId) : null) ??
      (typeof payload.offeringId === 'string' ? offeringCities.get(payload.offeringId) : null) ??
      (typeof payload.redemptionId === 'string' ? redemptionCities.get(payload.redemptionId) : null) ??
      (typeof payload.orgId === 'string' ? orgCities.get(payload.orgId) : null) ??
      (event.actor_id ? userCities.get(String(event.actor_id)) : null) ??
      'berkeley'

    let cityEvents = knownCityEventIds.get(cityId)
    if (!cityEvents) {
      const rows = await getCityClient(cityId).execute(`SELECT id FROM events`)
      cityEvents = new Set(rows.rows.map((row) => String(row.id)))
      knownCityEventIds.set(cityId, cityEvents)
    }
    if (cityEvents.has(String(event.id))) continue

    const result = await client.execute({
      sql: `INSERT OR IGNORE INTO city_ledger_outbox
              (event_id, city_id, event_seq, type, payload, actor_id, ts, delivered_at, attempts, last_error, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0, NULL, ?)`,
      args: [
        String(event.id),
        cityId,
        Number(event.seq),
        String(event.type),
        String(event.payload),
        event.actor_id === null ? null : String(event.actor_id),
        Number(event.ts),
        Number(event.ts),
      ],
    })
    queued += Number(result.rowsAffected ?? 0)
  }

  return queued
}

async function main() {
  for (const sql of statements) {
    await client.execute(sql)
  }
  for (const sql of columnMigrations) {
    try {
      await client.execute(sql)
    } catch {
      /* column already exists */
    }
  }
  for (const sql of indexes) {
    await client.execute(sql)
  }
  const filled = await backfillSlugs()
  const organizationLocations = await backfillOrganizationLocations()
  const shiftRes = await backfillShifts()
  const codes = await backfillCheckInCodes()
  const cityData = await ensureInitialCityData()
  const identityGraph = await backfillIdentityGraph()
  const organizationRoles = await backfillOrganizationRoles()
  const cityFinance = await ensureCityFinanceDatabases()
  const legacyOutbox = await backfillLegacyCityLedgerOutbox()
  const delivery = await flushAllCityLedgerOutbox()
  console.log(
    `✓ Schema ready (${statements.length} statements + ${columnMigrations.length} column checks + ${indexes.length} indexes; ` +
      `${filled} org slug(s) backfilled; ${organizationLocations.saved} organization location(s) saved (${organizationLocations.defaults} default(s)); ${shiftRes.created} shift(s) created, ${shiftRes.linked} claim(s) linked; ${codes} check-in code(s) set; ${cityData.memberships} city membership(s) and ${cityData.statuses} participant status record(s) added; ${cityFinance.walletCount} city wallet(s), ${cityFinance.legacyEntries} opening ledger entry/entries, ${legacyOutbox} legacy city-ledger event(s) queued)`,
  )
  console.log(`✓ City ledger delivery ready (${delivery.map((result) => `${result.cityId}: ${result.delivered} delivered${result.pending ? `, ${result.pending} pending` : ''}${result.failed ? ' (retrying)' : ''}`).join('; ') || 'no pending events'})`)
  console.log(`✓ Identity graph ready (${identityGraph.identitiesCreated} identity record(s), ${identityGraph.delegationsCreated} delegation(s) backfilled)`)
  console.log(`✓ Organization roles ready (${organizationRoles.rolesCreated} role(s), ${organizationRoles.defaultsRemoved} built-in role(s) removed, ${organizationRoles.assignments} delegation/invite assignment(s) backfilled)`)
  client.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
