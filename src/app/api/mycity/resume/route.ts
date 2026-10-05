import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { coordinationIntegratedEnabled } from '@/lib/coordination-prototype'
import { browserRequestIsSameOrigin } from '@/lib/http/same-origin'
import { validateActiveSession } from '@/lib/services/identity-access'
import { getMyResume, setResumePublic } from '@/lib/services/resume'

export const dynamic = 'force-dynamic'

async function participantSession() {
  const raw = await getSession()
  const session = raw && await validateActiveSession(raw)
  return session?.role === 'participant' ? session : null
}

export async function GET() {
  if (!coordinationIntegratedEnabled()) return new Response('Not found', { status: 404 })
  const session = await participantSession()
  if (!session) return NextResponse.json({ error: 'Open your volunteer workspace to manage your résumé.' }, { status: 403 })
  const resume = await getMyResume(session.sub)
  if (!resume) return NextResponse.json({ error: 'Volunteer résumé unavailable.' }, { status: 404 })
  return NextResponse.json({ resume }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(request: Request) {
  if (!coordinationIntegratedEnabled()) return new Response('Not found', { status: 404 })
  if (!browserRequestIsSameOrigin(request)) {
    return NextResponse.json({ error: 'This request must come from MyCity.' }, { status: 403 })
  }
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return NextResponse.json({ error: 'Send résumé visibility as JSON.' }, { status: 415 })
  }
  const session = await participantSession()
  if (!session) return NextResponse.json({ error: 'Open your volunteer workspace to manage your résumé.' }, { status: 403 })
  let isPublic: boolean
  try {
    const input: unknown = await request.json()
    if (!input || typeof input !== 'object' || Array.isArray(input) || typeof (input as Record<string, unknown>).isPublic !== 'boolean') throw new Error('Invalid visibility')
    isPublic = (input as { isPublic: boolean }).isPublic
  } catch {
    return NextResponse.json({ error: 'Choose whether the résumé should be shareable.' }, { status: 400 })
  }
  await setResumePublic(session.sub, isPublic)
  const resume = await getMyResume(session.sub)
  if (!resume) return NextResponse.json({ error: 'Volunteer résumé unavailable.' }, { status: 404 })
  return NextResponse.json({ resume }, { headers: { 'Cache-Control': 'no-store' } })
}
