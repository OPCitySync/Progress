import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core'

// Program scope uses "organization" for shared organization onboarding/work.
export const programWorkspaceSettings = sqliteTable('program_workspace_settings', {
  id: text('id').primaryKey(), orgId: text('org_id').notNull(), scope: text('scope').notNull(),
  onboardingMode: text('onboarding_mode', { enum: ['organization', 'program', 'none'] }).notNull(),
  headline: text('headline').notNull().default(''), welcome: text('welcome').notNull().default(''),
  requireSession: integer('require_session').notNull().default(0),
  waiverMethod: text('waiver_method', { enum: ['digital', 'paper', 'either'] }).notNull().default('digital'),
  documentIds: text('document_ids').notNull().default('[]'), updatedAt: integer('updated_at').notNull(),
}, t => ({ scopeUnique: uniqueIndex('program_workspace_scope').on(t.orgId, t.scope) }))

export const programApplicants = sqliteTable('program_applicants', {
  id: text('id').primaryKey(), orgId: text('org_id').notNull(), scope: text('scope').notNull(), userId: text('user_id').notNull(),
  status: text('status', { enum: ['preparing', 'submitted', 'approved', 'declined'] }).notNull().default('preparing'),
  paperWaiverConfirmedAt: integer('paper_waiver_confirmed_at'), paperWaiverIds: text('paper_waiver_ids').notNull().default('[]'), reviewedAt: integer('reviewed_at'),
  reviewedBy: text('reviewed_by'), submittedAt: integer('submitted_at'),
  createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
}, t => ({ personScopeUnique: uniqueIndex('program_applicant_scope_user').on(t.orgId, t.scope, t.userId) }))

export const programDocumentReceipts = sqliteTable('program_document_receipts', {
  id: text('id').primaryKey(), orgId: text('org_id').notNull(), userId: text('user_id').notNull(),
  documentId: text('document_id').notNull(), documentUpdatedAt: integer('document_updated_at').notNull(),
  receivedAt: integer('received_at').notNull(),
}, t => ({ receiptUnique: uniqueIndex('program_document_receipt').on(t.userId, t.documentId, t.documentUpdatedAt) }))

export const programWorkAreas = sqliteTable('program_work_areas', {
  id: text('id').primaryKey(), orgId: text('org_id').notNull(), scope: text('scope').notNull(),
  title: text('title').notNull(), purpose: text('purpose').notNull().default(''),
  nextStep: text('next_step').notNull().default(''),
  status: text('status', { enum: ['exploring', 'active', 'complete'] }).notNull().default('active'),
  taskIds: text('task_ids').notNull().default('[]'), updatedAt: integer('updated_at').notNull(),
})
export const programMetrics = sqliteTable('program_metrics', {
  id: text('id').primaryKey(), orgId: text('org_id').notNull(), scope: text('scope').notNull(),
  title: text('title').notNull(), unit: text('unit').notNull(), target: real('target'),
  periodStart: text('period_start').notNull(), periodEnd: text('period_end').notNull(),
  archivedAt: integer('archived_at'), createdAt: integer('created_at').notNull(),
})
export const programMetricEntries = sqliteTable('program_metric_entries', {
  id: text('id').primaryKey(), metricId: text('metric_id').notNull(), orgId: text('org_id').notNull(),
  amount: real('amount').notNull(), date: text('date').notNull(), note: text('note').notNull().default(''),
  actorId: text('actor_id').notNull(), createdAt: integer('created_at').notNull(),
})
export const programRecognitions = sqliteTable('program_recognitions', {
  id: text('id').primaryKey(), orgId: text('org_id').notNull(), scope: text('scope').notNull(),
  shiftId: text('shift_id').notNull(), userId: text('user_id'),
  kind: text('kind', { enum: ['personal', 'team', 'letter'] }).notNull(),
  message: text('message').notNull(), recipientNames: text('recipient_names').notNull(),
  actorId: text('actor_id').notNull(), createdAt: integer('created_at').notNull(),
})

// Kept additive so existing programs and ledger records can be restored without
// rolling back or rewriting historical events.
export const programWorkspaceDDL = [
  `CREATE TABLE IF NOT EXISTS program_workspace_settings (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, scope TEXT NOT NULL, onboarding_mode TEXT NOT NULL, headline TEXT NOT NULL DEFAULT '', welcome TEXT NOT NULL DEFAULT '', require_session INTEGER NOT NULL DEFAULT 0, waiver_method TEXT NOT NULL DEFAULT 'digital', document_ids TEXT NOT NULL DEFAULT '[]', updated_at INTEGER NOT NULL, UNIQUE(org_id, scope))`,
  `CREATE TABLE IF NOT EXISTS program_applicants (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, scope TEXT NOT NULL, user_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'preparing', paper_waiver_confirmed_at INTEGER, paper_waiver_ids TEXT NOT NULL DEFAULT '[]', reviewed_at INTEGER, reviewed_by TEXT, submitted_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(org_id, scope, user_id))`,
  `CREATE TABLE IF NOT EXISTS program_document_receipts (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, user_id TEXT NOT NULL, document_id TEXT NOT NULL, document_updated_at INTEGER NOT NULL, received_at INTEGER NOT NULL, UNIQUE(user_id, document_id, document_updated_at))`,
  `CREATE TABLE IF NOT EXISTS program_work_areas (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, scope TEXT NOT NULL, title TEXT NOT NULL, purpose TEXT NOT NULL DEFAULT '', next_step TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'active', task_ids TEXT NOT NULL DEFAULT '[]', updated_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS program_metrics (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, scope TEXT NOT NULL, title TEXT NOT NULL, unit TEXT NOT NULL, target REAL, period_start TEXT NOT NULL, period_end TEXT NOT NULL, archived_at INTEGER, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS program_metric_entries (id TEXT PRIMARY KEY, metric_id TEXT NOT NULL, org_id TEXT NOT NULL, amount REAL NOT NULL, date TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', actor_id TEXT NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS program_recognitions (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, scope TEXT NOT NULL, shift_id TEXT NOT NULL, user_id TEXT, kind TEXT NOT NULL, message TEXT NOT NULL, recipient_names TEXT NOT NULL, actor_id TEXT NOT NULL, created_at INTEGER NOT NULL)`,
]
