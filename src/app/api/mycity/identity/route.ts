import { NextResponse } from 'next/server'
import { createSession, getSession } from '@/lib/auth/session'
import { coordinationIntegratedEnabled } from '@/lib/coordination-prototype'
import { browserRequestIsSameOrigin } from '@/lib/http/same-origin'
import { sessionForIdentity, validateActiveSession } from '@/lib/services/identity-access'

export const dynamic = 'force-dynamic'

/** Choose an already delegated actor without leaving the MyCity shell. */
export async function POST(request: Request) {
  if (!coordinationIntegratedEnabled()) return new Response('Not found', { status: 404 })
  if (!browserRequestIsSameOrigin(request)) {
    return NextResponse.json({ error: 'This request must come from MyCity.' }, { status: 403 })
  }
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return NextResponse.json({ error: 'Send an identity selection as JSON.' }, { status: 415 })
  }
  const raw = await getSession()
  const current = raw && await validateActiveSession(raw)
  if (!current) return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 })
  let identityId: string
  try {
    const input: unknown = await request.json()
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid selection')
    identityId = (input as Record<string, unknown>).identityId as string
    if (typeof identityId !== 'string' || !identityId || identityId.length > 100) throw new Error('Invalid selection')
  } catch {
    return NextResponse.json({ error: 'Choose an available workspace.' }, { status: 400 })
  }
  const next = await sessionForIdentity(current.sub, identityId)
  if (!next || (next.role !== 'participant' && next.role !== 'issuer')) {
    return NextResponse.json({ error: 'That workspace is not available to this account.' }, { status: 403 })
  }
  await createSession(next)
  return NextResponse.json({ role: next.role }, { headers: { 'Cache-Control': 'no-store' } })
}
