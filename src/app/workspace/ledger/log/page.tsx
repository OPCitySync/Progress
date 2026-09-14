import { VerificationLog } from '@/components/ledger/VerificationLog'
import { PageHeader } from '@/components/ui'
import { requireSession } from '@/lib/auth/session'
import { getActiveCity } from '@/lib/services/city-networks'
import { HistoryBackButton } from '@/app/aesthetic-lab/HistoryBackButton'

export const dynamic = 'force-dynamic'

export default async function WorkspaceVerificationLogPage() {
  const session = await requireSession()
  const city = await getActiveCity(session)
  if (!city) return <PageHeader title="Verification log" subtitle="Choose a city network to inspect its ledger." />
  return (
    <>
      <PageHeader
        title="Verification log"
        subtitle={`Each ${city.name} ledger event is rechecked for both content integrity and chain linkage.`}
        action={<HistoryBackButton fallback="/workspace/ledger" variant="plain" />}
      />
      <VerificationLog cityId={city.id} />
    </>
  )
}
