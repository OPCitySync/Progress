import { requireRole } from '@/lib/auth/session'
import { getInterests, getNeighborhood, listAllCauses } from '@/lib/services/interests'
import { saveInterestsAction } from '@/app/actions'
import { Card, PageHeader, Flash, Input, Label, Button } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function InterestsPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string }
}) {
  const session = await requireRole('participant')
  const [interests, neighborhood, causes] = await Promise.all([
    getInterests(session.sub),
    getNeighborhood(session.sub),
    listAllCauses(),
  ])

  // Suggest the union of community causes and anything the volunteer already picked.
  const options = Array.from(new Set([...causes, ...interests])).sort((a, b) => a.localeCompare(b))

  return (
    <>
      <PageHeader
        title="Your interests"
        subtitle="Pick the causes you care about. We’ll recommend matching opportunities and alert you when new ones open."
      />
      <Flash searchParams={searchParams} />

      <Card className="max-w-2xl">
        <form action={saveInterestsAction} className="space-y-5">
          {options.length > 0 ? (
            <div>
              <p className="mb-2 text-sm font-medium text-ink-700">Causes in your community</p>
              <div className="flex flex-wrap gap-2">
                {options.map((c) => (
                  <label
                    key={c}
                    className="inline-flex items-center gap-2 rounded-xl border border-ink-200 px-3 py-1.5 text-sm text-ink-700 hover:border-ink-300"
                  >
                    <input type="checkbox" name="interest" value={c} defaultChecked={interests.includes(c)} />
                    {c}
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-500">
              No community causes yet — add your own below and we’ll match you as organizations join.
            </p>
          )}

          <div>
            <p className="mb-1 text-sm font-medium text-ink-700">Add your own (comma separated)</p>
            <Input name="interest" placeholder="e.g. Animals, Education, Environment" />
          </div>

          <div>
            <Label htmlFor="neighborhood">Your neighborhood</Label>
            <p className="mb-1 text-xs text-ink-400">
              Powers neighborhood leaderboards in the MyCity Feed. Shown only as an aggregate, never tied to your name.
            </p>
            <Input id="neighborhood" name="neighborhood" defaultValue={neighborhood} placeholder="e.g. Riverside" />
          </div>

          <Button type="submit">Save</Button>
        </form>
      </Card>
    </>
  )
}
