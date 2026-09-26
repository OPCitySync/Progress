/** Isolated local integration preview. Never reuses an existing application database. */
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const data = resolve(root, '.integration-preview')
const command = process.argv[2] ?? 'dev'
if (!['setup', 'dev', 'build'].includes(command)) throw new Error('Use setup, dev, or build.')
if (process.env.VERCEL) throw new Error('The coordination preview is for local development only.')
mkdirSync(data, { recursive: true })
const env = {
  ...process.env,
  CITYSYNC_PREVIEW_DATABASE_DIR: data,
  DATABASE_URL: `file:${resolve(data, 'application.db')}`,
  DATABASE_AUTH_TOKEN: '',
  AUTH_SECRET: 'citysync-isolated-local-coordination-preview-only',
  REMINDER_EMAIL_MODE: 'stub', RESEND_API_KEY: '', ANCHOR_MODE: 'stub', STORAGE_MODE: 'local',
  APP_URL: 'http://127.0.0.1:4320', NEXT_TELEMETRY_DISABLED: '1',
}
function run(bin, args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [bin, ...args], { cwd: root, env, stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code, signal) => code === 0 ? resolveRun() : reject(new Error(`Preview command failed (${signal ?? code}).`)))
  })
}
const tsx = resolve(root, 'node_modules/tsx/dist/cli.mjs')
const next = resolve(root, 'node_modules/next/dist/bin/next')
if (command === 'setup') {
  await run(tsx, ['scripts/migrate.ts'])
  await run(tsx, ['scripts/seed.ts'])
  console.log('Local demo ready. Issuer: issuer@demo.city-sync.org / demo1234. Run npm run preview:coordination.')
} else if (command === 'build') {
  await run(next, ['build'])
} else {
  await run(next, ['dev', '--hostname', '127.0.0.1', '--port', '4320'])
}
