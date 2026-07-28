import { randomUUID } from 'crypto'
import { and, asc, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { catalogEntries, opportunityTypes, orgs } from '@/lib/db/schema'
import { appendEvent } from '@/lib/ledger/ledger'
import { EventTypes } from '@/lib/ledger/events'
import { features } from '@/lib/config'
import { isCredentialKey } from '@/lib/credentials'
import type { Result } from './identity'
import { normalizeOrganizationLocation, rememberOrganizationLocation } from './organization-locations'

export type CatalogEntryRow = typeof catalogEntries.$inferSelect
export type OpportunityTypeRow = typeof opportunityTypes.$inferSelect

/** Whether a template can be used to schedule a real opportunity. When the
 *  approval gate is off (iteration 1), any non-rejected template is usable. */
export function isEntryUsable(status: string): boolean {
  return features().catalogApproval ? status === 'approved' : status !== 'rejected'
}

export async function listTypes(): Promise<OpportunityTypeRow[]> {
  return db
    .select()
    .from(opportunityTypes)
    .where(eq(opportunityTypes.active, 1))
    .orderBy(asc(opportunityTypes.category), asc(opportunityTypes.name))
}

export async function listOrgEntries(orgId: string): Promise<CatalogEntryRow[]> {
  return db.select().from(catalogEntries).where(eq(catalogEntries.orgId, orgId)).orderBy(desc(catalogEntries.updatedAt))
}

export async function getEntry(entryId: string): Promise<CatalogEntryRow | null> {
  return (await db.select().from(catalogEntries).where(eq(catalogEntries.id, entryId)).limit(1))[0] ?? null
}

/** A template owned by the org that is currently usable for scheduling. */
export async function getUsableEntry(entryId: string, orgId: string): Promise<CatalogEntryRow | null> {
  const e = await getEntry(entryId)
  if (!e || e.orgId !== orgId || !isEntryUsable(e.status)) return null
  return e
}

type EntryInput = {
  typeId?: string
  title: string
  description?: string
  location?: string
  defaultCredits?: number
  requiredCredentials?: string[]
}

export async function createEntry(input: EntryInput & { orgId: string; actorId: string }): Promise<Result<{ id: string }>> {
  if (!input.title.trim()) return { ok: false, error: 'Title is required.' }
  const location = normalizeOrganizationLocation(input.location ?? '')
  if (location.length > 240) return { ok: false, error: 'Default locations are limited to 240 characters.' }
  const id = randomUUID()
  const now = Date.now()
  await db.transaction(async (tx) => {
    await tx.insert(catalogEntries).values({
      id,
      orgId: input.orgId,
      typeId: input.typeId || null,
      title: input.title.trim(),
      description: (input.description ?? '').trim(),
      location,
      defaultCredits: input.defaultCredits ?? null,
      requiredCredentials: JSON.stringify((input.requiredCredentials ?? []).filter(isCredentialKey)),
      status: 'draft',
      reviewNote: '',
      createdBy: input.actorId,
      createdAt: now,
      updatedAt: now,
    })
    await rememberOrganizationLocation(tx, { orgId: input.orgId, address: location })
  })
  return { ok: true, id }
}

export async function updateEntry(entryId: string, orgId: string, input: EntryInput): Promise<Result> {
  const e = await getEntry(entryId)
  if (!e || e.orgId !== orgId) return { ok: false, error: 'Template not found.' }
  if (e.status !== 'draft' && e.status !== 'needs_changes') {
    return { ok: false, error: 'This template can’t be edited while it’s under review or approved.' }
  }
  if (!input.title.trim()) return { ok: false, error: 'Title is required.' }
  const location = normalizeOrganizationLocation(input.location ?? '')
  if (location.length > 240) return { ok: false, error: 'Default locations are limited to 240 characters.' }
  await db.transaction(async (tx) => {
    await tx
      .update(catalogEntries)
      .set({
        typeId: input.typeId || null,
        title: input.title.trim(),
        description: (input.description ?? '').trim(),
        location,
        defaultCredits: input.defaultCredits ?? null,
        requiredCredentials: JSON.stringify((input.requiredCredentials ?? []).filter(isCredentialKey)),
        updatedAt: Date.now(),
      })
      .where(eq(catalogEntries.id, entryId))
    await rememberOrganizationLocation(tx, { orgId, address: location })
  })
  return { ok: true }
}

export async function submitEntry(entryId: string, orgId: string, actorId: string): Promise<Result> {
  const e = await getEntry(entryId)
  if (!e || e.orgId !== orgId) return { ok: false, error: 'Template not found.' }
  if (e.status !== 'draft' && e.status !== 'needs_changes') {
    return { ok: false, error: `This template is already ${e.status.replace('_', ' ')}.` }
  }
  await db.transaction(async (tx) => {
    await tx.update(catalogEntries).set({ status: 'submitted', updatedAt: Date.now() }).where(eq(catalogEntries.id, entryId))
    await appendEvent(tx, EventTypes.CATALOG_ENTRY_SUBMITTED, { entryId, orgId }, actorId)
  })
  return { ok: true }
}

export type ReviewDecision = 'approved' | 'rejected' | 'needs_changes'

export async function reviewEntry(
  entryId: string,
  actorId: string,
  decision: ReviewDecision,
  note: string,
  typeId?: string,
): Promise<Result> {
  const e = await getEntry(entryId)
  if (!e) return { ok: false, error: 'Template not found.' }
  if (e.status !== 'submitted') return { ok: false, error: 'Only submitted templates can be reviewed.' }

  const event =
    decision === 'approved'
      ? EventTypes.CATALOG_ENTRY_APPROVED
      : decision === 'rejected'
        ? EventTypes.CATALOG_ENTRY_REJECTED
        : EventTypes.CATALOG_ENTRY_CHANGES_REQUESTED

  await db.transaction(async (tx) => {
    await tx
      .update(catalogEntries)
      .set({ status: decision, reviewNote: note ?? '', typeId: typeId || e.typeId, updatedAt: Date.now() })
      .where(eq(catalogEntries.id, entryId))
    await appendEvent(tx, event, { entryId, orgId: e.orgId, decision }, actorId)
  })
  return { ok: true }
}

export type SubmittedEntry = { entry: CatalogEntryRow; orgName: string }

/** Admin review queue: templates awaiting a decision. */
export async function listSubmittedEntries(cityId?: string): Promise<SubmittedEntry[]> {
  const rows = await db
    .select({ entry: catalogEntries, orgName: orgs.name })
    .from(catalogEntries)
    .innerJoin(orgs, eq(catalogEntries.orgId, orgs.id))
    .where(
      cityId
        ? and(eq(catalogEntries.status, 'submitted'), eq(orgs.requestedCityId, cityId))
        : eq(catalogEntries.status, 'submitted'),
    )
    .orderBy(asc(catalogEntries.updatedAt))
  return rows.map((r) => ({ entry: r.entry, orgName: r.orgName }))
}
