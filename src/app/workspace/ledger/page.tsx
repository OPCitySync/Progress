import { LedgerOverview } from '@/components/ledger/LedgerOverview'
import { Card, PageHeader } from '@/components/ui'
import { requireSession } from '@/lib/auth/session'
import { getActiveCity } from '@/lib/services/city-networks'

export const dynamic = 'force-dynamic'

export default async function WorkspaceLedgerPage() {
  const session = await requireSession()
  const city = await getActiveCity(session)
  if (!city) {
    return (
      <Card>
        <PageHeader title="Public ledger" subtitle="Choose a city network to view its independent ledger." />
      </Card>
    )
  }
  return (
    <LedgerOverview
      logHref="/workspace/ledger/log"
      cityId={city.id}
      cityName={city.name}
      overviewHeader={
        <PageHeader
          title="Public ledger"
          subtitle={`A tamper-evident record of ${city.name} civic credit activity and acknowledgements.`}
        />
      }
    />
  )
}
