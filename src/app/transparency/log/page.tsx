import Link from 'next/link'
import { getSession, homeFor } from '@/lib/auth/session'
import { Logo } from '@/components/brand/Logo'
import { VerificationLog } from '@/components/ledger/VerificationLog'
import { getAvailableCities } from '@/lib/services/city-networks'

export const dynamic = 'force-dynamic'

export default async function VerificationLogPage({ searchParams }: { searchParams: { city?: string } }) {
  const session = await getSession()
  const cities = await getAvailableCities()
  const city = cities.find((item) => item.id === searchParams.city) ?? cities[0]
  if (!city) return null

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="skeuo-public-header">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Logo variant="light" size={26} href="/" />
          <Link href={session ? homeFor(session.role) : '/login'} className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
            {session ? 'Back to app' : 'Sign in'}
          </Link>
        </div>
        <div className="mx-auto max-w-5xl px-6 pb-10">
          <Link href={`/transparency?city=${city.id}`} className="text-sm text-white/50 hover:text-white">← {city.name} ledger</Link>
          <h1 className="mt-2 font-display text-3xl font-semibold text-white">Verification log</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/60">
            Every {city.name} event below was re-verified just now: its hash is recomputed from its contents (✓ hash), and its link to the previous event is checked (✓ chain).
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10"><VerificationLog cityId={city.id} /></main>
    </div>
  )
}
