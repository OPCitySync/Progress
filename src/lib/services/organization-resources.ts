import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import {
  organizationResourcePublications,
  organizationDocuments,
  waiverTaskAssignments,
  waiverVersions,
} from '@/lib/db/schema'

export const RESOURCE_DESTINATIONS = ['profile', 'volunteer_resources'] as const
export type ResourceDestination = (typeof RESOURCE_DESTINATIONS)[number]
export type OrganizationResourceKind = 'document' | 'waiver'

export type PublishedOrganizationResource = {
  id: string
  orgId: string
  kind: OrganizationResourceKind
  title: string
  body: string
  documentUrl: string | null
  documentName: string | null
  category?: string
}

export function resourceKey(kind: OrganizationResourceKind, id: string) {
  return `${kind}:${id}`
}

/** Destinations currently selected for every resource in an organization. */
export async function getOrganizationResourcePublicationMap(orgId: string) {
  const rows = await db
    .select({ resourceKind: organizationResourcePublications.resourceKind, resourceId: organizationResourcePublications.resourceId, destination: organizationResourcePublications.destination })
    .from(organizationResourcePublications)
    .where(eq(organizationResourcePublications.orgId, orgId))

  const map = new Map<string, ResourceDestination[]>()
  for (const row of rows) {
    const key = resourceKey(row.resourceKind, row.resourceId)
    map.set(key, [...(map.get(key) ?? []), row.destination])
  }
  return map
}

/** Current task requirements for active waivers. They do not affect the
 * separate onboarding acceptance requirement. */
export async function getWaiverTaskIdsByWaiver(orgId: string) {
  const waivers = await db
    .select({ id: waiverVersions.id })
    .from(waiverVersions)
    .where(and(eq(waiverVersions.orgId, orgId), eq(waiverVersions.active, 1)))
  if (!waivers.length) return new Map<string, string[]>()

  const assignments = await db
    .select({ waiverVersionId: waiverTaskAssignments.waiverVersionId, taskId: waiverTaskAssignments.taskId })
    .from(waiverTaskAssignments)
    .where(inArray(waiverTaskAssignments.waiverVersionId, waivers.map((waiver) => waiver.id)))

  const map = new Map<string, string[]>()
  for (const assignment of assignments) {
    map.set(assignment.waiverVersionId, [...(map.get(assignment.waiverVersionId) ?? []), assignment.taskId])
  }
  return map
}

/** Resources intentionally shared with a given public surface. */
export async function getPublishedOrganizationResources(input: {
  orgIds: string[]
  destination: ResourceDestination
}): Promise<PublishedOrganizationResource[]> {
  const orgIds = Array.from(new Set(input.orgIds))
  if (!orgIds.length) return []

  const publications = await db
    .select({ orgId: organizationResourcePublications.orgId, resourceKind: organizationResourcePublications.resourceKind, resourceId: organizationResourcePublications.resourceId })
    .from(organizationResourcePublications)
    .where(and(inArray(organizationResourcePublications.orgId, orgIds), eq(organizationResourcePublications.destination, input.destination)))
  if (!publications.length) return []

  const documentIds = publications.filter((row) => row.resourceKind === 'document').map((row) => row.resourceId)
  const waiverIds = publications.filter((row) => row.resourceKind === 'waiver').map((row) => row.resourceId)
  const [documents, waivers] = await Promise.all([
    documentIds.length
      ? db.select().from(organizationDocuments).where(and(inArray(organizationDocuments.id, documentIds), eq(organizationDocuments.active, 1)))
      : Promise.resolve([]),
    waiverIds.length
      ? db.select().from(waiverVersions).where(and(inArray(waiverVersions.id, waiverIds), eq(waiverVersions.active, 1)))
      : Promise.resolve([]),
  ])

  const documentById = new Map(documents.map((document) => [document.id, document]))
  const waiverById = new Map(waivers.map((waiver) => [waiver.id, waiver]))
  return publications.flatMap((publication): PublishedOrganizationResource[] => {
    if (publication.resourceKind === 'document') {
      const document = documentById.get(publication.resourceId)
      return document ? [{
        id: document.id,
        orgId: document.orgId,
        kind: 'document',
        title: document.title,
        body: document.body,
        documentUrl: document.documentUrl,
        documentName: document.documentName,
        category: document.category,
      }] : []
    }
    const waiver = waiverById.get(publication.resourceId)
    return waiver ? [{
      id: waiver.id,
      orgId: waiver.orgId,
      kind: 'waiver',
      title: waiver.title,
      body: waiver.body,
      documentUrl: waiver.documentUrl,
      documentName: waiver.documentName,
    }] : []
  })
}

/** Active waivers deliberately required by a non-onboarding task. */
export async function getWaiversAttachedToTask(taskId: string) {
  return db
    .select({ waiver: waiverVersions })
    .from(waiverTaskAssignments)
    .innerJoin(waiverVersions, eq(waiverTaskAssignments.waiverVersionId, waiverVersions.id))
    .where(and(eq(waiverTaskAssignments.taskId, taskId), eq(waiverVersions.active, 1)))
    .then((rows) => rows.map((row) => row.waiver))
}
