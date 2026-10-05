import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { coordinationIntegratedEnabled } from '@/lib/coordination-prototype'
import { browserRequestIsSameOrigin } from '@/lib/http/same-origin'
import { db } from '@/lib/db/client'
import { orgs } from '@/lib/db/schema'
import { validateActiveSession, updateOrganizationIdentity } from '@/lib/services/identity-access'
import { getEditorProfile } from '@/lib/services/profile'

export const dynamic = 'force-dynamic'

function stringField(value: unknown) {
  return typeof value === 'string' ? value : ''
}

export async function PATCH(request: Request) {
  if (!coordinationIntegratedEnabled()) return new Response('Not found', { status: 404 })
  if (!browserRequestIsSameOrigin(request)) {
    return NextResponse.json({ error: 'This request must come from MyCity.' }, { status: 403 })
  }
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return NextResponse.json({ error: 'Send organization settings as JSON.' }, { status: 415 })
  }
  const raw = await getSession()
  const session = raw && await validateActiveSession(raw)
  if (!session) return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 })
  if (session.role !== 'issuer' || !session.orgId || !session.authorityId) {
    return NextResponse.json({ error: 'Organization access is required.' }, { status: 403 })
  }
  let input: Record<string, unknown>
  try {
    const value: unknown = await request.json()
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid settings')
    input = value as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Review the settings and try again.' }, { status: 400 })
  }
  if (['name', 'email', 'location', 'phone'].some((key) => typeof input[key] !== 'string')) {
    return NextResponse.json({ error: 'Complete the organization settings form.' }, { status: 400 })
  }
  const org = (await db.select().from(orgs).where(eq(orgs.id, session.orgId)).limit(1))[0]
  if (!org) return NextResponse.json({ error: 'Organization unavailable.' }, { status: 404 })
  const profile = await getEditorProfile(org)
  const result = await updateOrganizationIdentity({
    userId: session.sub,
    orgId: org.id,
    authorityId: session.authorityId,
    name: stringField(input.name),
    contactEmail: stringField(input.email),
    phone: stringField(input.phone),
    location: stringField(input.location),
    logoUrl: profile.logoUrl,
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ organization: {
    id: org.id,
    name: result.name,
    email: result.contactEmail,
    phone: result.phone,
    location: result.location,
  } }, { headers: { 'Cache-Control': 'no-store' } })
}
