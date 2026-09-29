import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { coordinationIntegratedEnabled } from '@/lib/coordination-prototype'
import { db } from '@/lib/db/client'
import { orgs } from '@/lib/db/schema'
import { organizationBannerPalette } from '@/lib/profile/organization-appearance'
import { getActiveCity } from '@/lib/services/city-networks'
import { activeSessionIsOrganizationOwner, validateActiveSession } from '@/lib/services/identity-access'
import { getEditorProfile } from '@/lib/services/profile'

export const dynamic = 'force-dynamic'

/** The first server-owned data contract for the MyCity shell. */
export async function GET() {
  if (!coordinationIntegratedEnabled()) return new Response('Not found', { status: 404 })
  const raw = await getSession()
  const session = raw && await validateActiveSession(raw)
  if (!session) return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 })

  const city = await getActiveCity(session)
  if (session.role !== 'issuer' || !session.orgId) {
    return NextResponse.json({ role: session.role, accountName: session.name, cityName: city?.name ?? '' }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  const org = (await db.select().from(orgs).where(eq(orgs.id, session.orgId)).limit(1))[0]
  if (!org) return NextResponse.json({ error: 'Organization unavailable.' }, { status: 404 })
  const [profile, canEdit] = await Promise.all([
    getEditorProfile(org),
    activeSessionIsOrganizationOwner(session),
  ])
  const palette = organizationBannerPalette(profile.bannerPalette)
  return NextResponse.json({
    role: session.role,
    accountName: session.name,
    cityName: city?.name ?? '',
    organization: {
      id: org.id,
      name: org.name,
      email: profile.contactEmail,
      phone: profile.phone,
      location: profile.location,
      logoUrl: profile.logoUrl,
      palette: palette.colors,
      canEdit,
    },
  }, { headers: { 'Cache-Control': 'no-store' } })
}
