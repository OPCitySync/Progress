import Link from 'next/link'
import { redirect } from 'next/navigation'
import { UserPlus } from 'lucide-react'
import { acceptVolunteerRosterInviteAction } from '@/app/actions'
import { getSession } from '@/lib/auth/session'
import { validateActiveSession } from '@/lib/services/identity-access'
import { getVolunteerRosterInvite } from '@/lib/services/roster'
import { Logo } from '@/components/brand/Logo'
import { Button, Card, Flash } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function VolunteerInvitePage({ searchParams }: { searchParams: { code?: string; error?: string } }) {
  const code = searchParams.code?.trim() ?? ''
  const invite = await getVolunteerRosterInvite(code)
  const session = await getSession()
  const activeSession = session ? await validateActiveSession(session) : null

  if (!invite) {
    return <div className="skeuo-auth-shell flex min-h-screen flex-col items-center justify-center px-4"><Logo variant="light" size={30} /><Card className="mt-8 w-full max-w-md"><h1 className="font-display text-xl font-semibold text-ink-900">This volunteer invite is unavailable</h1><p className="mt-2 text-sm leading-relaxed text-ink-500">It may have expired, already been used, or been withdrawn by the organization.</p><Link href="/login" className="skeuo-button skeuo-button-primary mt-5 inline-flex w-full justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white">Go to sign in</Link></Card></div>
  }

  const next = `/volunteer-invite?code=${encodeURIComponent(code)}`
  if (!activeSession) {
    return <div className="skeuo-auth-shell flex min-h-screen flex-col items-center justify-center px-4"><Logo variant="light" size={30} /><Card className="mt-8 w-full max-w-md"><UserPlus className="text-brand-700" size={27} /><h1 className="mt-4 font-display text-xl font-semibold text-ink-900">Join {invite.organizationName}&rsquo;s volunteer roster</h1><p className="mt-2 text-sm leading-relaxed text-ink-500">Create a Civic Participant account and you will be added directly to this organization&rsquo;s volunteer roster. This does not give you access to its organization workspace.</p><Link href={`/signup?type=participant&rosterInvite=${encodeURIComponent(code)}`} className="skeuo-button skeuo-button-primary mt-5 flex justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white">Create a User Account</Link><p className="mt-4 text-center text-sm text-ink-500">Already have an account? <Link className="font-semibold text-brand-700" href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link></p></Card></div>
  }

  if (activeSession.role !== 'participant') {
    redirect(`/aesthetic-lab?error=${encodeURIComponent('Switch to your Civic Participant identity before accepting a volunteer invite.')}`)
  }

  return <div className="skeuo-auth-shell flex min-h-screen flex-col items-center justify-center px-4"><Logo variant="light" size={30} /><Card className="mt-8 w-full max-w-md"><h1 className="font-display text-xl font-semibold text-ink-900">Join {invite.organizationName}&rsquo;s volunteer roster</h1><p className="mt-2 text-sm leading-relaxed text-ink-500">You will be visible to this organization as a volunteer. This does not create an organization role or share your sign-in.</p><div className="mt-5"><Flash searchParams={searchParams} /></div><form action={acceptVolunteerRosterInviteAction} className="mt-5"><input type="hidden" name="code" value={code} /><input type="hidden" name="redirectTo" value={next} /><Button type="submit" className="w-full">Join volunteer roster</Button></form></Card></div>
}
