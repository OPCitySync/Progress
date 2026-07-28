import Link from 'next/link'
import { getSession, homeFor } from '@/lib/auth/session'
import { Logo } from '@/components/brand/Logo'
import { LedgerOverview } from '@/components/ledger/LedgerOverview'
import { getAvailableCities } from '@/lib/services/city-networks'

export const dynamic = 'force-dynamic'

export default async function TransparencyPage({ searchParams }: { searchParams: { city?: string } }) {
  const session = await getSession()
  const cities = await getAvailableCities()
  const city = cities.find((item) => item.id === searchParams.city) ?? cities[0]
  if (!city) return null

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="skeuo-public-header">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Logo variant="light" size={26} href="/" />
          <Link
            href={session ? homeFor(session.role) : '/login'}
            className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            {session ? 'Back to app' : 'Sign in'}
          </Link>
        </div>
        <div className="mx-auto max-w-5xl px-6 pb-10">
          <h1 className="font-display text-3xl font-semibold text-white">Public ledger</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/60">
            {city.name} maintains its own append-only, hash-chained civic-credit ledger. Periodic anchors commit Merkle roots of this city’s event history, so the record can be independently verified.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {cities.map((item) => (
              <Link key={item.id} href={`/transparency?city=${item.id}`} className={item.id === city.id ? 'rounded-xl bg-gold-500 px-3 py-1.5 text-xs font-semibold text-brand-900' : 'rounded-xl border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/10'}>
                {item.name}
              </Link>
            ))}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10"><LedgerOverview logHref={`/transparency/log?city=${city.id}`} cityId={city.id} cityName={city.name} /></main>
    </div>
  )
}
