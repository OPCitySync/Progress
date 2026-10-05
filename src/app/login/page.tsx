import Link from 'next/link'
import { redirect } from 'next/navigation'
import { signInAction } from '@/app/actions'
import { aestheticHomeFor, getSession } from '@/lib/auth/session'
import { validateActiveSession } from '@/lib/services/identity-access'
import { Logo } from '@/components/brand/Logo'
import { Card, Input, Label, Button, Flash } from '@/components/ui'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string; next?: string }
}) {
  const session = await getSession()
  if (session) {
    const activeSession = await validateActiveSession(session)
    if (activeSession) redirect(aestheticHomeFor(activeSession.role))

    const loginPath = '/login?error=' + encodeURIComponent('This identity is no longer authorized to act.')
    redirect('/logout?next=' + encodeURIComponent(loginPath))
  }

  const next = searchParams.next?.startsWith('/') ? searchParams.next : ''
  const loginRedirect = next ? `/login?next=${encodeURIComponent(next)}` : '/login'
  const signupSuffix = next ? `&next=${encodeURIComponent(next)}` : ''

  return (
    <div className="skeuo-auth-shell flex min-h-screen flex-col items-center justify-center px-4">
      <Logo variant="light" size={30} />
      <Card className="mt-8 w-full max-w-md">
        <h1 className="font-display text-xl font-semibold text-ink-900">Sign in</h1>
        <p className="mt-1 text-sm text-ink-500">Welcome back to MyCity.</p>
        <div className="mt-5">
          <Flash searchParams={searchParams} />
        </div>
        <form action={signInAction} className="space-y-4">
          <input type="hidden" name="redirectTo" value={loginRedirect} />
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <div>
            <Label htmlFor="email">Your sign-in email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
            <p className="mt-1.5 text-xs leading-relaxed text-ink-500">
              Use the email address that belongs to you, even when signing in to manage an organization.
            </p>
          </div>
          <div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="mb-1.5 text-xs font-semibold text-brand-700 hover:text-brand-600">
                Forgot password?
              </Link>
            </div>
            <Input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>
        <div className="mt-5 rounded-xl border border-brand-100 bg-brand-50/70 px-4 py-3">
          <p className="text-sm font-semibold text-ink-800">One account for every role</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-600">
            After signing in, you can switch between your personal profile and any organization workspaces you manage. Shared addresses such as info@ or volunteers@ belong in the organization profile, not in this sign-in.
          </p>
        </div>
        <div className="mt-6 border-t border-ink-200 pt-5">
          <p className="text-center text-sm font-medium text-ink-600">New to MyCity?</p>
          <Link
            href={`/signup?type=participant${signupSuffix}`}
            className="skeuo-button skeuo-button-primary mt-4 flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
          >
            Create a User Account
          </Link>
          <p className="mt-4 text-center text-xs text-ink-500">
            Registering an organization?{' '}
            <Link href={`/signup?type=issuer${signupSuffix}`} className="font-semibold text-brand-700 hover:text-brand-600">
              Register an Organization
            </Link>
          </p>
        </div>
      </Card>
    </div>
  )
}
