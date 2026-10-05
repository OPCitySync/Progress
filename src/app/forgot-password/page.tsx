import Link from 'next/link'
import { requestPasswordResetAction } from '@/app/password-actions'
import { Logo } from '@/components/brand/Logo'
import { Button, Card, Input, Label } from '@/components/ui'

export default function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: { sent?: string; developmentToken?: string }
}) {
  const sent = searchParams.sent === '1'
  const developmentToken = process.env.NODE_ENV !== 'production' ? searchParams.developmentToken : undefined

  return (
    <div className="skeuo-auth-shell flex min-h-screen flex-col items-center justify-center px-4">
      <Logo variant="light" size={30} />
      <Card className="mt-8 w-full max-w-md">
        {sent ? (
          <>
            <h1 className="font-display text-xl font-semibold text-ink-900">Check your email</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">
              If an active MyCity account uses that address, we sent a password reset link. It expires in 30 minutes.
            </p>
            <p className="mt-3 text-xs leading-relaxed text-ink-500">
              You can safely close this page if you did not request the reset.
            </p>
            {developmentToken ? (
              <div className="mt-5 rounded-xl border border-gold-200 bg-gold-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-gold-700">Local development</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-600">
                  Email delivery is disabled locally. Use this link to test the reset flow.
                </p>
                <Link
                  href={`/reset-password?token=${encodeURIComponent(developmentToken)}`}
                  className="mt-3 inline-flex text-sm font-semibold text-brand-700 hover:text-brand-600"
                >
                  Open password reset
                </Link>
              </div>
            ) : null}
            <div className="mt-6 space-y-3">
              <Link
                href="/login"
                className="skeuo-button skeuo-button-primary flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
              >
                Back to sign in
              </Link>
              <Link href="/forgot-password" className="block text-center text-sm font-semibold text-brand-700 hover:text-brand-600">
                Try another email address
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="font-display text-xl font-semibold text-ink-900">Reset your password</h1>
            <p className="mt-1 text-sm leading-relaxed text-ink-500">
              Enter your personal sign-in email and we’ll send you a secure reset link.
            </p>
            <form action={requestPasswordResetAction} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="email">Your sign-in email</Label>
                <Input id="email" name="email" type="email" required autoComplete="email" autoFocus />
              </div>
              <Button type="submit" className="w-full">
                Send reset link
              </Button>
            </form>
            <p className="mt-5 text-center text-sm text-ink-500">
              Remembered your password?{' '}
              <Link href="/login" className="font-semibold text-brand-700 hover:text-brand-600">
                Sign in
              </Link>
            </p>
          </>
        )}
      </Card>
    </div>
  )
}
