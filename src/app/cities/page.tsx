import { MapPinned, Plus, ShieldCheck } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { Badge, Card, Flash, PageHeader, Button } from '@/components/ui'
import { requireSession } from '@/lib/auth/session'
import { joinCityNetworkAction } from '@/app/actions'
import { getAvailableCities, getCityNetworks } from '@/lib/services/city-networks'

export const dynamic = 'force-dynamic'

function participationLabel(status: 'new' | 'active' | 'barred') {
  if (status === 'active') return 'City Member'
  if (status === 'barred') return 'Temporarily barred'
  return 'New Participant'
}

export default async function CitiesPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string }
}) {
  const session = await requireSession()
  const [joined, available] = await Promise.all([getCityNetworks(session), getAvailableCities()])
  const joinedAsUser = new Set(joined.filter((city) => city.memberKinds.includes('user')).map((city) => city.id))
  const joinable = available.filter((city) => !joinedAsUser.has(city.id))

  return (
    <AppShell session={session}>
      <PageHeader
        title="Your city networks"
        subtitle="Add Berkeley or Mexico City whenever you expect to participate there. City access becomes active after an on-site onboarding check-in."
      />
      <Flash searchParams={searchParams} />

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-400">Your participation</h2>
        {joinedAsUser.size === 0 ? (
          <Card>
            <p className="text-sm text-ink-500">Choose a city below to begin participating.</p>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {joined
              .filter((city) => city.memberKinds.includes('user'))
              .map((city) => {
                const participation = city.participation
                return (
                  <Card key={city.id} className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-700 text-white">
                        <MapPinned size={21} />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-ink-900">{city.name}</p>
                          {city.isHomeCity ? <Badge tone="blue">Home city</Badge> : null}
                          {participation ? (
                            <Badge tone={participation.status === 'active' ? 'green' : participation.status === 'barred' ? 'red' : 'gold'}>
                              {participationLabel(participation.status)}
                            </Badge>
                          ) : null}
                        </div>
                        {participation?.status === 'new' ? (
                          <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
                            Complete one onboarding task with a verified check-in. You may hold one onboarding task at a time.
                            {participation.noShowCount > 0 ? ` ${3 - participation.noShowCount} onboarding attempt${3 - participation.noShowCount === 1 ? '' : 's'} remain.` : ''}
                          </p>
                        ) : participation?.status === 'barred' ? (
                          <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
                            Your onboarding reservation limit resets {participation.barredUntil ? new Date(participation.barredUntil).toLocaleDateString() : 'after the restriction period'}.
                          </p>
                        ) : (
                          <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
                            Your on-site onboarding attendance is verified in this city. You can claim its open opportunities normally.
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                )
              })}
          </div>
        )}
      </section>

      <section className="mt-9">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-400">Add another city</h2>
        {joinable.length === 0 ? (
          <Card className="flex items-center gap-3">
            <ShieldCheck className="text-emerald-600" size={20} />
            <p className="text-sm text-ink-600">You already belong to every currently available city network.</p>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {joinable.map((city) => (
              <Card key={city.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <div className="flex items-center gap-2">
                    <Plus size={18} className="text-brand-600" />
                    <p className="font-semibold text-ink-900">{city.name}</p>
                  </div>
                  <p className="mt-1 text-sm text-ink-500">
                    Add this city now. Before reserving regular opportunities, complete one on-site onboarding task.
                  </p>
                </div>
                <form action={joinCityNetworkAction}>
                  <input type="hidden" name="cityId" value={city.id} />
                  <input type="hidden" name="redirectTo" value="/cities" />
                  <Button type="submit" variant="secondary">Add {city.name}</Button>
                </form>
              </Card>
            ))}
          </div>
        )}
        {session.orgId ? (
          <p className="mt-4 text-xs leading-relaxed text-ink-400">
            Organizations are onboarded into a city by that city’s administrator; this control adds a city to you personally.
          </p>
        ) : null}
      </section>
    </AppShell>
  )
}
