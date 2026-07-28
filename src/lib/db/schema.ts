import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core'

// ---------------------------------------------------------------------------
// Projection tables. Current state, always derivable from the event log.
// Table/field naming intentionally mirrors the City::Sync contract suite
// (IssuerRegistry, OpportunityManager, RedeemerRegistry, Redemption,
// IssuerWaiverRegistry) so each module can later be flipped to a chain
// adapter without renaming concepts.
// ---------------------------------------------------------------------------

export const users = sqliteTable(
  'users',
  {
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
    username: text('username'),
    avatarUrl: text('avatar_url').notNull().default(''),
    // The city a participant selected during signup. It is only considered
    // proven once their first onboarding shift has a verified check-in.
    homeCityId: text('home_city_id'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({
    usernameUniq: uniqueIndex('users_username').on(t.username),
  }),
)

// A person signs in once, but may operate through several distinct actors.
// These durable, wallet-ready addresses deliberately are not blockchain
// addresses yet: a future passkey/smart-wallet adapter can bind to them
// without changing the authorization or audit model.
export const identities = sqliteTable(
  'identities',
  {
    id: text('id').primaryKey(),
    userId: text('user_id'),
    orgId: text('org_id'),
    kind: text('kind', { enum: ['participant', 'organization', 'authority'] }).notNull(),
    address: text('address').notNull(),
    status: text('status', { enum: ['active', 'revoked'] }).notNull().default('active'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({
    addressUniq: uniqueIndex('identities_address').on(t.address),
    byUser: index('identities_user').on(t.userId),
    byOrg: index('identities_org').on(t.orgId),
  }),
)

// This is the many-to-many join between people and organizations. The
// authority identity is separate from both the participant identity and the
// organization identity, so access can be scoped and revoked independently.
export const organizationDelegations = sqliteTable(
  'organization_delegations',
  {
    id: text('id').primaryKey(),
    identityId: text('identity_id').notNull(),
    roleId: text('role_id'),
    userId: text('user_id').notNull(),
    orgId: text('org_id').notNull(),
    role: text('role', { enum: ['owner', 'manager', 'member'] }).notNull().default('member'),
    capabilities: text('capabilities').notNull().default('[]'),
    cityIds: text('city_ids').notNull().default('[]'),
    status: text('status', { enum: ['active', 'revoked'] }).notNull().default('active'),
    grantedByUserId: text('granted_by_user_id'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    revokedAt: integer('revoked_at'),
  },
  (t) => ({
    identityUniq: uniqueIndex('organization_delegations_identity').on(t.identityId),
    personOrganizationUniq: uniqueIndex('organization_delegations_user_org').on(t.userId, t.orgId),
    byOrganization: index('organization_delegations_org').on(t.orgId),
    byUser: index('organization_delegations_user').on(t.userId),
  }),
)

// Named, organization-owned permission bundles. `tierNumber` provides an
// internal ordering value only; organizations choose every visible role name.
export const organizationRoles = sqliteTable(
  'organization_roles',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    tierNumber: integer('tier_number').notNull(),
    name: text('name').notNull(),
    permissions: text('permissions').notNull().default('[]'),
    isOwnerRole: integer('is_owner_role').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    orgTierUniq: uniqueIndex('organization_roles_org_tier').on(t.orgId, t.tierNumber),
    byOrganization: index('organization_roles_org').on(t.orgId),
  }),
)

// Invite codes delegate an organization authority to a recipient's existing
// person account. Only a hash is stored; the original code is shown once to
// the issuer who generated it.
export const organizationInvites = sqliteTable(
  'organization_invites',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    roleId: text('role_id'),
    codeHash: text('code_hash').notNull(),
    role: text('role', { enum: ['manager', 'member'] }).notNull().default('member'),
    capabilities: text('capabilities').notNull().default('[]'),
    cityIds: text('city_ids').notNull().default('[]'),
    maxUses: integer('max_uses').notNull().default(1),
    uses: integer('uses').notNull().default(0),
    issuedByDelegationId: text('issued_by_delegation_id').notNull(),
    expiresAt: integer('expires_at').notNull(),
    revokedAt: integer('revoked_at'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({
    codeHashUniq: uniqueIndex('organization_invites_code_hash').on(t.codeHash),
    byOrganization: index('organization_invites_org').on(t.orgId),
  }),
)

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
    // Organizations request a city at registration; a city administrator
    // attaches the organization to it as part of approval.
    requestedCityId: text('requested_city_id'),
    // A city-local organization may be sponsored by an established
    // organization while its local owner completes the ownership claim.
    parentOrgId: text('parent_org_id'),
    ownerUserId: text('owner_user_id').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({
    slugUniq: uniqueIndex('orgs_slug').on(t.slug),
  }),
)

// Reusable issuer locations. The primary address supplied at organization
// signup is stored as the default; any later location used for an opportunity
// or onboarding session is retained as another selectable option.
export const organizationLocations = sqliteTable(
  'organization_locations',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    address: text('address').notNull(),
    isDefault: integer('is_default').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    uniqueAddress: uniqueIndex('organization_locations_org_address').on(t.orgId, t.address),
    byOrganization: index('organization_locations_org').on(t.orgId, t.isDefault),
  }),
)

// City networks are a lightweight membership layer. Opportunity and ledger
// data remain network-wide for now; city-scoped data will be added as each
// projection becomes tenant-aware.
export const cities = sqliteTable(
  'cities',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    description: text('description').notNull().default(''),
    joinCode: text('join_code').notNull().unique(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({
    slugUniq: uniqueIndex('cities_slug').on(t.slug),
    joinCodeUniq: uniqueIndex('cities_join_code').on(t.joinCode),
  }),
)

// A membership may belong to a person or to an organization. `memberId`
// deliberately avoids a foreign key so both entity kinds share one compact,
// uniquely indexed table.
export const cityMemberships = sqliteTable(
  'city_memberships',
  {
    id: text('id').primaryKey(),
    cityId: text('city_id').notNull(),
    memberKind: text('member_kind', { enum: ['user', 'organization'] }).notNull(),
    memberId: text('member_id').notNull(),
    joinedAt: integer('joined_at').notNull(),
  },
  (t) => ({
    uniqueMember: uniqueIndex('city_memberships_city_member').on(t.cityId, t.memberKind, t.memberId),
    byMember: index('city_memberships_member').on(t.memberKind, t.memberId),
  }),
)

// Participation is intentionally separate from city membership. A person may
// add a city immediately, but is New there until an on-site onboarding
// check-in proves their presence. No-show consequences are local to a city.
export const cityParticipantStatuses = sqliteTable(
  'city_participant_statuses',
  {
    id: text('id').primaryKey(),
    cityId: text('city_id').notNull(),
    userId: text('user_id').notNull(),
    status: text('status', { enum: ['new', 'active', 'barred'] }).notNull().default('new'),
    noShowCount: integer('no_show_count').notNull().default(0),
    barredUntil: integer('barred_until'),
    activatedAt: integer('activated_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    uniqueParticipant: uniqueIndex('city_participant_statuses_city_user').on(t.cityId, t.userId),
    byUser: index('city_participant_statuses_user').on(t.userId),
  }),
)

// An established issuer can request a new City/Sync network for another
// physical location. Approval provisions the independent city database and a
// new, city-local organization; the intended local owner must then claim it
// with the email named in this application.
export const cityLaunchApplications = sqliteTable(
  'city_launch_applications',
  {
    id: text('id').primaryKey(),
    sponsorOrgId: text('sponsor_org_id').notNull(),
    bootstrapUserId: text('bootstrap_user_id').notNull(),
    createdByDelegationId: text('created_by_delegation_id').notNull(),
    cityName: text('city_name').notNull(),
    citySlug: text('city_slug').notNull(),
    cityDescription: text('city_description').notNull().default(''),
    proposedOwnerName: text('proposed_owner_name').notNull(),
    proposedOwnerEmail: text('proposed_owner_email').notNull(),
    status: text('status', {
      enum: ['submitted', 'awaiting_owner', 'owner_assigned', 'rejected'],
    }).notNull().default('submitted'),
    cityId: text('city_id'),
    localOrgId: text('local_org_id'),
    ownershipCodeHash: text('ownership_code_hash'),
    ownershipExpiresAt: integer('ownership_expires_at'),
    ownershipAcceptedAt: integer('ownership_accepted_at'),
    ownerUserId: text('owner_user_id'),
    reviewerNote: text('reviewer_note').notNull().default(''),
    approvedByUserId: text('approved_by_user_id'),
    createdAt: integer('created_at').notNull(),
    reviewedAt: integer('reviewed_at'),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    bySponsor: index('city_launch_applications_sponsor').on(t.sponsorOrgId, t.createdAt),
    byStatus: index('city_launch_applications_status').on(t.status, t.createdAt),
    bySlug: index('city_launch_applications_slug').on(t.citySlug),
    claimCode: uniqueIndex('city_launch_applications_claim_code').on(t.ownershipCodeHash),
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
  documentUrl: text('document_url'),
  documentName: text('document_name'),
  documentMimeType: text('document_mime_type'),
  documentSha256: text('document_sha256'),
  // Hash of the waiver body and optional attachment hash — the value a future
  // on-chain WaiverRegistry stores when a participant accepts this version.
  sha256: text('sha256').notNull(),
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
  cityId: text('city_id').notNull().default('berkeley'),
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
      enum: ['claimed', 'submitted', 'verified', 'rejected', 'unclaimed', 'no_show'],
    }).notNull().default('claimed'),
    note: text('note').notNull().default(''),
    checkedInAt: integer('checked_in_at'),
    noShowAt: integer('no_show_at'),
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
  cityId: text('city_id').notNull().default('berkeley'),
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
  cityId: text('city_id').notNull().default('berkeley'),
  cost: integer('cost').notNull(),
  code: text('code').notNull().unique(),
  status: text('status', { enum: ['pending', 'finalized', 'cancelled'] }).notNull().default('pending'),
  createdAt: integer('created_at').notNull(),
  finalizedAt: integer('finalized_at'),
})

// Organization-defined collections of volunteers. These deliberately do not
// derive from opportunities, so an issuer can organize people around any
// operational need (team, neighborhood, shift lead, campaign, and so on).
export const volunteerGroups = sqliteTable(
  'volunteer_groups',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    name: text('name').notNull(),
    createdByUserId: text('created_by_user_id').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    organizationNameUniq: uniqueIndex('volunteer_groups_org_name').on(t.orgId, t.name),
    byOrganization: index('volunteer_groups_org').on(t.orgId),
  }),
)

export const volunteerGroupMembers = sqliteTable(
  'volunteer_group_members',
  {
    id: text('id').primaryKey(),
    groupId: text('group_id').notNull(),
    userId: text('user_id').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({
    groupMemberUniq: uniqueIndex('volunteer_group_members_group_user').on(t.groupId, t.userId),
    byGroup: index('volunteer_group_members_group').on(t.groupId),
    byUser: index('volunteer_group_members_user').on(t.userId),
  }),
)

export const orgMessages = sqliteTable('org_messages', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  senderUserId: text('sender_user_id').notNull(),
  scope: text('scope', { enum: ['roster', 'task', 'group', 'members'] }).notNull(),
  taskId: text('task_id'),
  groupId: text('group_id'),
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

// The control database and each city database intentionally do not share a
// transaction.  This outbox is written alongside a control-plane event, then
// delivered idempotently to the applicable independent city ledger.  Keeping
// it here prevents a transient city database failure from dropping a public
// ledger event after the source action has succeeded.
export const cityLedgerOutbox = sqliteTable(
  'city_ledger_outbox',
  {
    eventId: text('event_id').primaryKey(),
    cityId: text('city_id').notNull(),
    eventSeq: integer('event_seq').notNull(),
    type: text('type').notNull(),
    payload: text('payload').notNull(),
    actorId: text('actor_id'),
    ts: integer('ts').notNull(),
    deliveredAt: integer('delivered_at'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({
    pendingByCity: index('city_ledger_outbox_pending_city').on(t.cityId, t.deliveredAt, t.eventSeq),
  }),
)

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
