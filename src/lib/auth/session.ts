import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { validateActiveSession } from '@/lib/services/identity-access'

const COOKIE = 'cs_session'

export type Session = {
  sub: string
  role: 'admin' | 'participant' | 'issuer' | 'redeemer'
  orgId: string | null
  name: string
  email: string
  /** The participant or delegated-organization actor currently in use. */
  activeIdentityId: string | null
  /** Set only while operating for an organization. */
  authorityId: string | null
}

function secret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? 'dev-secret-change-me-in-production')
}

export async function createSession(session: Session) {
  const token = await new SignJWT(session as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret())

  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
}

export async function getSession(): Promise<Session | null> {
  const token = cookies().get(COOKIE)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret())
    return {
      sub: String(payload.sub ?? payload.userId ?? ''),
      role: payload.role as Session['role'],
      orgId: (payload.orgId as string | null) ?? null,
      name: String(payload.name ?? ''),
      email: String(payload.email ?? ''),
      activeIdentityId: (payload.activeIdentityId as string | null) ?? null,
      authorityId: (payload.authorityId as string | null) ?? null,
    }
  } catch {
    return null
  }
}

export function clearSession() {
  cookies().delete(COOKIE)
}

export async function requireSession(): Promise<Session> {
  const session = await getSession()
  if (!session) redirect('/login')
  const active = await validateActiveSession(session)
  if (!active) {
    clearSession()
    redirect('/login?error=' + encodeURIComponent('This identity is no longer authorized to act.'))
  }
  return active
}

export async function requireRole(role: Session['role']): Promise<Session> {
  const session = await requireSession()
  if (session.role !== role) redirect(homeFor(session.role))
  return session
}

export function homeFor(role: Session['role']): string {
  switch (role) {
    case 'admin':
      return '/admin'
    case 'issuer':
      return '/issuer'
    case 'redeemer':
      return '/redeemer'
    default:
      return '/participant'
  }
}
