import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core'

// ---------------------------------------------------------------------------
// Projection tables. Current state, always derivable from the event log.
// Table/field naming intentionally mirrors the City::Sync contract suite
// (IssuerRegistry, OpportunityManager, RedeemerRegistry, Redemption,
// IssuerWaiverRegistry) so each module can later be flipped to a chain
// adapter without renaming concepts.
// ---------------------------------------------------------------------------

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['admin', 'participant', 'issuer', 'redeemer'] }).notNull(),
  status: text('status', { enum: ['active', 'disabled'] }).notNull().default('active'),
  orgId: text('org_id'),
  creditBalance: integer('credit_balance').notNull().default(0),
  lifetimeEarned: integer('lifetime_earned').notNull().default(0),
  interests: text('interests').notNull().default('[]'), // JSON: string[] of cause/interest tags
  neighborhood: text('neighborhood').notNull().default(''),
  resumeToken: text('resume_token'), // share link id for the public service résumé
  resumePublic: integer('resume_public').notNull().default(0),
  createdAt: integer('created_at').notNull(),
})

export const orgs = sqliteTable(
  'orgs',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    // URL-safe handle for the public profile, e.g. /orgs/riverside-food-bank.
    // Nullable for rows created before profiles existed; backfilled by the migration.
    slug: text('slug'),
    type: text('type', { enum: ['issuer', 'redeemer'] }).notNull(),
    description: text('description').notNull().default(''),
    status: text('status', { enum: ['pending', 'approved', 'suspended'] }).notNull().default('pending'),
    ownerUserId: text('owner_user_id').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({
    slugUniq: uniqueIndex('orgs_slug').on(t.slug),
  }),
)

// ---------------------------------------------------------------------------
// Public-facing organization profile. Editorial / presentation data, kept
// deliberately OUT of the contract-mirroring `orgs` table: this is a CMS
// surface, not protocol state, and is never replayed onto a chain module.
// Header fields are columns; the page body is an ordered array of typed
// blocks (see lib/profile/blocks.ts) stored as JSON in `layout`.
// ---------------------------------------------------------------------------

export const orgProfiles = sqliteTable('org_profiles', {
  orgId: text('org_id').primaryKey(),
  tagline: text('tagline').notNull().default(''),
  mission: text('mission').notNull().default(''), // plain-text "About" copy
  logoUrl: text('logo_url').notNull().default(''),
  coverUrl: text('cover_url').notNull().default(''),
  website: text('website').notNull().default(''),
  contactEmail: text('contact_email').notNull().default(''),
  phone: text('phone').notNull().default(''),
  location: text('location').notNull().default(''),
  socials: text('socials').notNull().default('{}'), // JSON: { twitter?, instagram?, facebook?, linkedin? }
  causes: text('causes').notNull().default('[]'), // JSON: string[] of cause tags
  // The org's recurring onboarding task — featured above open opportunities and
  // the entry point for new volunteers. References tasks.id.
  onboardingTaskId: text('onboarding_task_id'),
  published: integer('published').notNull().default(0),
  updatedAt: integer('updated_at').notNull(),
})

export const waiverVersions = sqliteTable('waiver_versions', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  version: integer('version').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  sha256: text('sha256').notNull(), // hash of the waiver body — the value a future on-chain WaiverRegistry stores
  active: integer('active').notNull().default(1),
  createdAt: integer('created_at').notNull(),
})

export const waiverAcceptances = sqliteTable(
  'waiver_acceptances',
  {
    id: text('id').primaryKey(),
    waiverVersionId: text('waiver_version_id').notNull(),
    orgId: text('org_id').notNull(),
    userId: text('user_id').notNull(),
    sha256: text('sha256').notNull(),
    acceptedAt: integer('accepted_at').notNull(),
  },
  (t) => ({
    uniq: uniqueIndex('waiver_acceptances_user_version').on(t.userId, t.waiverVersionId),
  }),
)

// An opportunity is now a template. `credits` is the value awarded per
// completion; concrete dated occurrences live in `shifts`. `slots`/`startsAt`
// are retained as legacy defaults (used to seed the first shift, and for
// display of pre-scheduling data).
export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  location: text('location').notNull().default(''),
  credits: integer('credits').notNull(),
  slots: integer('slots').notNull().default(1),
  startsAt: text('starts_at').notNull().default(''),
  status: text('status', { enum: ['open', 'closed'] }).notNull().default('open'),
  requiredCredentials: text('required_credentials').notNull().default('[]'), // JSON: CredentialKey[]
  // The approved catalog template this opportunity was scheduled from (nullable
  // for legacy/direct opportunities; required once catalogApproval is enabled).
  catalogEntryId: text('catalog_entry_id'),
  createdBy: text('created_by').notNull(),
  createdAt: integer('created_at').notNull(),
})

// ---------------------------------------------------------------------------
// Opportunity Catalog. `opportunity_types` is the city-wide reference list of
// standardized opportunity types (with a suggested credit band). `catalog_entries`
// are an org's reusable templates, gated by an approval workflow before they can
// distribute civic credits.
// ---------------------------------------------------------------------------

export const opportunityTypes = sqliteTable('opportunity_types', {
  id: text('id').primaryKey(),
  category: text('category').notNull().default(''),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  suggestedMin: integer('suggested_min'),
  suggestedTypical: integer('suggested_typical'),
  suggestedMax: integer('suggested_max'),
  active: integer('active').notNull().default(1),
  createdAt: integer('created_at').notNull(),
})

export const catalogEntries = sqliteTable(
  'catalog_entries',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    typeId: text('type_id'),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    location: text('location').notNull().default(''),
    defaultCredits: integer('default_credits'),
    requiredCredentials: text('required_credentials').notNull().default('[]'),
    status: text('status', {
      enum: ['draft', 'submitted', 'approved', 'needs_changes', 'rejected'],
    })
      .notNull()
      .default('draft'),
    reviewNote: text('review_note').notNull().default(''),
    createdBy: text('created_by').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    byOrg: index('catalog_entries_org').on(t.orgId),
  }),
)

// A dated, capacity-bounded occurrence of an opportunity. Volunteers claim a
// specific shift. `startsAt`/`endsAt` are epoch ms (nullable for legacy rows
// migrated from free-text schedules); `label` holds free-text time info.
export const shifts = sqliteTable(
  'shifts',
  {
    id: text('id').primaryKey(),
    taskId: text('task_id').notNull(),
    orgId: text('org_id').notNull(),
    startsAt: integer('starts_at'),
    endsAt: integer('ends_at'),
    label: text('label').notNull().default(''),
    capacity: integer('capacity').notNull().default(1),
    status: text('status', { enum: ['open', 'closed'] }).notNull().default('open'),
    // Short code the on-site lead shares so volunteers can self check in.
    checkInCode: text('check_in_code').notNull().default(''),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({
    byTask: index('shifts_task').on(t.taskId),
  }),
)

export const claims = sqliteTable(
  'claims',
  {
    id: text('id').primaryKey(),
    // taskId is retained (denormalized) so credit, verification, impact, and
    // roster queries keep joining claims -> tasks unchanged.
    taskId: text('task_id').notNull(),
    shiftId: text('shift_id'),
    userId: text('user_id').notNull(),
    status: text('status', {
      enum: ['claimed', 'submitted', 'verified', 'rejected', 'unclaimed'],
    }).notNull().default('claimed'),
    note: text('note').notNull().default(''),
    checkedInAt: integer('checked_in_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    uniq: uniqueIndex('claims_shift_user').on(t.shiftId, t.userId),
  }),
)

// Network-wide credentials a volunteer holds (background check, ID, age, etc.).
// Granted by an admin or an issuer org; reusable at every org that requires it.
export const credentials = sqliteTable(
  'credentials',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    type: text('type').notNull(),
    status: text('status', { enum: ['verified', 'revoked'] }).notNull().default('verified'),
    grantedByUserId: text('granted_by_user_id').notNull(),
    grantedByOrgId: text('granted_by_org_id'),
    note: text('note').notNull().default(''),
    expiresAt: integer('expires_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    uniq: uniqueIndex('credentials_user_type').on(t.userId, t.type),
  }),
)

export const offerings = sqliteTable('offerings', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  cost: integer('cost').notNull(),
  active: integer('active').notNull().default(1),
  createdAt: integer('created_at').notNull(),
})

export const redemptions = sqliteTable('redemptions', {
  id: text('id').primaryKey(),
  offeringId: text('offering_id').notNull(),
  orgId: text('org_id').notNull(),
  userId: text('user_id').notNull(),
  cost: integer('cost').notNull(),
  code: text('code').notNull().unique(),
  status: text('status', { enum: ['pending', 'finalized', 'cancelled'] }).notNull().default('pending'),
  createdAt: integer('created_at').notNull(),
  finalizedAt: integer('finalized_at'),
})

export const orgMessages = sqliteTable('org_messages', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  senderUserId: text('sender_user_id').notNull(),
  scope: text('scope', { enum: ['roster', 'task'] }).notNull(),
  taskId: text('task_id'),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  recipientCount: integer('recipient_count').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const messageRecipients = sqliteTable(
  'message_recipients',
  {
    id: text('id').primaryKey(),
    messageId: text('message_id').notNull(),
    userId: text('user_id').notNull(),
    readAt: integer('read_at'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({
    uniq: uniqueIndex('message_recipients_msg_user').on(t.messageId, t.userId),
  }),
)

export const posts = sqliteTable('posts', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  authorUserId: text('author_user_id').notNull(),
  body: text('body').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const postHearts = sqliteTable(
  'post_hearts',
  {
    id: text('id').primaryKey(),
    postId: text('post_id').notNull(),
    userId: text('user_id').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({
    uniq: uniqueIndex('post_hearts_post_user').on(t.postId, t.userId),
  }),
)

// ---------------------------------------------------------------------------
// Operational notifications + reminders. NOT protocol state: these are
// ephemeral delivery records (like uploads), so they are not ledgered.
// `notifications` is the in-app feed; `reminders` is the scheduled outbox a
// cron/processor drains into notifications and/or email.
// ---------------------------------------------------------------------------

export const notifications = sqliteTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    kind: text('kind').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    link: text('link').notNull().default(''),
    readAt: integer('read_at'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({
    byUser: index('notifications_user').on(t.userId),
  }),
)

export const reminders = sqliteTable(
  'reminders',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    taskId: text('task_id').notNull(),
    shiftId: text('shift_id').notNull(),
    kind: text('kind').notNull(),
    inApp: integer('in_app').notNull().default(0),
    email: integer('email').notNull().default(0),
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    link: text('link').notNull().default(''),
    sendAfter: integer('send_after').notNull(),
    status: text('status', { enum: ['pending', 'sent', 'cancelled'] }).notNull().default('pending'),
    createdAt: integer('created_at').notNull(),
    sentAt: integer('sent_at'),
  },
  (t) => ({
    due: index('reminders_due').on(t.status, t.sendAfter),
  }),
)

// ---------------------------------------------------------------------------
// The ledger. Append-only, hash-chained. This is the system of record;
// projections above are conveniences.
// ---------------------------------------------------------------------------

export const events = sqliteTable('events', {
  seq: integer('seq').primaryKey({ autoIncrement: true }),
  id: text('id').notNull().unique(),
  type: text('type').notNull(),
  payload: text('payload').notNull(), // canonical JSON
  actorId: text('actor_id'),
  ts: integer('ts').notNull(),
  prevHash: text('prev_hash').notNull(),
  hash: text('hash').notNull(),
})

export const anchors = sqliteTable('anchors', {
  id: text('id').primaryKey(),
  fromSeq: integer('from_seq').notNull(),
  toSeq: integer('to_seq').notNull(),
  eventCount: integer('event_count').notNull(),
  merkleRoot: text('merkle_root').notNull(),
  network: text('network').notNull(),
  txHash: text('tx_hash'),
  createdAt: integer('created_at').notNull(),
})
