import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import {
  toCsv,
  contributionsReport,
  organizationsReport,
  participantsReport,
  creditsReport,
  type Report,
} from '@/lib/services/reports'

export const dynamic = 'force-dynamic'

/**
 * CSV exports. Admins can pull any report; issuers can export only their own
 * organization's contributions. Returns a downloadable text/csv attachment.
 */
export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return new NextResponse('Unauthorized', { status: 401 })
  const type = new URL(req.url).searchParams.get('type') ?? 'contributions'

  let report: Report
  if (session.role === 'admin') {
    if (type === 'organizations') report = await organizationsReport()
    else if (type === 'participants') report = await participantsReport()
    else if (type === 'credits') report = await creditsReport()
    else report = await contributionsReport()
  } else if (session.role === 'issuer' && session.orgId) {
    report = await contributionsReport(session.orgId)
  } else {
    return new NextResponse('Forbidden', { status: 403 })
  }

  return new NextResponse(toCsv(report), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${report.filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
