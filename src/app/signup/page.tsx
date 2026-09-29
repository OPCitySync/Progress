import Link from 'next/link'
import { redirect } from 'next/navigation'
import { signUpAction } from '@/app/actions'
import { aestheticHomeFor, getSession } from '@/lib/auth/session'
import { Logo } from '@/components/brand/Logo'
import { Card, Input, Label, Textarea, Button, Flash } from '@/components/ui'
import { getAvailableCities } from '@/lib/services/city-networks'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: { error?: string; type?: string; next?: string; rosterInvite?: string; organizationInvite?: string }
}) {
  const session = await getSession()
  if (session) redirect(aestheticHomeFor(session.role))

  const type = (['participant', 'issuer', 'redeemer'].includes(searchParams.type ?? '')
    ? searchParams.type
    : 'participant') as 'participant' | 'issuer' | 'redeemer'
  const isOrg = type !== 'participant'
  const next = searchParams.next?.startsWith('/') ? searchParams.next : ''
  const rosterInvite = searchParams.rosterInvite?.trim() ?? ''
  const organizationInvite = searchParams.organizationInvite?.trim() ?? ''
  const nextParam = `${next ? `&next=${encodeURIComponent(next)}` : ''}${organizationInvite ? `&organizationInvite=${encodeURIComponent(organizationInvite)}` : ''}`
  const cities = await getAvailableCities()
  const signupCopy =
    type === 'participant'
      ? {
          title: 'Create your account',
          description: 'Join City/Sync as a Civic Participant.',
        }
      : type === 'issuer'
        ? {
            title: 'Register your organization',
            description: 'Create your organization and become its first owner.',
          }
        : {
            title: 'Register your organization',
            description: 'Create your organization and become its first owner.',
          }

  return (
    <div className="skeuo-auth-shell flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Logo variant="light" size={30} />
      <Card className="mt-8 w-full max-w-lg">
        <h1 className="font-display text-xl font-semibold text-ink-900">{signupCopy.title}</h1>
        <p className="mt-1 text-sm text-ink-500">{signupCopy.description}</p>

        <div className="mt-5">
          <Flash searchParams={searchParams} />
        </div>

        <form action={signUpAction} className="space-y-4">
          <input type="hidden" name="kind" value={type} />
          <input type="hidden" name="redirectTo" value={`/signup?type=${type}${nextParam}`} />
          {next ? <input type="hidden" name="next" value={next} /> : null}
          {type === 'participant' && rosterInvite ? <input type="hidden" name="rosterInvite" value={rosterInvite} /> : null}
          {type === 'participant' && organizationInvite ? <input type="hidden" name="organizationInvite" value={organizationInvite} /> : null}

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
              <div>
                <Label htmlFor="orgAddress">
                  Organization address <span className="font-normal text-ink-400">(optional)</span>
                </Label>
                <Input
                  id="orgAddress"
                  name="orgAddress"
                  maxLength={240}
                  placeholder="e.g. 123 Main St., Berkeley, CA"
                />
                <p className="mt-1 text-xs text-ink-400">
                  Used as the default location for opportunities and onboarding sessions. You can add more locations later.
                </p>
              </div>
            </>
          ) : null}

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink-700">
              {isOrg ? 'City where the organization operates' : 'Your home city'}
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {cities.map((city, index) => (
                <label
                  key={city.id}
                  className="flex cursor-pointer items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm font-medium text-ink-700"
                >
                  <input
                    type="radio"
                    name="cityId"
                    value={city.id}
                    defaultChecked={index === 0}
                    className="accent-brand-700"
                  />
                  {city.name}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-ink-400">
              {isOrg
                ? 'A City Admin onboards organizations into their selected city before they can publish there.'
                : 'You can add another city later. Your first verified on-site onboarding check-in makes you a City Member in your home city.'}
            </p>
          </fieldset>

          <div>
            <Label htmlFor="name">Your name</Label>
            <Input id="name" name="name" required />
          </div>
          <div>
            <Label htmlFor="email">{isOrg ? 'Your sign-in email' : 'Email'}</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
            {isOrg ? (
              <p className="mt-1.5 text-xs leading-relaxed text-ink-500">
                Use an email address that belongs to you, not a shared inbox such as info@ or volunteers@. Your organization’s public contact email can be added separately.
              </p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="password">Password (8+ characters)</Label>
            <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
          </div>

          {isOrg ? (
            <div className="rounded-xl border border-brand-100 bg-brand-50/70 px-4 py-3">
              <p className="text-sm font-semibold text-ink-800">One account for you and your organization access</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-600">
                This creates your personal MyCity account and assigns you as the organization’s first owner. After signing in, you can switch between your personal profile and the organization workspace.
              </p>
            </div>
          ) : null}

          <Button type="submit" className="w-full">
            {isOrg ? 'Create organization' : 'Create account'}
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
