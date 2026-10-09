import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { coordinationIntegratedEnabled } from '@/lib/coordination-prototype'
import { validateActiveSession } from '@/lib/services/identity-access'
import { orgReportSummary } from '@/lib/services/reports'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!coordinationIntegratedEnabled()) return new Response('Not found', { status: 404 })
  const raw = await getSession()
  const session = raw && await validateActiveSession(raw)
  if (!session) return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 })
  if (session.role !== 'issuer' || !session.orgId) {
    return NextResponse.json({ error: 'Open an Issuer Organization to view reports.' }, { status: 403 })
  }
  const summary = await orgReportSummary(session.orgId)
  return NextResponse.json({ summary, generatedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } })
}
