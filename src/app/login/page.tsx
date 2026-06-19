import Link from 'next/link'
import { redirect } from 'next/navigation'
import { signInAction } from '@/app/actions'
import { getSession, homeFor } from '@/lib/auth/session'
import { Logo } from '@/components/brand/Logo'
import { Card, Input, Label, Button, Flash } from '@/components/ui'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string; next?: string }
}) {
  const session = await getSession()
  if (session) redirect(homeFor(session.role))

  const next = searchParams.next?.startsWith('/') ? searchParams.next : ''
  const loginRedirect = next ? `/login?next=${encodeURIComponent(next)}` : '/login'

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-900 px-4">
      <Logo variant="light" size={30} />
      <Card className="mt-8 w-full max-w-md">
        <h1 className="font-display text-xl font-semibold text-ink-900">Sign in</h1>
        <p className="mt-1 text-sm text-ink-500">Welcome back to the City/Sync pilot.</p>
        <div className="mt-5">
          <Flash searchParams={searchParams} />
        </div>
        <form action={signInAction} className="space-y-4">
          <input type="hidden" name="redirectTo" value={loginRedirect} />
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>
        <p className="mt-5 text-center text-sm text-ink-500">
          New here?{' '}
          <Link
            href={next ? `/signup?next=${encodeURIComponent(next)}` : '/signup'}
            className="font-semibold text-brand-600 hover:text-brand-500"
          >
            Create an account
          </Link>
        </p>
      </Card>
    </div>
  )
}
