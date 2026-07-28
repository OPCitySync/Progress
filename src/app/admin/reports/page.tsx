import { requireRole } from '@/lib/auth/session'
import { getCityAdminStats } from '@/lib/services/stats'
import { getActiveCity } from '@/lib/services/city-networks'
import { Card, PageHeader, StatCard } from '@/components/ui'

export const dynamic = 'force-dynamic'

const EXPORTS: { type: string; title: string; body: string }[] = [
  { type: 'contributions', title: 'Contributions', body: 'Every sign-up with status, check-in, credits awarded, and hours.' },
  { type: 'organizations', title: 'Organizations', body: 'Per-org volunteers, verified contributions, credits issued, and hours.' },
  { type: 'participants', title: 'Participants', body: 'Per-volunteer contributions, hours, lifetime credits, and balance.' },
  { type: 'credits', title: 'Credit ledger', body: 'Every mint (verified work) and burn (finalized redemption).' },
]

export default async function AdminReportsPage() {
  const session = await requireRole('admin')
  const city = await getActiveCity(session)
  if (!city) {
    return <PageHeader title="Reports & exports" subtitle="Choose a city network before viewing its reports." />
  }
  const stats = await getCityAdminStats(city.id)

  return (
    <>
      <PageHeader
        title="Reports & exports"
        subtitle={`${city.name} reporting. Every figure is backed by this city’s independent ledger.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Participants" value={stats.participants} />
        <StatCard label="Verified contributions" value={stats.verifiedCompletions} />
        <StatCard label="Credits minted" value={stats.creditsMinted} />
        <StatCard label="Credits outstanding" value={stats.creditsOutstanding} />
      </div>

      <h2 className="mb-3 mt-9 text-sm font-semibold uppercase tracking-wider text-ink-400">CSV exports</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {EXPORTS.map((e) => (
          <Card key={e.type} className="flex flex-col">
            <p className="font-semibold text-ink-900">{e.title}</p>
            <p className="mt-1 flex-1 text-sm text-ink-500">{e.body}</p>
            <a
              href={`/api/reports?type=${e.type}`}
              className="mt-4 inline-flex w-fit items-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
            >
              Download CSV
            </a>
          </Card>
        ))}
      </div>
    </>
  )
}
