import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { hasOrganizationPermission, validateActiveSession } from '@/lib/services/identity-access'
import { getActiveCity } from '@/lib/services/city-networks'
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
  const savedSession = await getSession()
  const session = savedSession ? await validateActiveSession(savedSession) : null
  if (!session) return new NextResponse('Unauthorized', { status: 401 })
  const type = new URL(req.url).searchParams.get('type') ?? 'contributions'

  let report: Report
  if (session.role === 'admin') {
    const city = await getActiveCity(session)
    if (!city) return new NextResponse('Choose a city before exporting a report.', { status: 400 })
    if (type === 'organizations') report = await organizationsReport(city.id)
    else if (type === 'participants') report = await participantsReport(city.id)
    else if (type === 'credits') report = await creditsReport(city.id)
    else report = await contributionsReport(undefined, city.id)
  } else if (session.role === 'issuer' && session.orgId) {
    if (!(await hasOrganizationPermission(session, 'reports.view'))) {
      return new NextResponse('Forbidden', { status: 403 })
    }
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
