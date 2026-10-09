import { NextResponse } from 'next/server'
import { createSession, getSession } from '@/lib/auth/session'
import { coordinationIntegratedEnabled } from '@/lib/coordination-prototype'
import { browserRequestIsSameOrigin } from '@/lib/http/same-origin'
import { updateAccountIdentity } from '@/lib/services/identity'
import { validateActiveSession } from '@/lib/services/identity-access'

export const dynamic = 'force-dynamic'

function field(input: Record<string, unknown>, key: string) {
  return typeof input[key] === 'string' ? input[key] : ''
}

export async function PATCH(request: Request) {
  if (!coordinationIntegratedEnabled()) return new Response('Not found', { status: 404 })
  if (!browserRequestIsSameOrigin(request)) {
    return NextResponse.json({ error: 'This request must come from MyCity.' }, { status: 403 })
  }
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return NextResponse.json({ error: 'Send account settings as JSON.' }, { status: 415 })
  }
  const raw = await getSession()
  const session = raw && await validateActiveSession(raw)
  if (!session) return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 })

  let input: Record<string, unknown>
  try {
    const value: unknown = await request.json()
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid settings')
    input = value as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Review the account settings and try again.' }, { status: 400 })
  }

  const result = await updateAccountIdentity({
    userId: session.sub,
    name: field(input, 'name'),
    email: field(input, 'email'),
    username: field(input, 'username'),
    avatarUrl: field(input, 'avatarUrl'),
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  await createSession({
    ...session,
    name: result.name,
    email: result.email,
  })
  return NextResponse.json({ account: result }, { headers: { 'Cache-Control': 'no-store' } })
}
