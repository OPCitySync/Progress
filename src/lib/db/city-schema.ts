import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

// These tables exist inside *each* city database. They deliberately reuse
// generic table names because the database boundary, rather than a city_id
// column, is the tenancy boundary.

export const cityMeta = sqliteTable('city_meta', {
  cityId: text('city_id').primaryKey(),
  schemaVersion: integer('schema_version').notNull().default(1),
  createdAt: integer('created_at').notNull(),
})

export const cityWallets = sqliteTable('wallets', {
  userId: text('user_id').primaryKey(),
  creditBalance: integer('credit_balance').notNull().default(0),
  lifetimeEarned: integer('lifetime_earned').notNull().default(0),
  updatedAt: integer('updated_at').notNull(),
})

// Every mint or burn gets an idempotency key. This protects the city wallet
// when a request must be retried across the control-plane/city-db boundary.
export const cityCreditEntries = sqliteTable(
  'credit_entries',
  {
    id: text('id').primaryKey(),
    refId: text('ref_id').notNull(),
    userId: text('user_id').notNull(),
    amount: integer('amount').notNull(),
    kind: text('kind', { enum: ['mint', 'burn'] }).notNull(),
    reason: text('reason').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({
    reference: uniqueIndex('credit_entries_ref').on(t.refId),
    byUser: index('credit_entries_user').on(t.userId),
  }),
)

export const cityEvents = sqliteTable('events', {
  seq: integer('seq').primaryKey({ autoIncrement: true }),
  id: text('id').notNull().unique(),
  type: text('type').notNull(),
  payload: text('payload').notNull(),
  actorId: text('actor_id'),
  ts: integer('ts').notNull(),
  prevHash: text('prev_hash').notNull(),
  hash: text('hash').notNull(),
})

export const cityAnchors = sqliteTable('anchors', {
  id: text('id').primaryKey(),
  fromSeq: integer('from_seq').notNull(),
  toSeq: integer('to_seq').notNull(),
  eventCount: integer('event_count').notNull(),
  merkleRoot: text('merkle_root').notNull(),
  network: text('network').notNull(),
  txHash: text('tx_hash'),
  createdAt: integer('created_at').notNull(),
})
