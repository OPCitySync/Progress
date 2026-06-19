import { createClient, type Client } from '@libsql/client'
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql'
import * as schema from './schema'

type DB = LibSQLDatabase<typeof schema>

const globalForDb = globalThis as unknown as { __citysyncClient?: Client; __citysyncDb?: DB }

function makeClient(): Client {
  return createClient({
    url: process.env.DATABASE_URL ?? 'file:local.db',
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  })
}

export const client: Client = globalForDb.__citysyncClient ?? makeClient()
export const db: DB = globalForDb.__citysyncDb ?? drizzle(client, { schema })

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__citysyncClient = client
  globalForDb.__citysyncDb = db
}
