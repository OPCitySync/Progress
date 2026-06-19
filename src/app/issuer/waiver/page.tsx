import { desc, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { waiverVersions, waiverAcceptances, orgs } from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/session'
import { createWaiverAction } from '@/app/actions'
import { Card, PageHeader, Flash, Input, Label, Textarea, Button, Badge, Mono } from '@/components/ui'
import { fmtDateTime } from '@/lib/format'

export default async function WaiverPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string }
}) {
  const session = await requireRole('issuer')
  const orgId = session.orgId!

  const org = (await db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1))[0]
  const versions = await db
    .select()
    .from(waiverVersions)
    .where(eq(waiverVersions.orgId, orgId))
    .orderBy(desc(waiverVersions.version))

  const acceptCounts = await db
    .select({ waiverVersionId: waiverAcceptances.waiverVersionId, n: sql<number>`count(*)` })
    .from(waiverAcceptances)
    .where(eq(waiverAcceptances.orgId, orgId))
    .groupBy(waiverAcceptances.waiverVersionId)
  const countByVersion = new Map(acceptCounts.map((c) => [c.waiverVersionId, Number(c.n)]))

  const active = versions.find((v) => v.active === 1)

  return (
    <>
      <PageHeader
        title="Liability waiver"
        subtitle="Participants must accept your active waiver before claiming an opportunity. Acceptance is recorded against the document hash — chain-ready by design."
      />
      <Flash searchParams={searchParams} />

      {active ? (
        <Card className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-ink-900">
                {active.title} <span className="text-ink-400">· v{active.version}</span>
              </p>
              <p className="mt-1 text-xs text-ink-400">
                Document hash (sha256): <Mono>{active.sha256}</Mono>
              </p>
              <p className="mt-1 text-xs text-ink-400">
                {countByVersion.get(active.id) ?? 0} acceptance
                {(countByVersion.get(active.id) ?? 0) === 1 ? '' : 's'} · created {fmtDateTime(active.createdAt)}
              </p>
            </div>
            <Badge tone="green">active</Badge>
          </div>
          <div className="mt-4 max-h-44 overflow-y-auto whitespace-pre-line rounded-xl border border-ink-200 bg-ink-50 p-4 text-xs leading-relaxed text-ink-600">
            {active.body}
          </div>
        </Card>
      ) : (
        <Card className="mb-6 border-dashed">
          <p className="text-sm text-ink-500">
            No waiver yet. {org?.name ?? 'Your organization'} can publish one below — until then,
            participants can claim your opportunities without a waiver step.
          </p>
        </Card>
      )}

      <Card className="max-w-2xl">
        <h2 className="font-semibold text-ink-900">
          {active ? 'Publish a new version' : 'Publish your waiver'}
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          Publishing a new version deactivates the previous one (atomic rollover). Participants who
          accepted an older version will be asked to accept the new one on their next claim.
        </p>
        <form action={createWaiverAction} className="mt-5 space-y-4">
          <input type="hidden" name="redirectTo" value="/issuer/waiver" />
          <div>
            <Label htmlFor="title">Waiver title</Label>
            <Input id="title" name="title" required placeholder="e.g. Volunteer Liability Release" />
          </div>
          <div>
            <Label htmlFor="body">Waiver text</Label>
            <Textarea
              id="body"
              name="body"
              rows={8}
              required
              placeholder="Paste the full waiver text your organization’s counsel approved…"
            />
          </div>
          <Button type="submit">Publish version</Button>
        </form>
      </Card>

      {versions.filter((v) => !v.active).length > 0 ? (
        <>
          <h2 className="mb-3 mt-9 text-sm font-semibold uppercase tracking-wider text-ink-400">
            Previous versions
          </h2>
          <Card className="divide-y divide-ink-100 p-0">
            {versions
              .filter((v) => !v.active)
              .map((v) => (
                <div key={v.id} className="flex items-center justify-between gap-3 px-6 py-4">
                  <div>
                    <p className="text-sm font-medium text-ink-700">
                      {v.title} · v{v.version}
                    </p>
                    <p className="text-xs text-ink-400">
                      <Mono>{v.sha256.slice(0, 24)}…</Mono> · {countByVersion.get(v.id) ?? 0} acceptances
                    </p>
                  </div>
                  <Badge tone="gray">retired</Badge>
                </div>
              ))}
          </Card>
        </>
      ) : null}
    </>
  )
}
