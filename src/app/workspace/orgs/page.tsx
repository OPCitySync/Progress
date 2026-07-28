import { PageHeader } from '@/components/ui'
import { OrgDirectoryResults } from '@/components/OrgDirectoryResults'
import { requireSession } from '@/lib/auth/session'
import { getActiveCity } from '@/lib/services/city-networks'

export const dynamic = 'force-dynamic'

export default async function WorkspaceOrganizationsPage({
  searchParams,
}: {
  searchParams: { q?: string; cause?: string }
}) {
  const q = searchParams.q?.trim() ?? ''
  const cause = searchParams.cause?.trim() ?? ''
  const session = await requireSession()
  const city = await getActiveCity(session)

  return (
    <>
      <PageHeader title="Discover organizations" subtitle={city ? `Explore organizations in ${city.name}.` : 'Add a city network to discover local organizations.'} />
      <form action="/workspace/orgs" method="get" className="mb-7 flex max-w-md gap-2">
        {cause ? <input type="hidden" name="cause" value={cause} /> : null}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search organizations…"
          className="w-full rounded-xl border border-ink-300 bg-white px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
        <button className="rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">Search</button>
      </form>
      <OrgDirectoryResults searchParams={searchParams} basePath="/workspace/orgs" cityId={city?.id} />
    </>
  )
}
