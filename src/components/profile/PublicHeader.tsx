import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { getSession, homeFor } from '@/lib/auth/session'

/**
 * Shared top bar for the public (no-login) surface: org directory, profiles,
 * and public opportunity pages. Mirrors the transparency page header.
 */
export async function PublicHeader() {
  const session = await getSession()
  return (
    <header className="skeuo-public-header">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Logo variant="light" size={26} href="/" />
        <nav className="flex items-center gap-3">
          <Link href="/orgs" className="hidden text-sm font-medium text-white/60 hover:text-white sm:block">
            Organizations
          </Link>
          <Link href="/transparency" className="hidden text-sm font-medium text-white/60 hover:text-white sm:block">
            Public Ledger
          </Link>
          <Link
            href={session ? homeFor(session.role) : '/login'}
            className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            {session ? 'Back to app' : 'Sign in'}
          </Link>
        </nav>
      </div>
    </header>
  )
}
