import Link from 'next/link'
import { redirect } from 'next/navigation'
import { clsx } from 'clsx'
import { signUpAction } from '@/app/actions'
import { getSession, homeFor } from '@/lib/auth/session'
import { Logo } from '@/components/brand/Logo'
import { Card, Input, Label, Textarea, Button, Flash } from '@/components/ui'
import { isSandbox } from '@/lib/config'

const types = [
  { key: 'participant', label: 'Participant', blurb: 'Volunteer and earn civic credits' },
  { key: 'issuer', label: 'Issuer Org', blurb: 'Publish and verify opportunities' },
  { key: 'redeemer', label: 'Redeemer Org', blurb: 'Accept credits for goods/services' },
] as const

export default async function SignupPage({
  searchParams,
}: {
  searchParams: { error?: string; type?: string; next?: string }
}) {
  const session = await getSession()
  if (session) redirect(homeFor(session.role))

  const type = (['participant', 'issuer', 'redeemer'].includes(searchParams.type ?? '')
    ? searchParams.type
    : 'participant') as 'participant' | 'issuer' | 'redeemer'
  const isOrg = type !== 'participant'
  const next = searchParams.next?.startsWith('/') ? searchParams.next : ''
  const nextParam = next ? `&next=${encodeURIComponent(next)}` : ''

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-900 px-4 py-10">
      <Logo variant="light" size={30} />
      <Card className="mt-8 w-full max-w-lg">
        <h1 className="font-display text-xl font-semibold text-ink-900">Create an account</h1>
        <p className="mt-1 text-sm text-ink-500">Choose how you’ll take part in the pilot.</p>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {types.map((t) => (
            <Link
              key={t.key}
              href={`/signup?type=${t.key}${nextParam}`}
              className={clsx(
                'rounded-xl border px-3 py-2.5 text-center transition-colors',
                type === t.key
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-ink-200 text-ink-500 hover:border-ink-300',
              )}
            >
              <span className="block text-sm font-semibold">{t.label}</span>
              <span className="mt-0.5 hidden text-[11px] leading-tight text-ink-400 sm:block">{t.blurb}</span>
            </Link>
          ))}
        </div>

        <div className="mt-5">
          <Flash searchParams={searchParams} />
        </div>

        <form action={signUpAction} className="space-y-4">
          <input type="hidden" name="kind" value={type} />
          <input type="hidden" name="redirectTo" value={`/signup?type=${type}${nextParam}`} />
          {next ? <input type="hidden" name="next" value={next} /> : null}

          {isOrg ? (
            <>
              <div>
                <Label htmlFor="orgName">Organization name</Label>
                <Input id="orgName" name="orgName" required placeholder="e.g. Riverside Food Bank" />
              </div>
              <div>
                <Label htmlFor="orgDescription">What does your organization do?</Label>
                <Textarea id="orgDescription" name="orgDescription" rows={2} />
              </div>
            </>
          ) : null}

          <div>
            <Label htmlFor="name">{isOrg ? 'Contact name' : 'Your name'}</Label>
            <Input id="name" name="name" required />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="password">Password (8+ characters)</Label>
            <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
          </div>

          {isOrg ? (
            <p className="rounded-xl bg-ink-50 px-4 py-3 text-xs leading-relaxed text-ink-500">
              {isSandbox() ? (
                <>
                  <strong>Sandbox pilot:</strong> organizations are approved automatically and can
                  publish immediately.
                </>
              ) : (
                <>
                  Organization accounts start in <strong>pending</strong> status. A network
                  administrator reviews and approves new organizations before they can publish.
                </>
              )}
            </p>
          ) : null}

          <Button type="submit" className="w-full">
            Create account
          </Button>
        </form>
        <p className="mt-5 text-center text-sm text-ink-500">
          Already have an account?{' '}
          <Link
            href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}
            className="font-semibold text-brand-600 hover:text-brand-500"
          >
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  )
}
