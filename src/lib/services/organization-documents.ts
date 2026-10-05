import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { organizationDocumentAssignments, organizationDocuments } from '@/lib/db/schema'

export const ORGANIZATION_DOCUMENT_CATEGORIES = ['guide', 'safety', 'template'] as const
export type OrganizationDocumentCategory = (typeof ORGANIZATION_DOCUMENT_CATEGORIES)[number]

export const ORGANIZATION_DOCUMENT_CATEGORY_DETAILS: Record<OrganizationDocumentCategory, { label: string; description: string }> = {
  guide: {
    label: 'Volunteer Guides',
    description: 'Handbooks, role guides, training notes, and event-day briefings.',
  },
  safety: {
    label: 'Safety & Operations',
    description: 'Safety plans, emergency instructions, site procedures, and equipment lists.',
  },
  template: {
    label: 'Additional Documents',
    description: 'Reusable checklists, project plans, after-action reports, and other team materials.',
  },
}

export function isOrganizationDocumentCategory(value: string): value is OrganizationDocumentCategory {
  return ORGANIZATION_DOCUMENT_CATEGORIES.includes(value as OrganizationDocumentCategory)
}

export async function getOrganizationDocuments(orgId: string) {
  const documents = await db
    .select()
    .from(organizationDocuments)
    .where(and(eq(organizationDocuments.orgId, orgId), eq(organizationDocuments.active, 1)))
    .orderBy(desc(organizationDocuments.updatedAt))

  if (documents.length === 0) return []
  const assignments = await db
    .select()
    .from(organizationDocumentAssignments)
    .where(inArray(organizationDocumentAssignments.documentId, documents.map((document) => document.id)))

  const taskIdsByDocument = new Map<string, string[]>()
  for (const assignment of assignments) {
    taskIdsByDocument.set(assignment.documentId, [...(taskIdsByDocument.get(assignment.documentId) ?? []), assignment.taskId])
  }

  return documents.map((document) => ({
    ...document,
    taskIds: taskIdsByDocument.get(document.id) ?? [],
  }))
}
