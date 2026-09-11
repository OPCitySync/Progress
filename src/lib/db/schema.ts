import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core'
export * from './program-workspace-schema'
export * from './volunteer-intake-schema'

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
  // How the current liability waiver is collected for the recurring onboarding
  // session. Digital means acceptance is recorded before reservation; in-person
  // means staff record receipt of the signed document at check-in.
  // Organization-wide defaults for onboarding. Individual onboarding templates
  // may override either rule when a particular program needs a different flow.
  onboardingWaiverMethod: text('onboarding_waiver_method', { enum: ['digital', 'in_person', 'either'] }),
  onboardingIdentityCheck: text('onboarding_identity_check', { enum: ['not_required', 'staff_attested'] }),
  published: integer('published').notNull().default(0),
  updatedAt: integer('updated_at').notNull(),
})

export const waiverVersions = sqliteTable('waiver_versions', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  programId: text('program_id'),
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
    // Typed signatures are private to the issuing organization. Public
    // profiles and city-ledger events never expose a participant's signing
    // name or the underlying waiver content.
    signatureMethod: text('signature_method', { enum: ['acknowledgement', 'typed_electronic'] })
      .notNull()
      .default('acknowledgement'),
    signerName: text('signer_name'),
    electronicConsentAt: integer('electronic_consent_at'),
    signedAt: integer('signed_at'),
    acceptedAt: integer('accepted_at').notNull(),
  },
  (t) => ({
    uniq: uniqueIndex('waiver_acceptances_user_version').on(t.userId, t.waiverVersionId),
  }),
)

// Private organization-local eligibility attestations. These record only the
// outcome of an in-person or organization-controlled review, never copies of
// IDs, dates of birth, or guardian documents.
export const volunteerEligibilityRecords = sqliteTable(
  'volunteer_eligibility_records',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    userId: text('user_id').notNull(),
    status: text('status', { enum: ['pending', 'adult_verified', 'minor_consent_verified'] }).notNull().default('pending'),
    verifiedByUserId: text('verified_by_user_id'),
    verifiedAt: integer('verified_at'),
    expiresAt: integer('expires_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    uniqueOrganizationVolunteer: uniqueIndex('volunteer_eligibility_records_org_user').on(t.orgId, t.userId),
    byOrganization: index('volunteer_eligibility_records_org').on(t.orgId, t.status),
  }),
)

// An organization-local, staff-attested match between a City/Sync account and
// the person who appeared in person. This is deliberately not an ID vault:
// no document image, document number, birth date, or biometric is retained.
export const volunteerIdentityVerifications = sqliteTable(
  'volunteer_identity_verifications',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    userId: text('user_id').notNull(),
    status: text('status', { enum: ['verified', 'revoked'] }).notNull().default('verified'),
    verifiedByUserId: text('verified_by_user_id').notNull(),
    verifiedAt: integer('verified_at').notNull(),
    revokedByUserId: text('revoked_by_user_id'),
    revokedAt: integer('revoked_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    uniqueOrganizationVolunteer: uniqueIndex('volunteer_identity_verifications_org_user').on(t.orgId, t.userId),
    byOrganization: index('volunteer_identity_verifications_org').on(t.orgId, t.status),
  }),
)

// Organization-owned authorization to perform all or selected opportunity
// templates. This is separate from identity and youth-safeguarding records so
// each decision can be granted and revoked independently.
export const volunteerTaskEligibilityGrants = sqliteTable(
  'volunteer_task_eligibility_grants',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    userId: text('user_id').notNull(),
    scope: text('scope', { enum: ['all', 'task'] }).notNull(),
    // `all` is used as a durable sentinel for organization-wide eligibility.
    taskId: text('task_id').notNull(),
    status: text('status', { enum: ['active', 'revoked'] }).notNull().default('active'),
    grantedByUserId: text('granted_by_user_id').notNull(),
    grantedAt: integer('granted_at').notNull(),
    revokedByUserId: text('revoked_by_user_id'),
    revokedAt: integer('revoked_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    uniqueOrganizationVolunteerScope: uniqueIndex('volunteer_task_eligibility_org_user_task').on(t.orgId, t.userId, t.taskId),
    byOrganization: index('volunteer_task_eligibility_org').on(t.orgId, t.userId, t.status),
  }),
)

// Organization-owned working documents. These stay private to the organization
// unless it explicitly attaches one to an opportunity. Waivers are deliberately
// separate: they are versioned legal records with participant acceptance.
export const organizationDocuments = sqliteTable(
  'organization_documents',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    programId: text('program_id'),
    category: text('category', { enum: ['guide', 'safety', 'template'] }).notNull(),
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    documentUrl: text('document_url'),
    documentName: text('document_name'),
    documentMimeType: text('document_mime_type'),
    documentSha256: text('document_sha256'),
    active: integer('active').notNull().default(1),
    createdByUserId: text('created_by_user_id').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    byOrganization: index('organization_documents_org').on(t.orgId, t.category, t.updatedAt),
  }),
)

// Organization-defined areas of volunteer work. A program is deliberately
// lightweight: organizations decide whether it represents a mission area,
// project family, location, or any other coordination structure.
export const volunteerPrograms = sqliteTable(
  'volunteer_programs',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    operatingMode: text('operating_mode', {
      enum: ['flexible', 'public_recruitment', 'roster_scheduling', 'project_coordination'],
    }).notNull().default('flexible'),
    defaultVisibility: text('default_visibility', { enum: ['public', 'private'] }).notNull().default('public'),
    defaultLocation: text('default_location').notNull().default(''),
    defaultCapacity: integer('default_capacity').notNull().default(8),
    defaultDurationMinutes: integer('default_duration_minutes').notNull().default(120),
    onboardingPreference: text('onboarding_preference', {
      enum: ['optional', 'recommended', 'not_needed'],
    }).notNull().default('optional'),
    createdByUserId: text('created_by_user_id').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    uniqueOrganizationProgramName: uniqueIndex('volunteer_programs_org_name').on(t.orgId, t.name),
    byOrganization: index('volunteer_programs_org').on(t.orgId, t.createdAt),
  }),
)

// An optional association makes a guide, safety plan, or reusable template
// discoverable in the operational context where a team needs it.
export const organizationDocumentAssignments = sqliteTable(
  'organization_document_assignments',
  {
    id: text('id').primaryKey(),
    documentId: text('document_id').notNull(),
    taskId: text('task_id').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({
    uniqueDocumentTask: uniqueIndex('organization_document_assignments_document_task').on(t.documentId, t.taskId),
    byDocument: index('organization_document_assignments_document').on(t.documentId),
    byTask: index('organization_document_assignments_task').on(t.taskId),
  }),
)

// Publishing a resource is an editorial choice, separate from the private
// document library and the task where the resource may be used. Keeping the
// destination explicit lets an organization share the same item publicly,
// with local participants, or both.
export const organizationResourcePublications = sqliteTable(
  'organization_resource_publications',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    resourceKind: text('resource_kind', { enum: ['document', 'waiver'] }).notNull(),
    resourceId: text('resource_id').notNull(),
    destination: text('destination', { enum: ['profile', 'volunteer_resources'] }).notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({
    uniqueResourceDestination: uniqueIndex('organization_resource_publications_resource_destination').on(t.orgId, t.resourceKind, t.resourceId, t.destination),
    byOrganizationDestination: index('organization_resource_publications_org_destination').on(t.orgId, t.destination),
  }),
)

// A waiver can be made visible beside a particular non-onboarding task. This
// is intentionally a visibility association only: onboarding acceptance is
// still governed solely by the active-waiver flow above.
export const waiverTaskAssignments = sqliteTable(
  'waiver_task_assignments',
  {
    id: text('id').primaryKey(),
    waiverVersionId: text('waiver_version_id').notNull(),
    taskId: text('task_id').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({
    uniqueWaiverTask: uniqueIndex('waiver_task_assignments_waiver_task').on(t.waiverVersionId, t.taskId),
    byWaiver: index('waiver_task_assignments_waiver').on(t.waiverVersionId),
    byTask: index('waiver_task_assignments_task').on(t.taskId),
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
  // Organization-authored preparation guidance shown on a participant's
  // reserved-session page. These are intentionally plain text so each
  // organization can describe forms, preparation, and supplies in its own way.
  beforeSession: text('before_session').notNull().default(''),
  bringItems: text('bring_items').notNull().default(''),
  credits: integer('credits').notNull(),
  slots: integer('slots').notNull().default(1),
  // Reusable default for every shift published from this opportunity template.
  // Individual shifts can still override it at publication time.
  defaultDurationMinutes: integer('default_duration_minutes').notNull().default(120),
  startsAt: text('starts_at').notNull().default(''),
  status: text('status', { enum: ['open', 'closed'] }).notNull().default('open'),
  programId: text('program_id'),
  // An onboarding series remains an opportunity template, but carries the
  // local membership and waiver rules that ordinary opportunities do not.
  // This enables organizations to operate several independent series.
  isOnboarding: integer('is_onboarding').notNull().default(0),
  // Null inherits the organization-wide onboarding requirement. These values
  // are intentionally configuration, not evidence: a reservation snapshots
  // its applicable rule on the claim below.
  onboardingWaiverMethod: text('onboarding_waiver_method', { enum: ['digital', 'in_person', 'either'] }),
  onboardingIdentityCheck: text('onboarding_identity_check', { enum: ['not_required', 'staff_attested'] }),
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
    // A public shift appears in the Civic Participant opportunity board. A
    // private shift is only visible to volunteers the organization adds.
    visibility: text('visibility', { enum: ['public', 'private'] }).notNull().default('public'),
    // This value is derived from visibility: public shifts accept claims and
    // private shifts are managed directly by the organization.
    enrollmentMode: text('enrollment_mode', { enum: ['open_claims', 'organization_managed'] }).notNull().default('open_claims'),
    // Short code the on-site lead shares so volunteers can self check in.
    checkInCode: text('check_in_code').notNull().default(''),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({
    byTask: index('shifts_task').on(t.taskId),
  }),
)

// Staff support is scheduled alongside volunteers, but it is not a volunteer
// claim: it does not consume public capacity, create a service record, or
// participate in verification and credit issuance. A snapshot of the active
// delegation makes the assignment auditable while keeping the two rosters
// distinct.
export const shiftStaffAssignments = sqliteTable(
  'shift_staff_assignments',
  {
    id: text('id').primaryKey(),
    shiftId: text('shift_id').notNull(),
    orgId: text('org_id').notNull(),
    userId: text('user_id').notNull(),
    delegationId: text('delegation_id').notNull(),
    assignedByUserId: text('assigned_by_user_id').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    shiftUserUniq: uniqueIndex('shift_staff_assignments_shift_user').on(t.shiftId, t.userId),
    byShift: index('shift_staff_assignments_shift').on(t.shiftId, t.createdAt),
    byOrganization: index('shift_staff_assignments_org').on(t.orgId, t.createdAt),
  }),
)

// A recurring onboarding program publishes only one public session at a time.
// Once that session ends, the scheduled processor releases the next occurrence.
export const onboardingRecurringSchedules = sqliteTable(
  'onboarding_recurring_schedules',
  {
    taskId: text('task_id').primaryKey(),
    orgId: text('org_id').notNull(),
    intervalDays: integer('interval_days').notNull().default(7),
    nextStartsAt: integer('next_starts_at').notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    capacity: integer('capacity').notNull(),
    lastPublishedShiftId: text('last_published_shift_id'),
    active: integer('active').notNull().default(1),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    byOrganization: index('onboarding_recurring_schedules_org').on(t.orgId, t.active),
  }),
)

// A reusable opportunity can hold multiple weekly patterns. Each pattern
// exposes one upcoming occurrence at a time so the roster and calendar remain
// clear while a role can still cover several days of the week.
export const recurringEventSchedules = sqliteTable(
  'recurring_event_patterns',
  {
    id: text('id').primaryKey(),
    taskId: text('task_id').notNull(),
    orgId: text('org_id').notNull(),
    intervalDays: integer('interval_days').notNull().default(7),
    nextStartsAt: integer('next_starts_at').notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    capacity: integer('capacity').notNull(),
    visibility: text('visibility', { enum: ['public', 'private'] }).notNull().default('public'),
    enrollmentMode: text('enrollment_mode', { enum: ['open_claims', 'organization_managed'] }).notNull().default('open_claims'),
    lastPublishedShiftId: text('last_published_shift_id'),
    active: integer('active').notNull().default(1),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    byOrganization: index('recurring_event_patterns_org').on(t.orgId, t.active),
    byTask: index('recurring_event_patterns_task').on(t.taskId, t.active),
  }),
)

// Future roster plans remain distinct from claims until the matching recurring
// occurrence is actually published. This prevents premature participant
// notifications while preserving the issuer's scheduling work.
export const plannedRecurringAssignments = sqliteTable(
  'planned_recurring_assignments',
  {
    id: text('id').primaryKey(),
    taskId: text('task_id').notNull(),
    orgId: text('org_id').notNull(),
    occurrenceStartsAt: integer('occurrence_starts_at').notNull(),
    userId: text('user_id').notNull(),
    assignedByUserId: text('assigned_by_user_id').notNull(),
    status: text('status', { enum: ['planned', 'applied', 'removed'] }).notNull().default('planned'),
    shiftId: text('shift_id'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    occurrenceUserUniq: uniqueIndex('planned_recurring_assignments_occurrence_user').on(t.taskId, t.occurrenceStartsAt, t.userId),
    byOrganization: index('planned_recurring_assignments_org').on(t.orgId, t.occurrenceStartsAt),
    byOccurrence: index('planned_recurring_assignments_occurrence').on(t.taskId, t.occurrenceStartsAt, t.status),
  }),
)

// Staff support for future recurring occurrences stays separate from volunteer
// plans for the same reason live shift staff stays separate from claims. The
// delegation is checked again when the occurrence publishes, so revoked access
// can never be carried into a live staff assignment.
export const plannedRecurringStaffAssignments = sqliteTable(
  'planned_recurring_staff_assignments',
  {
    id: text('id').primaryKey(),
    taskId: text('task_id').notNull(),
    orgId: text('org_id').notNull(),
    occurrenceStartsAt: integer('occurrence_starts_at').notNull(),
    userId: text('user_id').notNull(),
    delegationId: text('delegation_id').notNull(),
    assignedByUserId: text('assigned_by_user_id').notNull(),
    status: text('status', { enum: ['planned', 'applied', 'removed'] }).notNull().default('planned'),
    shiftId: text('shift_id'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    occurrenceUserUniq: uniqueIndex('planned_recurring_staff_assignments_occurrence_user').on(t.taskId, t.occurrenceStartsAt, t.userId),
    byOrganization: index('planned_recurring_staff_assignments_org').on(t.orgId, t.occurrenceStartsAt),
    byOccurrence: index('planned_recurring_staff_assignments_occurrence').on(t.taskId, t.occurrenceStartsAt, t.status),
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
    // Bound to the waiver version that governed an onboarding reservation.
    // In-person collection is attested by an issuer only after the signed paper
    // document is received on site; the document itself is never stored here.
    waiverVersionId: text('waiver_version_id'),
    waiverCollectionMethod: text('waiver_collection_method', { enum: ['digital', 'in_person'] }),
    // Snapshot whether staff identity matching was required for this specific
    // reservation. The staff attestation itself stays in the organization-
    // local identity record; no identity document is retained by City/Sync.
    identityMatchRequired: integer('identity_match_required').notNull().default(0),
    paperWaiverConfirmedAt: integer('paper_waiver_confirmed_at'),
    paperWaiverConfirmedBy: text('paper_waiver_confirmed_by'),
    // A single staff confirmation can verify an entire shift while preserving
    // a separate, auditable contribution record for every participant.
    verificationBatchId: text('verification_batch_id'),
    verifiedByUserId: text('verified_by_user_id'),
    verifiedAt: integer('verified_at'),
    noShowAt: integer('no_show_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    uniq: uniqueIndex('claims_shift_user').on(t.shiftId, t.userId),
  }),
)

// Shift-level staff confirmation. The batch holds the shared note and verifier
// context; each linked claim retains its own verified status and credit mint.
export const verificationBatches = sqliteTable(
  'verification_batches',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    taskId: text('task_id').notNull(),
    shiftId: text('shift_id').notNull(),
    verifiedByUserId: text('verified_by_user_id').notNull(),
    note: text('note').notNull().default(''),
    participantCount: integer('participant_count').notNull(),
    verifiedAt: integer('verified_at').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({
    byShift: index('verification_batches_shift').on(t.shiftId, t.verifiedAt),
    byOrganization: index('verification_batches_org').on(t.orgId, t.verifiedAt),
  }),
)

// A participant's optional reflection after an organization has verified a
// completed shift. This is private operational feedback: it is intentionally
// separate from the staff verification note and is never public ledger data.
export const volunteerReflections = sqliteTable(
  'volunteer_reflections',
  {
    id: text('id').primaryKey(),
    claimId: text('claim_id').notNull(),
    shiftId: text('shift_id').notNull(),
    taskId: text('task_id').notNull(),
    orgId: text('org_id').notNull(),
    userId: text('user_id').notNull(),
    verificationBatchId: text('verification_batch_id'),
    shiftNote: text('shift_note').notNull().default(''),
    organizationIdea: text('organization_idea').notNull().default(''),
    submittedAt: integer('submitted_at').notNull(),
  },
  (t) => ({
    oneReflectionPerClaim: uniqueIndex('volunteer_reflections_claim').on(t.claimId),
    byOrganizationShift: index('volunteer_reflections_org_shift').on(t.orgId, t.shiftId, t.submittedAt),
    byParticipant: index('volunteer_reflections_user').on(t.userId, t.submittedAt),
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

// A roster can include people who were invited directly by an organization,
// before they claim their first opportunity. Claims continue to add people to
// a roster implicitly; this table preserves the explicit relationship.
export const volunteerRosterMembers = sqliteTable(
  'volunteer_roster_members',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    userId: text('user_id').notNull(),
    source: text('source', { enum: ['invite', 'approval'] }).notNull().default('invite'),
    invitedByUserId: text('invited_by_user_id'),
    joinedAt: integer('joined_at').notNull(),
  },
  (t) => ({
    organizationUserUniq: uniqueIndex('volunteer_roster_members_org_user').on(t.orgId, t.userId),
    byOrganization: index('volunteer_roster_members_org').on(t.orgId, t.joinedAt),
    byUser: index('volunteer_roster_members_user').on(t.userId, t.joinedAt),
  }),
)

// A single-use enrollment link. Only its hash is stored, so the link itself
// remains a bearer secret that can safely be shown once to the issuer.
export const volunteerRosterInvites = sqliteTable(
  'volunteer_roster_invites',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    codeHash: text('code_hash').notNull(),
    issuedByUserId: text('issued_by_user_id').notNull(),
    expiresAt: integer('expires_at').notNull(),
    acceptedByUserId: text('accepted_by_user_id'),
    acceptedAt: integer('accepted_at'),
    revokedAt: integer('revoked_at'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({
    codeHashUniq: uniqueIndex('volunteer_roster_invites_code_hash').on(t.codeHash),
    byOrganization: index('volunteer_roster_invites_org').on(t.orgId, t.createdAt),
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

// A shift-specific conversation. Membership is derived from active shift
// claims; after the event it becomes a read-only archive for 14 days before
// the room and messages are permanently removed.
export const eventChats = sqliteTable(
  'event_chats',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    taskId: text('task_id').notNull(),
    shiftId: text('shift_id').notNull(),
    createdByUserId: text('created_by_user_id').notNull(),
    title: text('title').notNull(),
    closesAt: integer('closes_at').notNull(),
    status: text('status', { enum: ['open', 'archived'] }).notNull().default('open'),
    createdAt: integer('created_at').notNull(),
    closedAt: integer('closed_at'),
  },
  (t) => ({
    oneChatPerShift: uniqueIndex('event_chats_shift').on(t.shiftId),
    byOrganization: index('event_chats_org_status').on(t.orgId, t.status, t.closesAt),
    byExpiry: index('event_chats_expiry').on(t.status, t.closesAt),
  }),
)

export const eventChatMessages = sqliteTable(
  'event_chat_messages',
  {
    id: text('id').primaryKey(),
    chatId: text('chat_id').notNull(),
    senderUserId: text('sender_user_id').notNull(),
    body: text('body').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({
    byChat: index('event_chat_messages_chat_created').on(t.chatId, t.createdAt),
  }),
)

// Per-participant read position for a temporary event chat. This is private
// inbox state: it never becomes part of the public or organizational ledger.
export const eventChatReads = sqliteTable(
  'event_chat_reads',
  {
    id: text('id').primaryKey(),
    chatId: text('chat_id').notNull(),
    userId: text('user_id').notNull(),
    lastReadAt: integer('last_read_at').notNull(),
  },
  (t) => ({
    oneReadPositionPerParticipant: uniqueIndex('event_chat_reads_chat_user').on(t.chatId, t.userId),
    byParticipant: index('event_chat_reads_user').on(t.userId, t.lastReadAt),
  }),
)

export const posts = sqliteTable('posts', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  authorUserId: text('author_user_id').notNull(),
  body: text('body').notNull(),
  imageUrl: text('image_url'),
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

// Participant-owned saved items. A single table supports both MyCity posts and
// opportunities without exposing the saved state publicly or duplicating it in
// a browser-only preference store.
export const savedItems = sqliteTable(
  'saved_items',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    kind: text('kind', { enum: ['post', 'task'] }).notNull(),
    itemId: text('item_id').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({
    userItemUniq: uniqueIndex('saved_items_user_kind_item').on(t.userId, t.kind, t.itemId),
    byUser: index('saved_items_user').on(t.userId, t.kind, t.createdAt),
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

// Organization-owned planning notes. These stay private to the organization
// and are intentionally separate from volunteer shifts and public ledger data.
export const organizationCalendarEntries = sqliteTable(
  'organization_calendar_entries',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    cityId: text('city_id').notNull(),
    createdByUserId: text('created_by_user_id').notNull(),
    title: text('title').notNull(),
    details: text('details').notNull().default(''),
    startsAt: integer('starts_at').notNull(),
    endsAt: integer('ends_at').notNull(),
    color: text('color').notNull().default('blue'),
    reminderKind: text('reminder_kind').notNull().default('none'),
    reminderAt: integer('reminder_at'),
    notifiedAt: integer('notified_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    byOrganizationSchedule: index('organization_calendar_entries_org_city_schedule').on(t.orgId, t.cityId, t.startsAt),
    dueReminder: index('organization_calendar_entries_due_reminder').on(t.reminderAt, t.notifiedAt),
  }),
)

// Acknowledgements are private organization workspace preferences. They only
// dismiss a queue prompt; they never alter a volunteer, shift, or ledgered
// contribution record.
export const organizationQueueAcknowledgements = sqliteTable(
  'organization_queue_acknowledgements',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    actionKey: text('action_key').notNull(),
    acknowledgedByUserId: text('acknowledged_by_user_id').notNull(),
    acknowledgedAt: integer('acknowledged_at').notNull(),
  },
  (t) => ({
    uniqueAction: uniqueIndex('organization_queue_acknowledgements_org_action').on(t.orgId, t.actionKey),
    byOrganization: index('organization_queue_acknowledgements_org').on(t.orgId, t.acknowledgedAt),
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
