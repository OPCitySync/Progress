'use client'

import { CalendarDays, Check, ChevronLeft, ChevronRight, GripVertical, Printer, Repeat2, Search, UserPlus, UserRoundCog, UsersRound, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  assignStaffToShiftInlineAction,
  assignVolunteerToShiftInlineAction,
  planStaffForRecurringShiftInlineAction,
  planVolunteerForRecurringShiftInlineAction,
  removeStaffFromRecurringShiftPlanInlineAction,
  removeStaffFromShiftInlineAction,
  removeVolunteerFromShiftInlineAction,
  removeVolunteerFromRecurringShiftPlanInlineAction,
} from '@/app/actions'
import styles from '../prototype.module.css'

type SchedulerVolunteer = {
  userId: string
  name: string
  email: string
  status: 'active' | 'committed' | 'needs-waiver' | 'inactive'
  roleTitles: string[]
}

type SchedulerStaff = {
  userId: string
  delegationId: string
  name: string
  email: string
  roleLabel: string
}

export type RosterSchedulingShift = {
  id: string
  taskId: string
  title: string
  startsAt: number | null
  endsAt: number | null
  location: string
  capacity: number
  visibility: 'public' | 'private'
  assignedUserIds: string[]
  assignedStaffUserIds: string[]
}

type RecurringShiftPlan = {
  scheduleId: string
  taskId: string
  title: string
  location: string
  capacity: number
  visibility: 'public' | 'private'
  intervalDays: number
  nextStartsAt: number
  durationMinutes: number
}

type PlannedRecurringAssignment = {
  taskId: string
  occurrenceStartsAt: number
  userId: string
}

type PlanningMember = { kind: 'staff' | 'volunteer'; userId: string }

type CapacityOverride =
  | { kind: 'published'; shift: RosterSchedulingShift; member: PlanningMember; assignedVolunteerCount: number }
  | { kind: 'planned'; plan: RecurringShiftPlan; startsAt: number; member: PlanningMember; assignedVolunteerCount: number }

const DAY = 24 * 60 * 60 * 1000

function startOfLocalDay(value: number | Date) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function mondayStart(value = Date.now()) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return date.getTime()
}

function inputDate(value: number) {
  const date = new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function parseInputDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)
    ? new Date(year, month - 1, day).getTime()
    : mondayStart()
}

function whenLabel(startsAt: number | null, endsAt: number | null) {
  if (!startsAt) return 'Date and time to be confirmed'
  const start = new Date(startsAt)
  const date = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const endTime = endsAt ? new Date(endsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null
  return `${date} · ${startTime}${endTime ? `–${endTime}` : ''}`
}

function dayLabel(timestamp: number) {
  return new Date(timestamp).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function dateRangeLabel(start: number, end: number) {
  const from = new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const through = new Date(end - 1).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${from} – ${through}`
}

function addDays(value: number, days: number) {
  const date = new Date(value)
  date.setDate(date.getDate() + days)
  return date.getTime()
}

function twoMonthsFromNow() {
  const date = new Date()
  date.setMonth(date.getMonth() + 2)
  return date.getTime()
}

function statusLabel(status: SchedulerVolunteer['status']) {
  // Roster-wide waiver state is not a reliable program-specific requirement.
  // Eligibility is checked for the selected shift before assignment is saved.
  if (status === 'needs-waiver') return 'Roster member'
  if (status === 'committed') return 'Active commitment'
  if (status === 'active') return 'Active volunteer'
  return 'Roster member'
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'CS'
}

function recurringOccurrenceKey(taskId: string, occurrenceStartsAt: number) {
  return `${taskId}:${occurrenceStartsAt}`
}

/** A planning surface that keeps staff support distinct from volunteer claims. */
export function ProgramRosterScheduler({
  volunteers,
  staff,
  shifts,
  recurringShifts,
  plannedRecurringVolunteers,
  plannedRecurringStaff,
  programName,
  programId,
  headerActions,
}: {
  volunteers: SchedulerVolunteer[]
  staff: SchedulerStaff[]
  shifts: RosterSchedulingShift[]
  recurringShifts: RecurringShiftPlan[]
  plannedRecurringVolunteers: PlannedRecurringAssignment[]
  plannedRecurringStaff: PlannedRecurringAssignment[]
  programName: string
  programId: string
  headerActions?: ReactNode
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [rangeStart, setRangeStart] = useState(() => mondayStart())
  const [rangeWeeks, setRangeWeeks] = useState<1 | 2 | 4>(2)
  const [selectedMember, setSelectedMember] = useState<PlanningMember | null>(null)
  const [dragMember, setDragMember] = useState<PlanningMember | null>(null)
  const [targetShiftId, setTargetShiftId] = useState<string | null>(null)
  const [volunteerAssignments, setVolunteerAssignments] = useState<Record<string, string[]>>(() => Object.fromEntries(shifts.map((shift) => [shift.id, shift.assignedUserIds])))
  const [staffAssignments, setStaffAssignments] = useState<Record<string, string[]>>(() => Object.fromEntries(shifts.map((shift) => [shift.id, shift.assignedStaffUserIds])))
  const [plannedVolunteerAssignments, setPlannedVolunteerAssignments] = useState<Record<string, string[]>>(() => {
    const entries: Record<string, string[]> = {}
    plannedRecurringVolunteers.forEach((assignment) => {
      const key = recurringOccurrenceKey(assignment.taskId, assignment.occurrenceStartsAt)
      entries[key] = [...(entries[key] ?? []), assignment.userId]
    })
    return entries
  })
  const [plannedStaffAssignments, setPlannedStaffAssignments] = useState<Record<string, string[]>>(() => {
    const entries: Record<string, string[]> = {}
    plannedRecurringStaff.forEach((assignment) => {
      const key = recurringOccurrenceKey(assignment.taskId, assignment.occurrenceStartsAt)
      entries[key] = [...(entries[key] ?? []), assignment.userId]
    })
    return entries
  })
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [capacityOverride, setCapacityOverride] = useState<CapacityOverride | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setVolunteerAssignments(Object.fromEntries(shifts.map((shift) => [shift.id, shift.assignedUserIds])))
    setStaffAssignments(Object.fromEntries(shifts.map((shift) => [shift.id, shift.assignedStaffUserIds])))
  }, [shifts])

  useEffect(() => {
    const entries: Record<string, string[]> = {}
    plannedRecurringVolunteers.forEach((assignment) => {
      const key = recurringOccurrenceKey(assignment.taskId, assignment.occurrenceStartsAt)
      entries[key] = [...(entries[key] ?? []), assignment.userId]
    })
    setPlannedVolunteerAssignments(entries)
  }, [plannedRecurringVolunteers])

  useEffect(() => {
    const entries: Record<string, string[]> = {}
    plannedRecurringStaff.forEach((assignment) => {
      const key = recurringOccurrenceKey(assignment.taskId, assignment.occurrenceStartsAt)
      entries[key] = [...(entries[key] ?? []), assignment.userId]
    })
    setPlannedStaffAssignments(entries)
  }, [plannedRecurringStaff])

  const volunteersById = useMemo(() => new Map(volunteers.map((person) => [person.userId, person])), [volunteers])
  const staffById = useMemo(() => new Map(staff.map((person) => [person.userId, person])), [staff])
  const normalizedQuery = query.trim().toLowerCase()
  const filteredStaff = useMemo(() => !normalizedQuery ? staff : staff.filter((person) => `${person.name} ${person.email} ${person.roleLabel}`.toLowerCase().includes(normalizedQuery)), [normalizedQuery, staff])
  const filteredVolunteers = useMemo(() => !normalizedQuery ? volunteers : volunteers.filter((person) => `${person.name} ${person.email} ${person.roleTitles.join(' ')} ${statusLabel(person.status)}`.toLowerCase().includes(normalizedQuery)), [normalizedQuery, volunteers])
  const selectedPerson = selectedMember?.kind === 'staff'
    ? staffById.get(selectedMember.userId) ?? null
    : selectedMember?.kind === 'volunteer'
      ? volunteersById.get(selectedMember.userId) ?? null
      : null
  const rangeEnd = rangeStart + rangeWeeks * 7 * DAY
  const shiftsInRange = useMemo(() => shifts.filter((shift) => shift.startsAt && shift.startsAt >= rangeStart && shift.startsAt < rangeEnd), [rangeEnd, rangeStart, shifts])
  const shiftsByDay = useMemo(() => {
    const grouped = new Map<number, RosterSchedulingShift[]>()
    shiftsInRange.forEach((shift) => {
      const key = startOfLocalDay(shift.startsAt!)
      grouped.set(key, [...(grouped.get(key) ?? []), shift])
    })
    return grouped
  }, [shiftsInRange])
  const recurringHorizonEnd = useMemo(() => twoMonthsFromNow(), [])
  const shiftViewInstances = useMemo(() => {
    const horizonStart = startOfLocalDay(Date.now())
    const published = shifts
      .filter((shift) => shift.startsAt && shift.startsAt >= horizonStart)
      .map((shift) => ({ kind: 'published' as const, startsAt: shift.startsAt!, shift }))
    const publishedStarts = new Set(published.map((instance) => recurringOccurrenceKey(instance.shift.taskId, instance.startsAt)))
    const planned = new Map<string, { kind: 'planned'; plan: RecurringShiftPlan; startsAt: number; endsAt: number }>()
    recurringShifts.forEach((plan) => {
      let nextStartsAt = plan.nextStartsAt
      while (nextStartsAt < horizonStart) nextStartsAt = addDays(nextStartsAt, plan.intervalDays)
      while (nextStartsAt < recurringHorizonEnd) {
        const occurrenceKey = recurringOccurrenceKey(plan.taskId, nextStartsAt)
        if (!publishedStarts.has(occurrenceKey) && !planned.has(occurrenceKey)) {
          planned.set(occurrenceKey, {
            kind: 'planned',
            plan,
            startsAt: nextStartsAt,
            endsAt: nextStartsAt + plan.durationMinutes * 60_000,
          })
        }
        nextStartsAt = addDays(nextStartsAt, plan.intervalDays)
      }
    })
    return [...published, ...Array.from(planned.values())].sort((a, b) => a.startsAt - b.startsAt)
  }, [recurringHorizonEnd, recurringShifts, shifts])

  const setMember = (member: PlanningMember) => {
    setSelectedMember((current) => current?.kind === member.kind && current.userId === member.userId ? null : member)
    setNotice(null)
  }

  const assign = (shift: RosterSchedulingShift, member: PlanningMember, allowOverCapacity = false) => {
    if (isPending) return
    const isStaff = member.kind === 'staff'
    const person = isStaff ? staffById.get(member.userId) : volunteersById.get(member.userId)
    if (!person) return
    const current = isStaff ? staffAssignments[shift.id] ?? [] : volunteerAssignments[shift.id] ?? []
    if (current.includes(member.userId)) return setNotice({ tone: 'error', text: `${person.name} is already scheduled for this shift.` })
    if (!isStaff && current.length >= shift.capacity && !allowOverCapacity) {
      setCapacityOverride({ kind: 'published', shift, member, assignedVolunteerCount: current.length })
      return
    }
    setPendingKey(`${member.kind}:${shift.id}:${member.userId}`)
    setNotice(null)
    startTransition(async () => {
      const result = isStaff
        ? await assignStaffToShiftInlineAction({ shiftId: shift.id, userId: member.userId })
        : await assignVolunteerToShiftInlineAction({ shiftId: shift.id, userId: member.userId, allowOverCapacity })
      if (!result.ok) setNotice({ tone: 'error', text: result.error })
      else {
        if (isStaff) setStaffAssignments((currentAssignments) => ({ ...currentAssignments, [shift.id]: [...(currentAssignments[shift.id] ?? []), member.userId] }))
        else setVolunteerAssignments((currentAssignments) => ({ ...currentAssignments, [shift.id]: [...(currentAssignments[shift.id] ?? []), member.userId] }))
        setSelectedMember(null)
        setNotice({ tone: 'success', text: `${person.name} is saved on ${shift.title}.` })
        router.refresh()
      }
      setPendingKey(null)
    })
  }

  const remove = (shift: RosterSchedulingShift, member: PlanningMember) => {
    if (isPending || (member.kind === 'volunteer' && shift.visibility !== 'private')) return
    const person = member.kind === 'staff' ? staffById.get(member.userId) : volunteersById.get(member.userId)
    if (!person) return
    setPendingKey(`${member.kind}:${shift.id}:${member.userId}`)
    setNotice(null)
    startTransition(async () => {
      const result = member.kind === 'staff'
        ? await removeStaffFromShiftInlineAction({ shiftId: shift.id, userId: member.userId })
        : await removeVolunteerFromShiftInlineAction({ shiftId: shift.id, userId: member.userId })
      if (!result.ok) setNotice({ tone: 'error', text: result.error })
      else {
        if (member.kind === 'staff') setStaffAssignments((currentAssignments) => ({ ...currentAssignments, [shift.id]: (currentAssignments[shift.id] ?? []).filter((id) => id !== member.userId) }))
        else setVolunteerAssignments((currentAssignments) => ({ ...currentAssignments, [shift.id]: (currentAssignments[shift.id] ?? []).filter((id) => id !== member.userId) }))
        setNotice({ tone: 'success', text: `${person.name} was removed from ${shift.title}.` })
        router.refresh()
      }
      setPendingKey(null)
    })
  }

  const startDrag = (event: React.DragEvent<HTMLButtonElement>, member: PlanningMember) => {
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData('text/citysync-plan-member', `${member.kind}:${member.userId}`)
    setDragMember(member)
    setSelectedMember(member)
  }

  const dropMember = (event: React.DragEvent<HTMLElement>, shift: RosterSchedulingShift) => {
    event.preventDefault()
    const value = event.dataTransfer.getData('text/citysync-plan-member')
    const [kind, userId] = value.split(':') as [PlanningMember['kind'], string]
    const member = kind && userId && (kind === 'staff' || kind === 'volunteer') ? { kind, userId } as PlanningMember : dragMember
    setTargetShiftId(null)
    setDragMember(null)
    if (member) assign(shift, member)
  }

  const assignPlannedMember = (plan: RecurringShiftPlan, startsAt: number, member: PlanningMember, allowOverCapacity = false) => {
    if (isPending) return
    const isStaff = member.kind === 'staff'
    const person = isStaff ? staffById.get(member.userId) : volunteersById.get(member.userId)
    if (!person) return
    const key = recurringOccurrenceKey(plan.taskId, startsAt)
    const current = isStaff ? plannedStaffAssignments[key] ?? [] : plannedVolunteerAssignments[key] ?? []
    if (current.includes(member.userId)) return setNotice({ tone: 'error', text: `${person.name} is already planned for this occurrence.` })
    if (!isStaff && current.length >= plan.capacity && !allowOverCapacity) {
      setCapacityOverride({ kind: 'planned', plan, startsAt, member, assignedVolunteerCount: current.length })
      return
    }
    setPendingKey(`planned:${member.kind}:${startsAt}:${member.userId}`)
    setNotice(null)
    startTransition(async () => {
      const result = isStaff
        ? await planStaffForRecurringShiftInlineAction({ taskId: plan.taskId, occurrenceStartsAt: startsAt, userId: member.userId })
        : await planVolunteerForRecurringShiftInlineAction({ taskId: plan.taskId, occurrenceStartsAt: startsAt, userId: member.userId, allowOverCapacity })
      if (!result.ok) setNotice({ tone: 'error', text: result.error })
      else {
        if (result.assigned) {
          if (isStaff) setPlannedStaffAssignments((assignments) => ({ ...assignments, [key]: [...(assignments[key] ?? []), member.userId] }))
          else setPlannedVolunteerAssignments((assignments) => ({ ...assignments, [key]: [...(assignments[key] ?? []), member.userId] }))
        }
        setSelectedMember(null)
        setNotice({
          tone: 'success',
          text: isStaff
            ? `${person.name} is planned as staff for ${plan.title}.`
            : `${person.name} is planned for ${plan.title}. They will be notified when the shift publishes.`,
        })
        router.refresh()
      }
      setPendingKey(null)
    })
  }

  const removePlannedMember = (plan: RecurringShiftPlan, startsAt: number, member: PlanningMember) => {
    if (isPending) return
    const isStaff = member.kind === 'staff'
    const person = isStaff ? staffById.get(member.userId) : volunteersById.get(member.userId)
    if (!person) return
    const key = recurringOccurrenceKey(plan.taskId, startsAt)
    setPendingKey(`planned:${member.kind}:${startsAt}:${member.userId}`)
    setNotice(null)
    startTransition(async () => {
      const result = isStaff
        ? await removeStaffFromRecurringShiftPlanInlineAction({ taskId: plan.taskId, occurrenceStartsAt: startsAt, userId: member.userId })
        : await removeVolunteerFromRecurringShiftPlanInlineAction({ taskId: plan.taskId, occurrenceStartsAt: startsAt, userId: member.userId })
      if (!result.ok) setNotice({ tone: 'error', text: result.error })
      else {
        if (isStaff) setPlannedStaffAssignments((assignments) => ({ ...assignments, [key]: (assignments[key] ?? []).filter((id) => id !== member.userId) }))
        else setPlannedVolunteerAssignments((assignments) => ({ ...assignments, [key]: (assignments[key] ?? []).filter((id) => id !== member.userId) }))
        setNotice({ tone: 'success', text: `${person.name} was removed from the planned ${isStaff ? 'staff support' : 'occurrence'}.` })
        router.refresh()
      }
      setPendingKey(null)
    })
  }

  const dropPlannedMember = (event: React.DragEvent<HTMLElement>, plan: RecurringShiftPlan, startsAt: number) => {
    event.preventDefault()
    const value = event.dataTransfer.getData('text/citysync-plan-member')
    const [kind, userId] = value.split(':') as [PlanningMember['kind'], string]
    const member = kind && userId && (kind === 'staff' || kind === 'volunteer') ? { kind, userId } as PlanningMember : dragMember
    setTargetShiftId(null)
    setDragMember(null)
    if (member) assignPlannedMember(plan, startsAt, member)
  }

  const openPrintView = () => {
    const queryString = new URLSearchParams({ from: String(rangeStart), to: String(rangeEnd) })
    window.open(`/aesthetic-lab/issuer/programs/${programId}/schedule?${queryString.toString()}`, '_blank', 'noopener,noreferrer')
  }

  const confirmCapacityOverride = () => {
    const override = capacityOverride
    if (!override) return
    setCapacityOverride(null)
    if (override.kind === 'published') assign(override.shift, override.member, true)
    else assignPlannedMember(override.plan, override.startsAt, override.member, true)
  }

  const renderShift = (shift: RosterSchedulingShift, isNextOccurrence = false) => {
    const assignedVolunteerIds = volunteerAssignments[shift.id] ?? []
    const assignedStaffIds = staffAssignments[shift.id] ?? []
    const spotsLeft = Math.max(0, shift.capacity - assignedVolunteerIds.length)
    const selectedAlreadyAssigned = Boolean(selectedMember && (selectedMember.kind === 'staff' ? assignedStaffIds : assignedVolunteerIds).includes(selectedMember.userId))
    const selectedCanBeAssigned = Boolean(selectedMember && !selectedAlreadyAssigned)
    const isTarget = targetShiftId === shift.id
    return <article key={shift.id} data-drop-target={isTarget ? 'true' : undefined} data-full={spotsLeft === 0 ? 'true' : undefined} data-next-occurrence={isNextOccurrence ? 'true' : undefined} onDragEnter={(event) => { event.preventDefault(); setTargetShiftId(shift.id) }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setTargetShiftId(null) }} onDrop={(event) => dropMember(event, shift)}>
      <header><span><CalendarDays size={15} /></span><div><b>{shift.title}</b><small>{whenLabel(shift.startsAt, shift.endsAt)}{shift.location ? ` · ${shift.location}` : ''}</small></div><em data-private={shift.visibility === 'private' ? 'true' : undefined}>{shift.visibility === 'private' ? 'Private' : 'Public'}</em></header>
      <div className={styles.shiftPlanningAssignments}>
        <div className={styles.shiftPlanningAssignmentGroup}><span><UserRoundCog size={13} /> Staff</span><div>{assignedStaffIds.length ? assignedStaffIds.map((userId) => {
          const person = staffById.get(userId)
          if (!person) return null
          return <div key={userId} data-kind="staff" data-pending={pendingKey === `staff:${shift.id}:${userId}` ? 'true' : undefined}><span>{initials(person.name)}</span><b>{person.name}</b><small>{person.roleLabel}</small><button type="button" disabled={isPending} aria-label={`Remove ${person.name} from ${shift.title}`} onClick={() => remove(shift, { kind: 'staff', userId })}><X size={12} /></button></div>
        }) : <p>No staff scheduled</p>}</div></div>
        <div className={styles.shiftPlanningAssignmentGroup}><span><UsersRound size={13} /> Volunteers</span><div>{assignedVolunteerIds.map((userId) => {
          const person = volunteersById.get(userId)
          if (!person) return null
          return <div key={userId} data-kind="volunteer" data-pending={pendingKey === `volunteer:${shift.id}:${userId}` ? 'true' : undefined}><span>{initials(person.name)}</span><b>{person.name}</b>{shift.visibility === 'private' ? <button type="button" disabled={isPending} aria-label={`Remove ${person.name} from ${shift.title}`} onClick={() => remove(shift, { kind: 'volunteer', userId })}><X size={12} /></button> : null}</div>
        })}{Array.from({ length: Math.min(spotsLeft, 3) }).map((_, index) => <span key={`${shift.id}-open-${index}`} className={styles.rosterSchedulerOpenSpot}><UserPlus size={13} /> Open slot</span>)}{spotsLeft > 3 ? <span className={styles.rosterSchedulerMoreSpots}>+{spotsLeft - 3} more</span> : null}</div></div>
      </div>
      <footer><span>{assignedVolunteerIds.length} of {shift.capacity} volunteer slots filled{assignedStaffIds.length ? ` · ${assignedStaffIds.length} staff` : ''}</span>{selectedCanBeAssigned ? <button type="button" disabled={isPending} onClick={() => selectedMember && assign(shift, selectedMember)}><UserPlus size={13} /> Add {selectedPerson?.name}</button> : selectedAlreadyAssigned ? <small>{selectedPerson?.name} is already scheduled</small> : <small>Drag a person here</small>}</footer>
    </article>
  }

  const renderPlannedRecurringShift = (plan: RecurringShiftPlan, startsAt: number, endsAt: number, isNextOccurrence = false) => {
    const key = recurringOccurrenceKey(plan.taskId, startsAt)
    const assignedVolunteerIds = plannedVolunteerAssignments[key] ?? []
    const assignedStaffIds = plannedStaffAssignments[key] ?? []
    const spotsLeft = Math.max(0, plan.capacity - assignedVolunteerIds.length)
    const selectedAlreadyAssigned = Boolean(selectedMember && (selectedMember.kind === 'staff' ? assignedStaffIds : assignedVolunteerIds).includes(selectedMember.userId))
    const selectedCanBeAssigned = Boolean(selectedMember && !selectedAlreadyAssigned)
    const isTarget = targetShiftId === `planned:${key}`
    return <article key={`planned-${plan.scheduleId}-${startsAt}`} className={styles.shiftPlanningPlannedInstance} data-drop-target={isTarget ? 'true' : undefined} data-full={spotsLeft === 0 ? 'true' : undefined} data-next-occurrence={isNextOccurrence ? 'true' : undefined} onDragEnter={(event) => { event.preventDefault(); setTargetShiftId(`planned:${key}`) }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setTargetShiftId(null) }} onDrop={(event) => dropPlannedMember(event, plan, startsAt)}>
      <header><span><Repeat2 size={15} /></span><div><b>{plan.title}</b><small>{whenLabel(startsAt, endsAt)}{plan.location ? ` · ${plan.location}` : ''}</small></div><em>Planned</em></header>
      <div className={styles.shiftPlanningAssignments}>
        <div className={styles.shiftPlanningAssignmentGroup}><span><UserRoundCog size={13} /> Staff</span><div>{assignedStaffIds.length ? assignedStaffIds.map((userId) => {
          const person = staffById.get(userId)
          if (!person) return null
          return <div key={userId} data-kind="staff" data-pending={pendingKey === `planned:staff:${startsAt}:${userId}` ? 'true' : undefined}><span>{initials(person.name)}</span><b>{person.name}</b><small>{person.roleLabel}</small><button type="button" disabled={isPending} aria-label={`Remove ${person.name} from this planned staff assignment`} onClick={() => removePlannedMember(plan, startsAt, { kind: 'staff', userId })}><X size={12} /></button></div>
        }) : <p>No staff scheduled</p>}</div></div>
        <div className={styles.shiftPlanningAssignmentGroup}><span><UsersRound size={13} /> Volunteers</span><div>{assignedVolunteerIds.map((userId) => {
          const person = volunteersById.get(userId)
          if (!person) return null
          return <div key={userId} data-kind="volunteer" data-pending={pendingKey === `planned:volunteer:${startsAt}:${userId}` ? 'true' : undefined}><span>{initials(person.name)}</span><b>{person.name}</b><button type="button" disabled={isPending} aria-label={`Remove ${person.name} from this planned occurrence`} onClick={() => removePlannedMember(plan, startsAt, { kind: 'volunteer', userId })}><X size={12} /></button></div>
        })}{Array.from({ length: Math.min(spotsLeft, 3) }).map((_, index) => <span key={`planned-${startsAt}-open-${index}`} className={styles.rosterSchedulerOpenSpot}><UserPlus size={13} /> Open slot</span>)}{spotsLeft > 3 ? <span className={styles.rosterSchedulerMoreSpots}>+{spotsLeft - 3} more</span> : null}</div></div>
      </div>
      <footer><span>{assignedVolunteerIds.length} of {plan.capacity} volunteers planned{assignedStaffIds.length ? ` · ${assignedStaffIds.length} staff` : ''}</span>{selectedCanBeAssigned ? <button type="button" disabled={isPending} onClick={() => selectedMember && assignPlannedMember(plan, startsAt, selectedMember)}><UserPlus size={13} /> Add {selectedPerson?.name}</button> : selectedAlreadyAssigned ? <small>{selectedPerson?.name} is already planned</small> : <small>Drag a person here</small>}</footer>
      <p>This occurrence will publish automatically after the prior shift ends. Staff support carries forward while organization access remains active; planned volunteers are notified only then.</p>
    </article>
  }

  return <>
  <section id="program-staffing" className={`${styles.programDetailSection} ${styles.programRosterSchedulingSection} ${styles.paletteTreatmentCard}`}>
    <div className={`${styles.programDetailHeading} ${styles.paletteTreatmentHeader}`}>
      <div><p className={styles.eyebrow}>Shift planning</p></div>
      <div className={`${styles.programDetailHeadingActions} ${styles.shiftPlanningCardActions}`}>
        {headerActions}
      </div>
    </div>
    <div className={`${styles.shiftPlanning} ${styles.paletteTreatmentBody}`}>
      <div className={styles.shiftPlanningBodyIntro}><h2>Plan the people and work ahead</h2><span className={styles.shiftPlanningHeadingContext}><b>{programName}</b><span>{dateRangeLabel(rangeStart, rangeEnd)}</span></span></div>
      <div className={styles.shiftPlanningToolbar}>
        <div className={styles.shiftPlanningRange}>
          <button type="button" aria-label="Previous planning period" onClick={() => setRangeStart((value) => value - rangeWeeks * 7 * DAY)}><ChevronLeft size={15} /></button>
          <label>Starts<input type="date" value={inputDate(rangeStart)} onChange={(event) => setRangeStart(mondayStart(parseInputDate(event.target.value)))} /></label>
          <label>Range<select value={rangeWeeks} onChange={(event) => setRangeWeeks(Number(event.target.value) as 1 | 2 | 4)}><option value={1}>1 week</option><option value={2}>2 weeks</option><option value={4}>4 weeks</option></select></label>
          <button type="button" aria-label="Next planning period" onClick={() => setRangeStart((value) => value + rangeWeeks * 7 * DAY)}><ChevronRight size={15} /></button>
        </div>
      </div>
    {notice ? <p className={styles.rosterSchedulerNotice} data-tone={notice.tone}>{notice.text}</p> : null}
    <div className={styles.rosterScheduler}>
      <aside className={styles.rosterSchedulerRoster} aria-label="Roster available to schedule">
          <div className={styles.rosterSchedulerColumnHeading}><span><UsersRound size={16} /></span><div><b>Roster</b><small>Staff and volunteers stay separate</small></div></div>
          <label className={styles.rosterSchedulerSearch}><Search size={14} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people" /></label>
          <div className={styles.shiftPlanningPeopleList}>
            <section><div><UserRoundCog size={13} /><b>Organization staff</b><small>{staff.length} delegated</small></div>{filteredStaff.length ? filteredStaff.map((person) => {
              const member: PlanningMember = { kind: 'staff', userId: person.userId }
              const selected = selectedMember?.kind === member.kind && selectedMember.userId === member.userId
              return <button type="button" key={person.userId} draggable={!isPending} aria-pressed={selected} data-selected={selected ? 'true' : undefined} data-kind="staff" onClick={() => setMember(member)} onDragStart={(event) => startDrag(event, member)} onDragEnd={() => { setDragMember(null); setTargetShiftId(null) }}><GripVertical size={13} /><span>{selected ? <Check size={13} /> : initials(person.name)}</span><div><b>{person.name}</b><small>{person.roleLabel}</small></div></button>
            }) : <p>No staff match this search.</p>}</section>
            <section><div><UsersRound size={13} /><b>Volunteer roster</b><small>{volunteers.length} people</small></div>{filteredVolunteers.length ? filteredVolunteers.map((person) => {
              const member: PlanningMember = { kind: 'volunteer', userId: person.userId }
              const selected = selectedMember?.kind === member.kind && selectedMember.userId === member.userId
              return <button type="button" key={person.userId} draggable={!isPending} aria-pressed={selected} data-selected={selected ? 'true' : undefined} data-kind="volunteer" onClick={() => setMember(member)} onDragStart={(event) => startDrag(event, member)} onDragEnd={() => { setDragMember(null); setTargetShiftId(null) }}><GripVertical size={13} /><span>{selected ? <Check size={13} /> : initials(person.name)}</span><div><b>{person.name}</b><small>{person.roleTitles.length ? person.roleTitles.join(' · ') : statusLabel(person.status)}</small></div></button>
            }) : <p>No volunteers match this search.</p>}</section>
          </div>
      </aside>
      <section className={styles.rosterSchedulerBoard} aria-label="Scheduled shifts for planning">
        <div className={styles.rosterSchedulerColumnHeading}>
          <span><CalendarDays size={16} /></span>
          <div>
            <b>Published opportunities</b>
            <small>{selectedPerson ? `Choose a shift for ${selectedPerson.name}` : 'Select or drag a person into a published shift'}</small>
          </div>
          <button type="button" className={styles.shiftPlanningScheduleExport} onClick={openPrintView}><Printer size={14} /> Save/Print Schedule</button>
        </div>
        <div className={styles.shiftPlanningBoard}>
          {shiftsInRange.length
            ? Array.from(shiftsByDay.entries()).sort(([a], [b]) => a - b).map(([date, dayShifts]) => <section key={date} className={styles.shiftPlanningDay}><header><b>{dayLabel(date)}</b><span>{dayShifts.length} shift{dayShifts.length === 1 ? '' : 's'}</span></header>{dayShifts.map((shift) => renderShift(shift))}</section>)
            : <div className={styles.rosterSchedulerEmpty}><CalendarDays size={20} /><div><b>No scheduled shifts in this planning range.</b><p>Schedule a shift, then return here to plan the people supporting it.</p></div></div>}
        </div>
      </section>
    </div>
    </div>
  </section>
  {capacityOverride && typeof document !== 'undefined' ? createPortal(<div className={`${styles.issuerCalendarModalBackdrop} ${styles.shiftPlanningCapacityOverrideBackdrop}`} role="presentation" onMouseDown={() => setCapacityOverride(null)}>
    <section className={`${styles.issuerCalendarModal} ${styles.shiftPlanningCapacityOverrideModal}`} role="dialog" aria-modal="true" aria-labelledby="shift-capacity-override" onMouseDown={(event) => event.stopPropagation()}>
      <div className={styles.issuerCalendarModalHeading}>
        <div><p className={styles.eyebrow}>Volunteer capacity</p><h2 id="shift-capacity-override">Add one more volunteer?</h2><p>{volunteersById.get(capacityOverride.member.userId)?.name} would be volunteer {capacityOverride.assignedVolunteerCount + 1} on a shift set for {capacityOverride.kind === 'published' ? capacityOverride.shift.capacity : capacityOverride.plan.capacity}.</p></div>
        <button type="button" aria-label="Close capacity warning" onClick={() => setCapacityOverride(null)}><X size={18} /></button>
      </div>
      <div className={styles.shiftPlanningCapacityOverrideBody}>
        <p>This is an intentional exception to the template’s normal volunteer limit. {capacityOverride.kind === 'planned' ? 'The volunteer will not be notified until the shift publishes.' : 'The volunteer will be added to this published shift.'}</p>
        <span>{capacityOverride.kind === 'published' ? `${capacityOverride.shift.title} · ${whenLabel(capacityOverride.shift.startsAt, capacityOverride.shift.endsAt)}` : `${capacityOverride.plan.title} · ${whenLabel(capacityOverride.startsAt, capacityOverride.startsAt + capacityOverride.plan.durationMinutes * 60_000)}`}</span>
      </div>
      <div className={styles.issuerCalendarFormActions}><button type="button" onClick={() => setCapacityOverride(null)}>Cancel</button><button type="button" onClick={confirmCapacityOverride}><UserPlus size={15} /> Add anyway</button></div>
    </section>
  </div>, document.body) : null}
  </>
}
