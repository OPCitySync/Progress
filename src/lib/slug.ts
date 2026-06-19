import { eq } from 'drizzle-orm'
import { orgs } from '@/lib/db/schema'
import type { DbOrTx } from '@/lib/ledger/ledger'

/** Lowercase, URL-safe handle derived from a name. */
export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'org'
  )
}

/**
 * Produce a slug for `name` that is unique across orgs, appending -2, -3, …
 * on collision. Runs inside the caller's transaction so registration stays
 * atomic.
 */
export async function uniqueOrgSlug(tx: DbOrTx, name: string): Promise<string> {
  const base = slugify(name)
  let candidate = base
  let n = 2
  // Loop is bounded in practice; org names colliding 100+ times is not a concern.
  while (true) {
    const hit = await tx.select({ id: orgs.id }).from(orgs).where(eq(orgs.slug, candidate)).limit(1)
    if (hit.length === 0) return candidate
    candidate = `${base}-${n++}`
  }
}
