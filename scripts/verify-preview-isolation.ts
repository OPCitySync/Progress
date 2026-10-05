import assert from 'node:assert/strict'
import { mkdtempSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { previewDatabaseUrl } from '../src/lib/db/preview-url'
import { cityDatabaseUrl } from '../src/lib/db/city-client'

async function main() {
  const directory = mkdtempSync(join(tmpdir(), 'citysync-isolation-'))
  // Deliberately set conflicting URLs: neither may win over preview mode.
  process.env.DATABASE_URL = 'file:must-not-open.db'
  process.env.CITY_DB_BERKELEY_URL = 'file:must-not-open-city.db'
  process.env.CITYSYNC_PREVIEW_DATABASE_DIR = directory
  assert.equal(previewDatabaseUrl('application.db'), `file:${join(directory, 'application.db')}`)
  assert.equal(cityDatabaseUrl('berkeley'), `file:${join(directory, 'city-berkeley.db')}`)
  assert.equal(cityDatabaseUrl('new-preview-city'), `file:${join(directory, 'city-new-preview-city.db')}`)
  const { client } = await import('../src/lib/db/client')
  const databases = await client.execute('PRAGMA database_list')
  assert.equal(realpathSync(String(databases.rows[0].file)), realpathSync(join(directory, 'application.db')))
  client.close()
  process.env.CITYSYNC_PREVIEW_DATABASE_DIR = 'relative-directory'
  assert.throws(() => previewDatabaseUrl('application.db'), /absolute local directory/)
  process.env.CITYSYNC_PREVIEW_DATABASE_DIR = directory
  process.env.VERCEL = '1'
  assert.throws(() => previewDatabaseUrl('application.db'), /outside Vercel/)
  delete process.env.CITYSYNC_PREVIEW_DATABASE_DIR
  delete process.env.CITY_DB_BERKELEY_URL
  assert.throws(() => cityDatabaseUrl('berkeley'), /required for Vercel deployments/)
  console.log('PASS: preview overrides configured application and city URLs, isolates new cities, rejects relative directories and Vercel.')
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
