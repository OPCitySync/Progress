import { PublicHeader } from '@/components/profile/PublicHeader'
import { OrgDirectoryResults } from '@/components/OrgDirectoryResults'

export const dynamic = 'force-dynamic'

export default async function OrgDirectoryPage({
  searchParams,
}: {
  searchParams: { q?: string; cause?: string }
}) {
  const q = searchParams.q?.trim() ?? ''
  const cause = searchParams.cause?.trim() ?? ''

  return (
    <div className="min-h-screen bg-ink-50">
      <PublicHeader />
      <div className="skeuo-public-header">
        <div className="mx-auto max-w-5xl px-6 pb-10 pt-8">
          <h1 className="font-display text-3xl font-semibold text-white">Discover organizations</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/60">
            Local organizations on City/Sync. Explore their work, find volunteer opportunities, and start contributing in your community.
          </p>
          <form action="/orgs" method="get" className="mt-6 flex max-w-md gap-2">
            {cause ? <input type="hidden" name="cause" value={cause} /> : null}
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search organizations…"
              className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
            />
            <button className="rounded-xl bg-gold-500 px-5 py-2.5 text-sm font-semibold text-brand-900 hover:bg-gold-400">Search</button>
          </form>
        </div>
      </div>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <OrgDirectoryResults searchParams={searchParams} basePath="/orgs" />
      </main>
    </div>
  )
}
