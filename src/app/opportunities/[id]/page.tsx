import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { tasks, orgs } from '@/lib/db/schema'
import { getSession } from '@/lib/auth/session'
import { getShiftsWithCounts, type ShiftRow } from '@/lib/services/opportunities'
import { PublicHeader } from '@/components/profile/PublicHeader'
import { Card, Badge, statusBadge } from '@/components/ui'
import { fmtDateTime } from '@/lib/format'

export const dynamic = 'force-dynamic'

function whenLabel(shift: ShiftRow): string {
  if (shift.startsAt) {
    const start = fmtDateTime(shift.startsAt)
    if (shift.endsAt) {
      const end = new Date(shift.endsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      return `${start} – ${end}`
    }
    return start
  }
  return shift.label || 'Time TBD'
}

async function load(id: string) {
  const row = (
    await db
      .select({ task: tasks, org: orgs })
      .from(tasks)
      .innerJoin(orgs, eq(tasks.orgId, orgs.id))
      .where(and(eq(tasks.id, id), eq(orgs.status, 'approved')))
      .limit(1)
  )[0]
  if (!row) return null
  const shiftRows = await getShiftsWithCounts(id)
  const openSlots = shiftRows
    .filter((s) => s.shift.status === 'open')
    .reduce((sum, s) => sum + s.slotsLeft, 0)
  return { ...row, shiftRows, openSlots }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const data = await load(params.id)
  if (!data) return { title: 'Opportunity not found · City/Sync' }
  return {
    title: `${data.task.title} · ${data.org.name} · City/Sync`,
    description: data.task.description || `Volunteer with ${data.org.name} and earn civic credits.`,
  }
}

export default async function PublicOpportunityPage({ params }: { params: { id: string } }) {
  const data = await load(params.id)
  if (!data) notFound()
  const { task, org, shiftRows, openSlots } = data
  const session = await getSession()

  const claimPath = `/participant/opportunities/${task.id}`
  const signupHref = `/signup?type=participant&next=${encodeURIComponent(claimPath)}`
  const isOpen = task.status === 'open' && openSlots > 0

  return (
    <div className="min-h-screen bg-ink-50">
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link href={`/orgs/${org.slug}`} className="mb-4 inline-block text-sm text-ink-400 hover:text-ink-600">
          ← {org.name}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-display text-3xl font-semibold text-ink-900">{task.title}</h1>
          <Badge tone="gold">{task.credits} credits per shift</Badge>
        </div>
        <p className="mt-1 text-sm text-ink-500">
          <Link href={`/orgs/${org.slug}`} className="font-medium hover:text-brand-600">
            {org.name}
          </Link>
          {task.location ? ` · ${task.location}` : ''}
        </p>

        {task.description ? (
          <Card className="mt-6">
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink-600">{task.description}</p>
          </Card>
        ) : null}

        <h2 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wider text-ink-400">Shifts</h2>
        {shiftRows.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-500">No shifts scheduled yet.</p>
          </Card>
        ) : (
          <Card className="divide-y divide-ink-100 p-0">
            {shiftRows.map(({ shift, slotsLeft }) => (
              <div key={shift.id} className="flex items-center justify-between gap-3 px-6 py-4">
                <p className="text-sm font-medium text-ink-800">{whenLabel(shift)}</p>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-ink-400">
                    {slotsLeft} of {shift.capacity} open
                  </span>
                  {statusBadge(shift.status)}
                </div>
              </div>
            ))}
          </Card>
        )}

        <Card className="mt-4">
          {!isOpen ? (
            <p className="text-sm text-ink-500">
              This opportunity isn’t open for new sign-ups right now.{' '}
              <Link href={`/orgs/${org.slug}`} className="font-semibold text-brand-600 hover:text-brand-500">
                See other ways to help →
              </Link>
            </p>
          ) : !session ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink-800">Ready to volunteer?</p>
                <p className="mt-0.5 text-sm text-ink-500">
                  Create a free City/Sync account to sign up for a shift and earn civic credits.
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  href={signupHref}
                  className="rounded-xl bg-gold-500 px-5 py-2.5 text-sm font-semibold text-brand-900 hover:bg-gold-400"
                >
                  Create an account
                </Link>
                <Link
                  href={`/login?next=${encodeURIComponent(claimPath)}`}
                  className="rounded-xl border border-ink-300 px-5 py-2.5 text-sm font-semibold text-ink-700 hover:bg-ink-50"
                >
                  Sign in
                </Link>
              </div>
            </div>
          ) : session.role === 'participant' ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-600">You’re signed in — choose a shift to sign up.</p>
              <Link
                href={claimPath}
                className="rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
              >
                Choose a shift
              </Link>
            </div>
          ) : (
            <p className="text-sm text-ink-500">
              Volunteer sign-ups are made from a participant account. Organizations and admins can browse but not
              sign up.
            </p>
          )}
        </Card>
      </main>
    </div>
  )
}
