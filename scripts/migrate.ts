/**
 * Schema migration. Plain DDL kept deliberately simple and portable:
 * works identically against a local SQLite file and a remote Turso database.
 * Run: npm run db:migrate
 */
import { randomUUID } from 'crypto'
import { createClient } from '@libsql/client'

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
  `CREATE TABLE IF NOT EXISTS waiver_versions (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
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
  `CREATE TABLE IF NOT EXISTS org_messages (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    sender_user_id TEXT NOT NULL,
    scope TEXT NOT NULL,
    task_id TEXT,
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
]

const indexes = [
  // Unique handle per org. SQLite treats multiple NULLs as distinct, so this
  // is safe before the slug backfill runs.
  `CREATE UNIQUE INDEX IF NOT EXISTS orgs_slug ON orgs (slug)`,
  `CREATE INDEX IF NOT EXISTS shifts_task ON shifts (task_id)`,
  // A volunteer claims a specific shift now, not a task — replace the old
  // (task_id,user_id) uniqueness with (shift_id,user_id). Multiple NULL
  // shift_ids are distinct in SQLite, so this is safe before the backfill.
  `DROP INDEX IF EXISTS claims_task_user`,
  `CREATE UNIQUE INDEX IF NOT EXISTS claims_shift_user ON claims (shift_id, user_id)`,
  `CREATE INDEX IF NOT EXISTS notifications_user ON notifications (user_id)`,
  `CREATE INDEX IF NOT EXISTS reminders_due ON reminders (status, send_after)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS credentials_user_type ON credentials (user_id, type)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_resume_token ON users (resume_token)`,
  `CREATE INDEX IF NOT EXISTS catalog_entries_org ON catalog_entries (org_id)`,
]

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

// Unambiguous code alphabet (no 0/O/1/I).
function shiftCode(): string {
  const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)]
  return s
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
  const shiftRes = await backfillShifts()
  const codes = await backfillCheckInCodes()
  console.log(
    `✓ Schema ready (${statements.length} statements + ${columnMigrations.length} column checks + ${indexes.length} indexes; ` +
      `${filled} org slug(s) backfilled; ${shiftRes.created} shift(s) created, ${shiftRes.linked} claim(s) linked; ${codes} check-in code(s) set)`,
  )
  client.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
