import { ChevronDown, FolderPlus, UsersRound } from 'lucide-react'
import { createVolunteerGroupAction, updateVolunteerGroupMembersAction } from '@/app/actions'
import { Button, Card, Input, Label } from '@/components/ui'

type Volunteer = {
  userId: string
  name: string
  email: string
}

type VolunteerGroup = {
  id: string
  name: string
  memberIds: string[]
}

function MemberPicker({ volunteers, selectedIds = [] }: { volunteers: Volunteer[]; selectedIds?: string[] }) {
  const selected = new Set(selectedIds)
  if (volunteers.length === 0) {
    return <p className="text-sm text-ink-500">Volunteers appear here after they claim an opportunity.</p>
  }

  return (
    <div className="volunteer-member-picker max-h-48 space-y-1 overflow-y-auto rounded-xl border border-ink-200 bg-ink-50/50 p-2">
      {volunteers.map((volunteer) => (
        <label
          key={volunteer.userId}
          className="volunteer-member-option flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white"
        >
          <input
            type="checkbox"
            name="memberId"
            value={volunteer.userId}
            defaultChecked={selected.has(volunteer.userId)}
            className="h-4 w-4 rounded border-ink-300 text-brand-700 focus:ring-brand-500"
          />
          <span className="min-w-0">
            <span className="block truncate font-medium text-ink-800">{volunteer.name}</span>
            <span className="block truncate text-xs text-ink-400">{volunteer.email}</span>
          </span>
        </label>
      ))}
    </div>
  )
}

/** Issuer-managed volunteer collections, independent of opportunity history. */
export function VolunteerGroupingManager({
  groups,
  volunteers,
}: {
  groups: VolunteerGroup[]
  volunteers: Volunteer[]
}) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-400">Volunteer groupings</h2>

      <Card className="p-0">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                <FolderPlus size={18} />
              </span>
              <span>
                <span className="block text-sm font-semibold text-ink-800">Create a grouping</span>
                <span className="block text-xs text-ink-500">Name a group and choose its volunteers.</span>
              </span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-ink-400 transition-transform group-open:rotate-180" />
          </summary>

          <form action={createVolunteerGroupAction} className="border-t border-ink-100 px-5 py-4">
            <input type="hidden" name="redirectTo" value="/issuer/volunteers" />
            <div>
              <Label htmlFor="volunteerGroupName">Grouping name</Label>
              <Input id="volunteerGroupName" name="name" maxLength={80} required placeholder="e.g. Saturday pantry team" />
            </div>
            <fieldset className="mt-4">
              <legend className="text-sm font-medium text-ink-700">Add members <span className="font-normal text-ink-400">(optional)</span></legend>
              <p className="mt-1 text-xs text-ink-500">You can change the members at any time.</p>
              <div className="mt-2">
                <MemberPicker volunteers={volunteers} />
              </div>
            </fieldset>
            <div className="mt-4 flex justify-end">
              <Button type="submit">Create grouping</Button>
            </div>
          </form>
        </details>
      </Card>

      {groups.length > 0 ? (
        <div className="mt-3 space-y-3">
          {groups.map((group) => (
            <Card key={group.id} className="p-0">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-100 text-ink-600">
                      <UsersRound size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink-800">{group.name}</span>
                      <span className="block text-xs text-ink-500">
                        {group.memberIds.length} member{group.memberIds.length === 1 ? '' : 's'}
                      </span>
                    </span>
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-ink-400 transition-transform group-open:rotate-180" />
                </summary>

                <form action={updateVolunteerGroupMembersAction} className="border-t border-ink-100 px-5 py-4">
                  <input type="hidden" name="redirectTo" value="/issuer/volunteers" />
                  <input type="hidden" name="groupId" value={group.id} />
                  <fieldset>
                    <legend className="text-sm font-medium text-ink-700">Members</legend>
                    <p className="mt-1 text-xs text-ink-500">Select the volunteers who belong in {group.name}.</p>
                    <div className="mt-2">
                      <MemberPicker volunteers={volunteers} selectedIds={group.memberIds} />
                    </div>
                  </fieldset>
                  <div className="mt-4 flex justify-end">
                    <Button type="submit" variant="secondary">Save members</Button>
                  </div>
                </form>
              </details>
            </Card>
          ))}
        </div>
      ) : null}
    </section>
  )
}
