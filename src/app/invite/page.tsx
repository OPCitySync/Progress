import Link from 'next/link'
import { KeyRound } from 'lucide-react'
import { acceptOrganizationInviteAction } from '@/app/actions'
import { AppShell } from '@/components/AppShell'
import { Button, Card, Flash, Input, PageHeader } from '@/components/ui'
import { getSession, requireSession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export default async function InvitePage({
  searchParams,
}: {
  searchParams: { code?: string; error?: string; ok?: string }
}) {
  const code = searchParams.code ?? ''
  const rawSession = await getSession()
  if (!rawSession) {
    const next = `/invite${code ? `?code=${encodeURIComponent(code)}` : ''}`
    return (
      <div className="skeuo-auth-shell flex min-h-screen items-center justify-center px-5 py-12">
        <Card className="w-full max-w-lg p-7">
          <KeyRound className="text-brand-600" size={28} />
          <h1 className="mt-4 font-display text-2xl font-semibold text-ink-900">You’ve been invited to act for an organization</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-600">Sign in or create your personal Civic Participant account first. City/Sync will then attach a separate organization authority to it.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={`/login?next=${encodeURIComponent(next)}`} className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white">Sign in</Link>
            <Link href={`/signup?type=participant&next=${encodeURIComponent(next)}`} className="rounded-xl border border-ink-300 px-4 py-2.5 text-sm font-semibold text-ink-700">Create personal account</Link>
          </div>
        </Card>
      </div>
    )
  }

  const session = await requireSession()
  return (
    <AppShell session={session}>
      <PageHeader title="Redeem organization invite" subtitle="This creates a separate authority identity. It does not change your personal participant identity, profile, or city credits." />
      <Flash searchParams={searchParams} />
      <Card className="max-w-xl">
        <form action={acceptOrganizationInviteAction} className="space-y-4">
          <label className="block text-sm font-semibold text-ink-700" htmlFor="code">Invitation code</label>
          <Input id="code" name="code" defaultValue={code} required autoComplete="off" placeholder="CS-INV-…" />
          <Button type="submit">Redeem invite and switch context</Button>
        </form>
      </Card>
    </AppShell>
  )
}
