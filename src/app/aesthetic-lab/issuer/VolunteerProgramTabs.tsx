import Link from 'next/link'
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  FolderKanban,
  LayoutList,
  UsersRound,
} from 'lucide-react'
import { VolunteerProgramCreateButton } from './VolunteerProgramCreateButton'
import styles from '../prototype.module.css'

type ProgramResource = {
  id: string
  title: string
  href: string
}

type ProgramHistoryItem = {
  id: string
  title: string
  dateLabel: string
}

type ProgramNextEvent = {
  id: string
  title: string
  dateLabel: string
  href: string
}

export type VolunteerProgramTab = {
  id: string
  name: string
  description: string
  detailHref: string
  opportunityTemplates: ProgramResource[]
  history: ProgramHistoryItem[]
  upcomingEvents: number
  completedEvents: number
  nextEvent: ProgramNextEvent | null
}

type ReadinessStep = {
  label: string
  detail: string
  complete: boolean
  href: string
  icon: typeof UsersRound
}

function statusFor(program: VolunteerProgramTab) {
  if (program.upcomingEvents > 0) return { label: 'Active', tone: 'active' }
  if (program.opportunityTemplates.length > 0) return { label: 'Ready to schedule', tone: 'ready' }
  return { label: 'Building', tone: 'building' }
}

function readinessSteps(program: VolunteerProgramTab): ReadinessStep[] {
  return [
    {
      label: 'Volunteer Roles',
      detail: program.opportunityTemplates.length ? `${program.opportunityTemplates.length} volunteer role${program.opportunityTemplates.length === 1 ? '' : 's'}` : 'Create the first role to define the work your team needs',
      complete: program.opportunityTemplates.length > 0,
      href: `${program.detailHref}?section=positions`,
      icon: UsersRound,
    },
    {
      label: 'Shift Planning',
      detail: program.upcomingEvents ? `${program.upcomingEvents} upcoming shift${program.upcomingEvents === 1 ? '' : 's'}` : 'Schedule a shift when the work is ready',
      complete: program.upcomingEvents > 0,
      href: `${program.detailHref}?section=scheduling`,
      icon: CalendarDays,
    },
  ]
}

export function VolunteerProgramTabs({ tabs }: { tabs: VolunteerProgramTab[] }) {
  return <>
    <section className={styles.volunteerProgramsOverview}>
      <div>
        <p className={styles.eyebrow}>Workspace structure</p>
        <h2>Program Areas</h2>
        <p>Keep each area of your mission ready to welcome people, publish work, and retain its history.</p>
      </div>
      <VolunteerProgramCreateButton />
    </section>

    <div className={styles.volunteerProgramGrid}>
      {tabs.map((program) => {
        const status = statusFor(program)
        const steps = readinessSteps(program)
        const completedSteps = steps.filter((step) => step.complete).length

        return <section key={program.id} className={styles.volunteerProgramCard}>
          <header className={styles.volunteerProgramHeading}>
            <span>{program.id === 'organization' ? <LayoutList size={18} /> : <FolderKanban size={18} />}</span>
            <div>
              <div className={styles.volunteerProgramTitleLine}>
                <p className={styles.eyebrow}>{program.id === 'organization' ? 'Shared organization resources' : 'Program area'}</p>
                <em data-tone={status.tone}>{status.label}</em>
              </div>
              <h2>{program.name}</h2>
              <p>{program.description}</p>
            </div>
            <Link className={styles.catalogWorkspaceAction} href={program.detailHref}>Program Details</Link>
          </header>

          <div className={styles.volunteerProgramControlGrid}>
            <section className={styles.volunteerProgramReadiness}>
              <div className={styles.volunteerProgramSectionHeading}>
                <div><p className={styles.eyebrow}>Program workspace</p><h3>Build on what your team can do</h3></div>
              </div>
              <div className={styles.volunteerProgramChecklist}>
                {steps.map((step) => {
                  const Icon = step.icon
                  return <Link key={step.label} href={step.href} data-complete={step.complete}>
                    <Icon size={15} />
                    <span><b>{step.label}</b><small>{step.detail}</small></span>
                    {step.complete ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                  </Link>
                })}
              </div>
            </section>

            <section className={styles.volunteerProgramOperations}>
              <div className={styles.volunteerProgramSectionHeading}>
                <div><p className={styles.eyebrow}>Current operations</p><h3>{program.nextEvent ? 'Next scheduled work' : 'Ready for what comes next'}</h3></div>
              </div>
              {program.nextEvent ? <Link className={styles.volunteerProgramNextEvent} href={program.nextEvent.href}>
                <CalendarDays size={18} />
                <span><b>{program.nextEvent.title}</b><small>{program.nextEvent.dateLabel}</small></span>
                <em>Open</em>
              </Link> : <div className={styles.volunteerProgramNoEvent}>
                <CalendarDays size={18} />
                <div><b>No upcoming work scheduled</b><p>{program.opportunityTemplates.length ? 'Your volunteer roles are ready whenever your team schedules the next date.' : 'Create a volunteer role first, then schedule the shifts it needs.'}</p></div>
              </div>}
              <div className={styles.volunteerProgramOperationsMetrics}>
                <span><b>{program.upcomingEvents}</b>Upcoming</span>
                <span><b>{program.completedEvents}</b>Completed</span>
                <span><b>{program.opportunityTemplates.length}</b>Positions</span>
              </div>
              {program.history.length ? <div className={styles.volunteerProgramRecentHistory}>
                <p className={styles.eyebrow}>Recent history</p>
                {program.history.slice(0, 2).map((item) => <div key={item.id}><span>{item.title}</span><small>{item.dateLabel}</small></div>)}
              </div> : null}
            </section>
          </div>
        </section>
      })}
    </div>
  </>
}
