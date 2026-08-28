import { NextRequest, NextResponse } from 'next/server'
import { clearSession } from '@/lib/auth/session'

export async function GET(request: NextRequest) {
  clearSession()

  const next = request.nextUrl.searchParams.get('next')
  const destination = next?.startsWith('/') && !next.startsWith('//') ? next : '/login'

  return NextResponse.redirect(new URL(destination, request.url))
}
