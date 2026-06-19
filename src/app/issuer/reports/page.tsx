import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { orgs } from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/session'
import { orgReportSummary } from '@/lib/services/reports'
import { Card, PageHeader, StatCard } from '@/components/ui'
import { OrgStatusBanner } from '@/components/OrgStatusBanner'

export const dynamic = 'force-dynamic'

export default async function IssuerReportsPage() {
  const session = await requireRole('issuer')
  const orgId = session.orgId!
  const org = (await db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1))[0]
  const s = await orgReportSummary(orgId)

  return (
    <>
      <PageHeader title="Reports" subtitle="Your verified impact — ready for grant and CSR reporting." />
      <OrgStatusBanner status={org?.status ?? 'pending'} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Volunteers" value={s.volunteers} />
        <StatCard label="Verified contributions" value={s.verifiedCompletions} />
        <StatCard label="Volunteer hours" value={s.hours} />
        <StatCard label="Civic credits issued" value={s.creditsIssued} />
      </div>

      <Card className="mt-6">
        <p className="font-semibold text-ink-900">Contributions export</p>
        <p className="mt-1 text-sm text-ink-500">
          A CSV of every sign-up for your organization — status, check-in, credits awarded, and hours per shift.
        </p>
        <a
          href="/api/reports?type=contributions"
          className="mt-4 inline-flex w-fit items-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
        >
          Download CSV
        </a>
      </Card>

      <Card className="mt-4 border-brand-200 bg-brand-50">
        <p className="text-sm font-semibold text-ink-800">These numbers are verifiable</p>
        <p className="mt-1 text-sm text-ink-600">
          Every contribution above is recorded on City/Sync’s tamper-evident public ledger — so the impact in your
          grant reports can be independently checked, not just claimed.{' '}
          <Link href="/transparency" className="font-semibold text-brand-600 hover:text-brand-500">
            See the public ledger →
          </Link>
        </p>
      </Card>
    </>
  )
}
