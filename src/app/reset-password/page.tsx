import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import { resetPasswordAction } from '@/app/password-actions'
import { Logo } from '@/components/brand/Logo'
import { Button, Card, Flash, Input, Label } from '@/components/ui'
import { isPasswordResetTokenValid } from '@/lib/services/password-reset'

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string; error?: string }
}) {
  noStore()
  const token = searchParams.token?.trim() ?? ''
  const valid = await isPasswordResetTokenValid(token)

  return (
    <div className="skeuo-auth-shell flex min-h-screen flex-col items-center justify-center px-4">
      <Logo variant="light" size={30} />
      <Card className="mt-8 w-full max-w-md">
        {valid ? (
          <>
            <h1 className="font-display text-xl font-semibold text-ink-900">Choose a new password</h1>
            <p className="mt-1 text-sm leading-relaxed text-ink-500">
              Use at least 8 characters. Completing this reset signs your account out on other devices.
            </p>
            <div className="mt-5">
              <Flash searchParams={searchParams} />
            </div>
            <form action={resetPasswordAction} className="space-y-4">
              <input type="hidden" name="token" value={token} />
              <div>
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="passwordConfirmation">Confirm new password</Label>
                <Input
                  id="passwordConfirmation"
                  name="passwordConfirmation"
                  type="password"
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" className="w-full">
                Update password
              </Button>
            </form>
          </>
        ) : (
          <>
            <h1 className="font-display text-xl font-semibold text-ink-900">This reset link can’t be used</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">
              The link is invalid, has expired, or has already been used. Request a new one to continue.
            </p>
            <Link
              href="/forgot-password"
              className="skeuo-button skeuo-button-primary mt-6 flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
            >
              Request a new link
            </Link>
            <Link href="/login" className="mt-4 block text-center text-sm font-semibold text-brand-700 hover:text-brand-600">
              Back to sign in
            </Link>
          </>
        )}
      </Card>
    </div>
  )
}
