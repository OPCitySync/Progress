import { createClient, type Client } from '@libsql/client'
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql'
import * as citySchema from './city-schema'

type CityDatabase = LibSQLDatabase<typeof citySchema>

const globalForCityDb = globalThis as unknown as {
  __citysyncCityClients?: Map<string, Client>
  __citysyncCityDbs?: Map<string, CityDatabase>
}

const clients = globalForCityDb.__citysyncCityClients ?? new Map<string, Client>()
const databases = globalForCityDb.__citysyncCityDbs ?? new Map<string, CityDatabase>()

if (process.env.NODE_ENV !== 'production') {
  globalForCityDb.__citysyncCityClients = clients
  globalForCityDb.__citysyncCityDbs = databases
}

function cityEnvKey(cityId: string) {
  return `CITY_DB_${cityId.replace(/[^a-z0-9]/gi, '_').toUpperCase()}_URL`
}

/**
 * Resolve a city database without exposing its URL to the browser. Production
 * deploys set one CITY_DB_<CITY>_URL per city; local development uses a real,
 * separate SQLite file for each launch city.
 */
export function cityDatabaseUrl(cityId: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cityId)) {
    throw new Error(`Invalid city database identifier "${cityId}".`)
  }
  const configured = process.env[cityEnvKey(cityId)]
  if (configured) return configured
  return `file:city-${cityId}.db`
}

const citySchemaStatements = [
  `CREATE TABLE IF NOT EXISTS city_meta (city_id TEXT PRIMARY KEY, schema_version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS wallets (user_id TEXT PRIMARY KEY, credit_balance INTEGER NOT NULL DEFAULT 0, lifetime_earned INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS credit_entries (id TEXT PRIMARY KEY, ref_id TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL, amount INTEGER NOT NULL, kind TEXT NOT NULL, reason TEXT NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS credit_entries_user ON credit_entries (user_id)`,
  `CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, type TEXT NOT NULL, payload TEXT NOT NULL, actor_id TEXT, ts INTEGER NOT NULL, prev_hash TEXT NOT NULL, hash TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS anchors (id TEXT PRIMARY KEY, from_seq INTEGER NOT NULL, to_seq INTEGER NOT NULL, event_count INTEGER NOT NULL, merkle_root TEXT NOT NULL, network TEXT NOT NULL, tx_hash TEXT, created_at INTEGER NOT NULL)`,
]

/** Create the isolated ledger/wallet database used by one newly approved city. */
export async function provisionCityDatabase(cityId: string) {
  const client = getCityClient(cityId)
  for (const statement of citySchemaStatements) await client.execute(statement)
  await client.execute({
    sql: `INSERT OR IGNORE INTO city_meta (city_id, schema_version, created_at) VALUES (?, 1, ?)`,
    args: [cityId, Date.now()],
  })
}

export function getCityClient(cityId: string): Client {
  const existing = clients.get(cityId)
  if (existing) return existing
  const client = createClient({
    url: cityDatabaseUrl(cityId),
    authToken: process.env[cityEnvKey(cityId).replace(/_URL$/, '_AUTH_TOKEN')] || undefined,
  })
  clients.set(cityId, client)
  return client
}

export function getCityDb(cityId: string): CityDatabase {
  const existing = databases.get(cityId)
  if (existing) return existing
  const database = drizzle(getCityClient(cityId), { schema: citySchema })
  databases.set(cityId, database)
  return database
}

export type { CityDatabase }
