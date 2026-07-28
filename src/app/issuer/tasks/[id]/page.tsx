import Link from 'next/link'
import { notFound } from 'next/navigation'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { tasks, claims, users } from '@/lib/db/schema'
import { requireRole } from '@/lib/auth/session'
import { getShiftsWithCounts, type ShiftRow } from '@/lib/services/opportunities'
import {
  verifyClaimAction,
  rejectClaimAction,
  closeTaskAction,
  reopenTaskAction,
  createShiftAction,
  closeShiftAction,
  issuerCheckInAction,
  setTaskCredentialsAction,
} from '@/app/actions'
import { Card, PageHeader, EmptyState, Flash, Input, Label, Button, Mono, statusBadge, Badge } from '@/components/ui'
import { CredentialPicker } from '@/components/CredentialPicker'
import { parseCredentialList } from '@/lib/credentials'
import { fmtDateTime } from '@/lib/format'
import { participantDisplayName } from '@/lib/participant-name'

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

export default async function IssuerTaskDetail({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { error?: string; ok?: string }
}) {
  const session = await requireRole('issuer')

  const task = (await db.select().from(tasks).where(eq(tasks.id, params.id)).limit(1))[0]
  if (!task || task.orgId !== session.orgId) notFound()

  const shiftRows = await getShiftsWithCounts(task.id)
  const shiftLabelById = new Map(shiftRows.map(({ shift }) => [shift.id, whenLabel(shift)]))

  const taskClaims = await db
    .select({ claim: claims, participant: users })
    .from(claims)
    .innerJoin(users, eq(claims.userId, users.id))
    .where(eq(claims.taskId, task.id))
    .orderBy(desc(claims.updatedAt))

  const redirectTo = `/issuer/tasks/${task.id}`

  return (
    <>
      <Link href="/issuer" className="mb-4 inline-block text-sm text-ink-400 hover:text-ink-600">
        ← Dashboard
      </Link>
      <PageHeader
        title={task.title}
        subtitle={`${task.credits} credits per completion · ${shiftRows.length} shift${shiftRows.length === 1 ? '' : 's'}`}
        action={
          task.status === 'open' ? (
            <form action={closeTaskAction}>
              <input type="hidden" name="taskId" value={task.id} />
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <Button variant="danger" type="submit">
                Close opportunity
              </Button>
            </form>
          ) : (
            <form action={reopenTaskAction}>
              <input type="hidden" name="taskId" value={task.id} />
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <Button type="submit">Activate opportunity</Button>
            </form>
          )
        }
      />
      <Flash searchParams={searchParams} />

      {task.description ? (
        <Card className="mb-6">
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink-600">{task.description}</p>
        </Card>
      ) : null}

      <Card className="mb-6">
        <p className="text-sm font-semibold text-ink-800">Required credentials</p>
        <p className="mb-3 mt-0.5 text-xs text-ink-400">
          Volunteers must hold these (granted by your org or an admin) before they can sign up.
        </p>
        <form action={setTaskCredentialsAction} className="space-y-3">
          <input type="hidden" name="taskId" value={task.id} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <CredentialPicker selected={parseCredentialList(task.requiredCredentials)} />
          <Button type="submit" variant="secondary">
            Save requirements
          </Button>
        </form>
      </Card>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-400">Shifts</h2>
      {shiftRows.length === 0 ? (
        <EmptyState title="No shifts yet" body="Add a shift below so volunteers can sign up." />
      ) : (
        <Card className="mb-4 divide-y divide-ink-100 p-0">
          {shiftRows.map(({ shift, taken, slotsLeft }) => (
            <div key={shift.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
              <div>
                <p className="text-sm font-semibold text-ink-800">{whenLabel(shift)}</p>
                <p className="text-xs text-ink-400">
                  {taken} signed up · {slotsLeft} of {shift.capacity} open · check-in code{' '}
                  <Mono>{shift.checkInCode}</Mono>
                </p>
              </div>
              <div className="flex items-center gap-3">
                {statusBadge(shift.status)}
                {shift.status === 'open' ? (
                  <form action={closeShiftAction}>
                    <input type="hidden" name="shiftId" value={shift.id} />
                    <input type="hidden" name="redirectTo" value={redirectTo} />
                    <button className="text-xs font-medium text-ink-400 hover:text-red-600">Close shift</button>
                  </form>
                ) : null}
              </div>
            </div>
          ))}
        </Card>
      )}

      {task.status === 'open' ? (
        <Card className="mb-8">
          <p className="text-sm font-semibold text-ink-800">Add a shift</p>
          <form action={createShiftAction} className="mt-3 space-y-3">
            <input type="hidden" name="taskId" value={task.id} />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="shiftStartsAt">Starts</Label>
                <Input id="shiftStartsAt" name="shiftStartsAt" type="datetime-local" />
              </div>
              <div>
                <Label htmlFor="shiftEndsAt">Ends (optional)</Label>
                <Input id="shiftEndsAt" name="shiftEndsAt" type="datetime-local" />
              </div>
              <div>
                <Label htmlFor="capacity">Capacity</Label>
                <Input id="capacity" name="capacity" type="number" min={1} required defaultValue={1} />
              </div>
              <div>
                <Label htmlFor="shiftLabel">Label (optional)</Label>
                <Input id="shiftLabel" name="shiftLabel" placeholder="e.g. Morning crew" />
              </div>
            </div>
            <Button type="submit" variant="secondary">
              Add shift
            </Button>
          </form>
        </Card>
      ) : null}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-400">Sign-ups</h2>
      {taskClaims.length === 0 ? (
        <EmptyState title="No sign-ups yet" body="Volunteers who sign up for a shift appear here." />
      ) : (
        <div className="space-y-3">
          {taskClaims.map(({ claim, participant }) => (
            <Card key={claim.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink-800">{participantDisplayName(participant)}</p>
                  <p className="text-xs text-ink-400">
                    {participant.email}
                    {claim.shiftId && shiftLabelById.get(claim.shiftId)
                      ? ` · ${shiftLabelById.get(claim.shiftId)}`
                      : ''}
                    {claim.checkedInAt ? ` · checked in ${fmtDateTime(claim.checkedInAt)}` : ''}
                  </p>
                  {claim.note ? (
                    <p className="mt-2 rounded-xl bg-ink-50 px-3 py-2 text-sm text-ink-600">“{claim.note}”</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {statusBadge(claim.status)}
                  {(claim.status === 'claimed' || claim.status === 'submitted') && !claim.checkedInAt ? (
                    <form action={issuerCheckInAction}>
                      <input type="hidden" name="claimId" value={claim.id} />
                      <input type="hidden" name="redirectTo" value={redirectTo} />
                      <Button type="submit" variant="secondary">
                        Check in
                      </Button>
                    </form>
                  ) : null}
                  {claim.status === 'submitted' || claim.status === 'claimed' ? (
                    <>
                      <form action={verifyClaimAction}>
                        <input type="hidden" name="claimId" value={claim.id} />
                        <input type="hidden" name="redirectTo" value={redirectTo} />
                        <Button type="submit">Verify &amp; mint</Button>
                      </form>
                      <form action={rejectClaimAction}>
                        <input type="hidden" name="claimId" value={claim.id} />
                        <input type="hidden" name="redirectTo" value={redirectTo} />
                        <Button type="submit" variant="danger">
                          Reject
                        </Button>
                      </form>
                    </>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
