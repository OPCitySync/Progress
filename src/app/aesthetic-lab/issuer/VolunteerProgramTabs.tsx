import Link from 'next/link'
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  FileText,
  FolderKanban,
  LayoutList,
  Repeat2,
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
  onboarding: ProgramResource[]
  documents: ProgramResource[]
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
  icon: typeof FileText
}

function statusFor(program: VolunteerProgramTab) {
  if (program.upcomingEvents > 0) return { label: 'Active', tone: 'active' }
  if (program.opportunityTemplates.length > 0) return { label: 'Ready to schedule', tone: 'ready' }
  return { label: 'Building', tone: 'building' }
}

function readinessSteps(program: VolunteerProgramTab): ReadinessStep[] {
  return [
    {
      label: 'Program resources',
      detail: program.documents.length ? `${program.documents.length} document${program.documents.length === 1 ? '' : 's'} ready` : 'Add guides, waivers, or operating documents',
      complete: program.documents.length > 0,
      href: '/aesthetic-lab/issuer/catalog?workspace=documentation',
      icon: FileText,
    },
    {
      label: 'Volunteer welcome',
      detail: program.onboarding.length ? `${program.onboarding.length} onboarding pathway${program.onboarding.length === 1 ? '' : 's'}` : 'Onboarding is optional for this program',
      complete: program.onboarding.length > 0,
      href: '/aesthetic-lab/issuer/catalog?workspace=onboarding',
      icon: Repeat2,
    },
    {
      label: 'Repeatable work',
      detail: program.opportunityTemplates.length ? `${program.opportunityTemplates.length} opportunity template${program.opportunityTemplates.length === 1 ? '' : 's'}` : 'Create the first opportunity template',
      complete: program.opportunityTemplates.length > 0,
      href: '/aesthetic-lab/issuer/catalog?workspace=opportunities',
      icon: UsersRound,
    },
    {
      label: 'Published schedule',
      detail: program.upcomingEvents ? `${program.upcomingEvents} upcoming shift${program.upcomingEvents === 1 ? '' : 's'}` : 'Publish a shift when the work is ready',
      complete: program.upcomingEvents > 0,
      href: '/aesthetic-lab/issuer/catalog?workspace=opportunities',
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
            <Link className={styles.catalogWorkspaceAction} href={program.detailHref}>{program.id === 'organization' ? 'Open Area' : 'Program Details'}</Link>
          </header>

          <div className={styles.volunteerProgramControlGrid}>
            <section className={styles.volunteerProgramReadiness}>
              <div className={styles.volunteerProgramSectionHeading}>
                <div><p className={styles.eyebrow}>Program capabilities</p><h3>Configure only what this program needs</h3></div>
                <span>{completedSteps} configured</span>
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
                <div><b>No upcoming work published</b><p>Your templates stay ready until your team publishes the next shift.</p></div>
              </div>}
              <div className={styles.volunteerProgramOperationsMetrics}>
                <span><b>{program.upcomingEvents}</b>Upcoming</span>
                <span><b>{program.completedEvents}</b>Completed</span>
                <span><b>{program.opportunityTemplates.length}</b>Templates</span>
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
