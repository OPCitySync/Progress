import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession, homeFor } from '@/lib/auth/session'
import { Logo } from '@/components/brand/Logo'

export default async function Home() {
  const session = await getSession()
  if (session) redirect(homeFor(session.role))

  return (
    <div className="skeuo-hero flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-5 md:px-12">
        <Logo variant="light" size={28} />
        <div className="flex items-center gap-3">
          <Link
            href="/orgs"
            className="hidden text-sm font-medium text-white/60 hover:text-white sm:block"
          >
            Organizations
          </Link>
          <Link
            href="/transparency"
            className="hidden text-sm font-medium text-white/60 hover:text-white sm:block"
          >
            Public Ledger
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            Sign in
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-center px-6 md:px-12">
        <div className="mx-auto max-w-3xl py-16 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold-400">
            Volunteer Management
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-tight text-white md:text-5xl">
            Civic contribution, recognized.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/60">
            Verified volunteer work earns civic credits. Credits are redeemable with local community
            partners. Every issuance and redemption lives on a tamper-evident public ledger.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-xl bg-gold-500 px-6 py-3 text-sm font-semibold text-brand-900 hover:bg-gold-400"
            >
              Create an account
            </Link>
            <Link
              href="/signup?type=issuer"
              className="rounded-xl border border-white/20 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              Register an organization
            </Link>
          </div>
          <p className="mt-5 text-sm text-white/50">
            Just exploring?{' '}
            <Link href="/orgs" className="font-semibold text-gold-400 hover:text-gold-300">
              Browse organizations and opportunities →
            </Link>
          </p>
          <div className="mt-16 grid gap-4 text-left sm:grid-cols-3">
            {[
              ['Participants', 'Discover approved opportunities, contribute, and earn civic credits.'],
              ['Issuers', 'Publish opportunities, verify completions, and manage liability waivers.'],
              ['Redeemers', 'Offer goods and services; credits burn on redemption.'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-white/50">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
