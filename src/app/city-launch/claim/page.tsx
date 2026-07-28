import { redirect } from 'next/navigation'
import { KeyRound, MapPin } from 'lucide-react'
import { claimCityLaunchOwnershipAction } from '@/app/actions'
import { AppShell } from '@/components/AppShell'
import { Button, Card, Flash, PageHeader } from '@/components/ui'
import { getSession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export default async function CityLaunchClaimPage({
  searchParams,
}: {
  searchParams: { code?: string; error?: string; ok?: string }
}) {
  const code = searchParams.code?.trim() ?? ''
  const session = await getSession()
  if (!session) {
    const next = `/city-launch/claim${code ? `?code=${encodeURIComponent(code)}` : ''}`
    redirect(`/login?next=${encodeURIComponent(next)}`)
  }

  return (
    <AppShell session={session}>
      <PageHeader title="Claim City Organization" subtitle="Accept a city-local organization account assigned to you by its sponsoring organization." />
      <Flash searchParams={searchParams} />
      <Card className="max-w-2xl">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-brand-100 p-2 text-brand-700"><MapPin size={20} /></div>
          <div>
            <h2 className="font-display text-xl font-semibold text-ink-900">Become the local owner</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-600">
              This transfers control of the new city-local organization to your own authority identity. You must use a Civic Participant account whose email matches the invitation.
            </p>
          </div>
        </div>
        {code ? (
          <form action={claimCityLaunchOwnershipAction} className="mt-6">
            <input type="hidden" name="code" value={code} />
            <input type="hidden" name="redirectTo" value={`/city-launch/claim?code=${encodeURIComponent(code)}`} />
            <Button type="submit"><KeyRound size={16} /> Claim Organization</Button>
          </form>
        ) : (
          <p className="mt-6 rounded-xl border border-gold-200 bg-gold-50 px-4 py-3 text-sm text-gold-800">This claim link is incomplete. Ask the sponsoring organization to send the full ownership claim link.</p>
        )}
      </Card>
    </AppShell>
  )
}
