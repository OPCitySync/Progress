import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core'

// A session definition is saved separately from its dated, published shifts.
export const onboardingIntakes = sqliteTable('onboarding_intakes', {
  taskId: text('task_id').primaryKey(), orgId: text('org_id').notNull(),
  assignmentMode: text('assignment_mode', { enum: ['all', 'specific'] }).notNull().default('all'),
  programIds: text('program_ids').notNull().default('[]'), flexibleCapacity: integer('flexible_capacity').notNull().default(0),
  applicationRequired: integer('application_required').notNull().default(0),
  roleJoinMode: text('role_join_mode', { enum: ['open', 'profile', 'form'] }).notNull().default('open'),
  // A saved application can stay an internal draft. Public roles must opt in
  // before Civic-Participants can discover and submit it.
  applicationPublic: integer('application_public').notNull().default(0), activeFormId: text('active_form_id'),
  createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
})

// Answers retain the exact question version that was presented to the person.
export const onboardingApplicationForms = sqliteTable('onboarding_application_forms', {
  id: text('id').primaryKey(), taskId: text('task_id').notNull(), orgId: text('org_id').notNull(),
  version: integer('version').notNull(), introduction: text('introduction').notNull().default(''),
  questions: text('questions').notNull(), createdBy: text('created_by').notNull(), createdAt: integer('created_at').notNull(), archivedAt: integer('archived_at'),
}, t => ({ version: uniqueIndex('onboarding_application_form_version').on(t.taskId, t.version) }))

export const onboardingApplications = sqliteTable('onboarding_applications', {
  id: text('id').primaryKey(), taskId: text('task_id').notNull(), orgId: text('org_id').notNull(), userId: text('user_id').notNull(),
  formId: text('form_id').notNull(), answers: text('answers').notNull(),
  status: text('status', { enum: ['submitted', 'approved', 'not_approved'] }).notNull().default('submitted'),
  internalNote: text('internal_note').notNull().default(''), reviewedBy: text('reviewed_by'), reviewedAt: integer('reviewed_at'),
  createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
}, t => ({ person: uniqueIndex('onboarding_application_person').on(t.taskId, t.userId) }))

// Current organization-local participation decision, with append-only audit.
// No attendance, application, or credit history is deleted by a decision.
export const volunteerAdmissionDecisions = sqliteTable('volunteer_admission_decisions', {
  id: text('id').primaryKey(), orgId: text('org_id').notNull(), userId: text('user_id').notNull(),
  taskId: text('task_id').notNull(), claimId: text('claim_id').notNull(),
  status: text('status', { enum: ['approved', 'needs_paperwork', 'not_approved'] }).notNull(),
  assignmentMode: text('assignment_mode', { enum: ['all', 'specific'] }).notNull().default('all'),
  programIds: text('program_ids').notNull().default('[]'), paperWaiverIds: text('paper_waiver_ids').notNull().default('[]'),
  internalNote: text('internal_note').notNull().default(''), reviewedBy: text('reviewed_by').notNull(),
  createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
}, t => ({ person: uniqueIndex('volunteer_admission_person').on(t.orgId, t.userId) }))

export const volunteerIntakeDDL = [
  `CREATE TABLE IF NOT EXISTS onboarding_intakes (task_id TEXT PRIMARY KEY, org_id TEXT NOT NULL, assignment_mode TEXT NOT NULL DEFAULT 'all', program_ids TEXT NOT NULL DEFAULT '[]', flexible_capacity INTEGER NOT NULL DEFAULT 0, application_required INTEGER NOT NULL DEFAULT 0, role_join_mode TEXT NOT NULL DEFAULT 'open', application_public INTEGER NOT NULL DEFAULT 0, active_form_id TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS onboarding_application_forms (id TEXT PRIMARY KEY, task_id TEXT NOT NULL, org_id TEXT NOT NULL, version INTEGER NOT NULL, introduction TEXT NOT NULL DEFAULT '', questions TEXT NOT NULL, created_by TEXT NOT NULL, created_at INTEGER NOT NULL, archived_at INTEGER, UNIQUE(task_id,version))`,
  `CREATE TABLE IF NOT EXISTS onboarding_applications (id TEXT PRIMARY KEY, task_id TEXT NOT NULL, org_id TEXT NOT NULL, user_id TEXT NOT NULL, form_id TEXT NOT NULL, answers TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'submitted', internal_note TEXT NOT NULL DEFAULT '', reviewed_by TEXT, reviewed_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(task_id,user_id))`,
  `CREATE TABLE IF NOT EXISTS volunteer_admission_decisions (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, user_id TEXT NOT NULL, task_id TEXT NOT NULL, claim_id TEXT NOT NULL, status TEXT NOT NULL, assignment_mode TEXT NOT NULL DEFAULT 'all', program_ids TEXT NOT NULL DEFAULT '[]', paper_waiver_ids TEXT NOT NULL DEFAULT '[]', internal_note TEXT NOT NULL DEFAULT '', reviewed_by TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(org_id,user_id))`,
  `CREATE INDEX IF NOT EXISTS onboarding_intakes_org ON onboarding_intakes(org_id,created_at)`,
  `CREATE INDEX IF NOT EXISTS onboarding_applications_org_status ON onboarding_applications(org_id,status,created_at)`,
]
