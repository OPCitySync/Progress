import Link from 'next/link'
import { Globe2, MapPinned } from 'lucide-react'
import { Badge, Button, Card, EmptyState, Flash, PageHeader } from '@/components/ui'
import { joinCityNetworkAction } from '@/app/actions'
import { requireSession } from '@/lib/auth/session'
import { getAvailableCities, getCityNetworks } from '@/lib/services/city-networks'

export const dynamic = 'force-dynamic'

export default async function DiscoverCityNetworksPage({
  searchParams,
}: {
  searchParams: { q?: string; error?: string; ok?: string }
}) {
  const session = await requireSession()
  const q = searchParams.q?.trim() ?? ''
  const [available, joined] = await Promise.all([getAvailableCities(), getCityNetworks(session)])
  const joinedById = new Map(joined.map((city) => [city.id, city]))
  const normalizedQuery = q.toLocaleLowerCase()
  const entries = available.filter((city) => {
    if (!normalizedQuery) return true
    return `${city.name} ${city.description}`.toLocaleLowerCase().includes(normalizedQuery)
  })

  return (
    <>
      <PageHeader
        title="Discover City Networks"
        subtitle="Explore the local City/Sync networks where you can participate."
      />
      <Flash searchParams={searchParams} />

      <form action="/workspace/cities" method="get" className="mb-7 flex max-w-md gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search city networks…"
          className="w-full rounded-xl border border-ink-300 bg-white px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
        <button className="rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">Search</button>
      </form>

      {entries.length === 0 ? (
        <EmptyState title="No city networks found" body="Try a different city name or check back as City/Sync expands." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {entries.map((city) => {
            const membership = joinedById.get(city.id)
            const joinedPersonally = membership?.memberKinds.includes('user') ?? false
            const joinedAsOrganization = membership?.memberKinds.includes('organization') ?? false
            return (
              <Card key={city.id} className="flex h-full flex-col transition-shadow hover:shadow-panel">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white">
                    <MapPinned size={22} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold leading-tight text-ink-900">{city.name}</p>
                    <p className="mt-1 text-xs text-ink-400">City/Sync Network</p>
                  </div>
                </div>
                <p className="mt-4 flex-1 text-sm leading-relaxed text-ink-500">
                  {city.description || `Participate in verified civic opportunities across ${city.name}.`}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {joinedPersonally ? <Badge tone="green">In your networks</Badge> : null}
                  {membership?.isHomeCity ? <Badge tone="blue">Home city</Badge> : null}
                  {joinedAsOrganization ? <Badge tone="gold">Organization network</Badge> : null}
                </div>
                <div className="mt-5 flex items-center justify-between gap-3">
                  {joinedPersonally ? (
                    <Link href="/cities" className="text-sm font-semibold text-brand-700 hover:text-brand-600">
                      View your network →
                    </Link>
                  ) : (
                    <form action={joinCityNetworkAction}>
                      <input type="hidden" name="cityId" value={city.id} />
                      <input type="hidden" name="redirectTo" value="/workspace/cities" />
                      <Button type="submit" variant="secondary">Join network</Button>
                    </form>
                  )}
                  <Globe2 size={18} className="shrink-0 text-ink-300" aria-hidden="true" />
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Card className="mt-8 border-brand-200 bg-brand-50">
        <p className="text-sm font-semibold text-ink-800">Participation is local</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-600">
          Joining a city network adds it to your Civic Participant identity. To claim regular opportunities there, complete an on-site onboarding task and check in. Organizations join city networks through that city’s administrator.
        </p>
      </Card>
    </>
  )
}
