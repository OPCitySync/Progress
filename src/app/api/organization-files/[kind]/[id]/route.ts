import { get } from '@vercel/blob'
import { and, eq, ne } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import {
  claims,
  organizationDocumentAssignments,
  organizationDocuments,
  organizationResourcePublications,
  shifts,
  tasks,
  waiverTaskAssignments,
  waiverVersions,
} from '@/lib/db/schema'
import { hasOrganizationPermission, validateActiveSession } from '@/lib/services/identity-access'

export const dynamic = 'force-dynamic'

type FileKind = 'document' | 'waiver'

type StoredFile = {
  id: string
  orgId: string
  url: string
  name: string | null
  contentType: string | null
}

function isFileKind(value: string): value is FileKind {
  return value === 'document' || value === 'waiver'
}

function safeFileName(name: string | null, fallback: string) {
  return (name || fallback).replace(/[\r\n"]/g, '_')
}

async function getStoredFile(kind: FileKind, id: string): Promise<StoredFile | null> {
  if (kind === 'document') {
    const row = (await db
      .select({ id: organizationDocuments.id, orgId: organizationDocuments.orgId, url: organizationDocuments.documentUrl, name: organizationDocuments.documentName, contentType: organizationDocuments.documentMimeType })
      .from(organizationDocuments)
      .where(and(eq(organizationDocuments.id, id), eq(organizationDocuments.active, 1)))
      .limit(1))[0]
    return row?.url ? { ...row, url: row.url } : null
  }

  const row = (await db
    .select({ id: waiverVersions.id, orgId: waiverVersions.orgId, url: waiverVersions.documentUrl, name: waiverVersions.documentName, contentType: waiverVersions.documentMimeType })
    .from(waiverVersions)
    .where(and(eq(waiverVersions.id, id), eq(waiverVersions.active, 1)))
    .limit(1))[0]
  return row?.url ? { ...row, url: row.url } : null
}

async function isPublishedFile(kind: FileKind, file: StoredFile) {
  const row = (await db
    .select({ id: organizationResourcePublications.id })
    .from(organizationResourcePublications)
    .where(and(
      eq(organizationResourcePublications.orgId, file.orgId),
      eq(organizationResourcePublications.resourceKind, kind),
      eq(organizationResourcePublications.resourceId, file.id),
    ))
    .limit(1))[0]
  return Boolean(row)
}

async function participantCanReadFile(input: { kind: FileKind; file: StoredFile; taskId: string; userId: string }) {
  const task = (await db
    .select({ id: tasks.id, isOnboarding: tasks.isOnboarding, status: tasks.status })
    .from(tasks)
    .where(and(eq(tasks.id, input.taskId), eq(tasks.orgId, input.file.orgId)))
    .limit(1))[0]
  if (!task) return false

  if (input.kind === 'document') {
    const assignment = (await db
      .select({ id: organizationDocumentAssignments.id })
      .from(organizationDocumentAssignments)
      .where(and(eq(organizationDocumentAssignments.documentId, input.file.id), eq(organizationDocumentAssignments.taskId, task.id)))
      .limit(1))[0]
    if (!assignment) return false
  } else if (task.isOnboarding !== 1) {
    const assignment = (await db
      .select({ id: waiverTaskAssignments.id })
      .from(waiverTaskAssignments)
      .where(and(eq(waiverTaskAssignments.waiverVersionId, input.file.id), eq(waiverTaskAssignments.taskId, task.id)))
      .limit(1))[0]
    if (!assignment) return false
  }

  const claim = (await db
    .select({ id: claims.id })
    .from(claims)
    .where(and(eq(claims.userId, input.userId), eq(claims.taskId, task.id), ne(claims.status, 'unclaimed')))
    .limit(1))[0]
  if (claim) return true

  // Materials on a public opportunity must be readable before a participant
  // reserves a spot; otherwise they could not review a waiver before agreeing
  // to it. Private shifts remain limited to their rostered participants.
  const publicShift = (await db
    .select({ id: shifts.id })
    .from(shifts)
    .where(and(eq(shifts.taskId, task.id), eq(shifts.visibility, 'public'), eq(shifts.status, 'open')))
    .limit(1))[0]
  return task.status === 'open' && Boolean(publicShift)
}

export async function GET(
  request: NextRequest,
  { params }: { params: { kind: string; id: string } },
) {
  if (!isFileKind(params.kind)) return new NextResponse('Not found', { status: 404 })
  const file = await getStoredFile(params.kind, params.id)
  if (!file) return new NextResponse('Not found', { status: 404 })

  const rawSession = await getSession()
  const session = rawSession ? await validateActiveSession(rawSession) : null
  const taskId = request.nextUrl.searchParams.get('taskId')
  const issuerPermission = params.kind === 'waiver' ? 'waiver.manage' : 'documents.manage'
  const issuerAuthorized = session?.role === 'issuer'
    && session.orgId === file.orgId
    && await hasOrganizationPermission(session, issuerPermission)
  const authorized = issuerAuthorized
    || (session?.role === 'participant' && taskId
      ? await participantCanReadFile({ kind: params.kind, file, taskId, userId: session.sub })
      : false)
    || await isPublishedFile(params.kind, file)

  if (!authorized) return new NextResponse('Not found', { status: 404 })

  // Local development records can still point to /uploads. The route keeps the
  // same authorization gate, then lets the local dev server serve that file.
  if (file.url.startsWith('/uploads/')) {
    return NextResponse.redirect(new URL(file.url, request.url))
  }

  const result = await get(file.url, {
    access: 'private',
    ifNoneMatch: request.headers.get('if-none-match') ?? undefined,
  })
  if (!result) return new NextResponse('Not found', { status: 404 })
  if (result.statusCode === 304) {
    return new NextResponse(null, {
      status: 304,
      headers: { ETag: result.blob.etag, 'Cache-Control': 'private, no-cache' },
    })
  }
  if (result.statusCode !== 200 || !result.stream) return new NextResponse('Not found', { status: 404 })

  const download = request.nextUrl.searchParams.get('download') === '1'
  const name = safeFileName(file.name, `${params.kind}-${file.id}`)
  return new NextResponse(result.stream, {
    headers: {
      'Content-Type': result.blob.contentType || file.contentType || 'application/octet-stream',
      'Content-Disposition': download
        ? `attachment; filename="${name}"`
        : result.blob.contentDisposition || `inline; filename="${name}"`,
      'X-Content-Type-Options': 'nosniff',
      ETag: result.blob.etag,
      'Cache-Control': 'private, no-cache',
    },
  })
}
