import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import { createClient } from '@libsql/client'

const databasePath = '/tmp/mycity-password-reset-verification.db'
rmSync(databasePath, { force: true })
process.env.DATABASE_URL = `file:${databasePath}`
process.env.AUTH_SECRET = 'password-reset-verification-secret'
process.env.REMINDER_EMAIL_MODE = 'stub'

async function main() {
  const setup = createClient({ url: process.env.DATABASE_URL! })
  await setup.batch([
    `CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      session_version INTEGER NOT NULL DEFAULT 0,
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      org_id TEXT,
      credit_balance INTEGER NOT NULL DEFAULT 0,
      lifetime_earned INTEGER NOT NULL DEFAULT 0,
      interests TEXT NOT NULL DEFAULT '[]',
      neighborhood TEXT NOT NULL DEFAULT '',
      resume_token TEXT,
      resume_public INTEGER NOT NULL DEFAULT 0,
      username TEXT,
      avatar_url TEXT NOT NULL DEFAULT '',
      banner_style TEXT NOT NULL DEFAULT 'original',
      banner_palette TEXT NOT NULL DEFAULT 'citysync',
      home_city_id TEXT,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE password_reset_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      email_hash TEXT NOT NULL,
      requester_hash TEXT NOT NULL,
      token_hash TEXT UNIQUE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at INTEGER
    )`,
  ])
  setup.close()

  const [{ db, client }, { users }, password, reset] = await Promise.all([
    import('../src/lib/db/client'),
    import('../src/lib/db/schema'),
    import('../src/lib/auth/password'),
    import('../src/lib/services/password-reset'),
  ])

  const oldPassword = 'Old-password-123'
  const newPassword = 'New-password-456'
  await db.insert(users).values({
    id: 'password-reset-user',
    email: 'person@example.org',
    name: 'Password Reset Person',
    passwordHash: await password.hashPassword(oldPassword),
    sessionVersion: 0,
    role: 'participant',
    status: 'active',
    createdAt: Date.now(),
  })

  const unknown = await reset.requestPasswordReset({
    email: 'unknown@example.org',
    requesterIdentifier: '127.0.0.2',
    baseUrl: 'http://127.0.0.1:4320',
  })
  assert.equal(unknown.developmentToken, undefined, 'unknown addresses must not receive or reveal a token')

  const requested = await reset.requestPasswordReset({
    email: 'PERSON@example.org',
    requesterIdentifier: '127.0.0.1',
    baseUrl: 'http://127.0.0.1:4320',
  })
  assert.ok(requested.developmentToken, 'stub delivery should expose a local-only verification token')
  assert.equal(await reset.isPasswordResetTokenValid(requested.developmentToken), true)

  const completed = await reset.resetPasswordWithToken({
    token: requested.developmentToken,
    password: newPassword,
  })
  assert.deepEqual(completed, { ok: true })

  const user = (await db.select().from(users).limit(1))[0]
  assert.equal(await password.verifyPassword(oldPassword, user.passwordHash), false)
  assert.equal(await password.verifyPassword(newPassword, user.passwordHash), true)
  assert.equal(user.sessionVersion, 1, 'password reset should revoke existing signed sessions')
  assert.equal(await reset.isPasswordResetTokenValid(requested.developmentToken), false)

  const reused = await reset.resetPasswordWithToken({
    token: requested.developmentToken,
    password: 'Another-password-789',
  })
  assert.equal(reused.ok, false, 'a reset token must be single-use')

  client.close()
  rmSync(databasePath, { force: true })
  console.log('✓ Password reset token lifecycle verified')
}

main().catch((error) => {
  rmSync(databasePath, { force: true })
  console.error(error)
  process.exit(1)
})
