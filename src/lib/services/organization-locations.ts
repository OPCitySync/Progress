import { randomUUID } from 'crypto'
import { and, asc, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { organizationLocations } from '@/lib/db/schema'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type DbOrTx = typeof db | Tx

export type OrganizationLocation = {
  id: string
  address: string
  isDefault: boolean
}

export function normalizeOrganizationLocation(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export async function getOrganizationLocations(orgId: string): Promise<OrganizationLocation[]> {
  const rows = await db
    .select()
    .from(organizationLocations)
    .where(eq(organizationLocations.orgId, orgId))
    .orderBy(desc(organizationLocations.isDefault), asc(organizationLocations.address))
  return rows.map((row) => ({ id: row.id, address: row.address, isDefault: row.isDefault === 1 }))
}

/**
 * Retain a location the organization used in an issuer workflow. The first
 * retained location becomes the default unless a caller explicitly supplies
 * the organization’s primary address as the default during signup.
 */
export async function rememberOrganizationLocation(
  tx: DbOrTx,
  input: { orgId: string; address: string; makeDefault?: boolean },
): Promise<string | null> {
  const address = normalizeOrganizationLocation(input.address)
  if (!address) return null
  if (address.length > 240) throw new Error('Locations are limited to 240 characters.')

  const currentDefault = (
    await tx
      .select({ id: organizationLocations.id })
      .from(organizationLocations)
      .where(and(eq(organizationLocations.orgId, input.orgId), eq(organizationLocations.isDefault, 1)))
      .orderBy(desc(organizationLocations.isDefault))
      .limit(1)
  )[0]
  const makeDefault = input.makeDefault || !currentDefault
  const now = Date.now()

  if (makeDefault) {
    await tx
      .update(organizationLocations)
      .set({ isDefault: 0, updatedAt: now })
      .where(eq(organizationLocations.orgId, input.orgId))
  }

  await tx
    .insert(organizationLocations)
    .values({
      id: randomUUID(),
      orgId: input.orgId,
      address,
      isDefault: makeDefault ? 1 : 0,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [organizationLocations.orgId, organizationLocations.address],
      set: { updatedAt: now, ...(makeDefault ? { isDefault: 1 } : {}) },
    })

  return address
}
