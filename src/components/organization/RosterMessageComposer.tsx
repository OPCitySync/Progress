'use client'

import { ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { sendRosterMessageAction } from '@/app/actions'
import { Button, Input, Label, Textarea } from '@/components/ui'

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

/** Two-step recipient picker: first an audience, then all or selected volunteers within it. */
export function RosterMessageComposer({
  volunteers,
  groups,
}: {
  volunteers: Volunteer[]
  groups: VolunteerGroup[]
}) {
  const [audience, setAudience] = useState('roster')
  const [selectedIds, setSelectedIds] = useState<string[]>(volunteers.map((volunteer) => volunteer.userId))

  const audienceVolunteers = useMemo(() => {
    if (audience === 'roster') return volunteers
    const groupId = audience.slice('group:'.length)
    const group = groups.find((item) => item.id === groupId)
    const groupMemberIds = new Set(group?.memberIds ?? [])
    return volunteers.filter((volunteer) => groupMemberIds.has(volunteer.userId))
  }, [audience, groups, volunteers])

  const allSelected =
    audienceVolunteers.length > 0 && audienceVolunteers.every((volunteer) => selectedIds.includes(volunteer.userId))

  function changeAudience(nextAudience: string) {
    setAudience(nextAudience)
    const nextVolunteers =
      nextAudience === 'roster'
        ? volunteers
        : volunteers.filter((volunteer) => {
            const group = groups.find((item) => item.id === nextAudience.slice('group:'.length))
            return group?.memberIds.includes(volunteer.userId)
          })
    setSelectedIds(nextVolunteers.map((volunteer) => volunteer.userId))
  }

  function toggleAll() {
    setSelectedIds(allSelected ? [] : audienceVolunteers.map((volunteer) => volunteer.userId))
  }

  function toggleVolunteer(userId: string) {
    setSelectedIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    )
  }

  const selectionLabel =
    audienceVolunteers.length === 0
      ? 'No volunteers in this audience'
      : allSelected
        ? `All volunteers (${audienceVolunteers.length})`
        : selectedIds.length === 1
          ? '1 volunteer selected'
          : `${selectedIds.length} volunteers selected`

  return (
    <form action={sendRosterMessageAction} className="mt-4 space-y-4">
      <input type="hidden" name="redirectTo" value="/issuer/volunteers" />
      <input type="hidden" name="recipientMode" value={allSelected ? 'all' : 'selected'} />

      <div>
        <Label htmlFor="audience">Audience</Label>
        <div className="relative">
          <select
            id="audience"
            name="audience"
            value={audience}
            onChange={(event) => changeAudience(event.target.value)}
            className="w-full appearance-none rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 pr-12 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            <option value="roster">Full roster ({volunteers.length})</option>
            {groups.map((group) => (
              <option key={group.id} value={`group:${group.id}`}>
                {group.name} ({group.memberIds.length})
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        </div>
      </div>

      <div>
        <Label>Volunteers</Label>
        <details className="group relative mt-1.5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 text-sm text-ink-900 [&::-webkit-details-marker]:hidden">
            <span className="truncate">{selectionLabel}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-ink-400 transition-transform group-open:rotate-180" />
          </summary>
          <div className="absolute z-20 mt-2 max-h-56 w-full overflow-y-auto rounded-xl border border-ink-200 bg-white p-2 shadow-lg">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-ink-800 hover:bg-ink-50">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                disabled={audienceVolunteers.length === 0}
                className="h-4 w-4 rounded border-ink-300 text-brand-700 focus:ring-brand-500"
              />
              All volunteers ({audienceVolunteers.length})
            </label>
            {audienceVolunteers.length > 0 ? <div className="my-1 border-t border-ink-100" /> : null}
            {audienceVolunteers.map((volunteer) => {
              const selected = selectedIds.includes(volunteer.userId)
              return (
                <label
                  key={volunteer.userId}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-ink-50"
                >
                  <input
                    type="checkbox"
                    name="memberId"
                    value={volunteer.userId}
                    checked={selected}
                    onChange={() => toggleVolunteer(volunteer.userId)}
                    className="h-4 w-4 rounded border-ink-300 text-brand-700 focus:ring-brand-500"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink-800">{volunteer.name}</span>
                    <span className="block truncate text-xs text-ink-400">{volunteer.email}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </details>
      </div>

      <div>
        <Label htmlFor="subject">Subject</Label>
        <Input id="subject" name="subject" required placeholder="e.g. Saturday shift moved to 10am" />
      </div>
      <div>
        <Label htmlFor="body">Message</Label>
        <Textarea
          id="body"
          name="body"
          rows={5}
          required
          placeholder="Shift update, request, or thank-you note…"
        />
      </div>
      <Button type="submit">Send message</Button>
    </form>
  )
}
