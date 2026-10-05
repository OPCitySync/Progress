'use client'

import { UserRoundCog, UsersRound } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import styles from './ProgramWorkspace.module.css'

const sections = [
  { id: 'volunteers', label: 'Volunteers', icon: UsersRound },
  { id: 'staff', label: 'Organizational Staff', icon: UserRoundCog },
] as const

type VolunteerWorkspaceSection = (typeof sections)[number]['id']

function isVolunteerWorkspaceSection(value: string | undefined): value is VolunteerWorkspaceSection {
  return sections.some((section) => section.id === value)
}

export function VolunteerWorkspaceMenu({
  initialSection = 'volunteers',
  volunteers,
  staff,
}: {
  initialSection?: string
  volunteers: ReactNode
  staff: ReactNode
}) {
  const [active, setActive] = useState<VolunteerWorkspaceSection>(isVolunteerWorkspaceSection(initialSection) ? initialSection : 'volunteers')
  const nav = useRef<HTMLDivElement>(null)

  function select(id: VolunteerWorkspaceSection) {
    setActive(id)
    const url = new URL(window.location.href)
    url.searchParams.set('view', id)
    url.searchParams.delete('q')
    url.hash = ''
    window.history.replaceState({}, '', url)
  }

  useEffect(() => {
    if (isVolunteerWorkspaceSection(initialSection)) setActive(initialSection)
  }, [initialSection])

  useEffect(() => {
    function sync() {
      const section = new URLSearchParams(window.location.search).get('view') ?? undefined
      setActive(isVolunteerWorkspaceSection(section) ? section : 'volunteers')
    }

    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  const panels: Record<VolunteerWorkspaceSection, ReactNode> = { volunteers, staff }

  return <div className={styles.workspace}>
    <div ref={nav} className={styles.tabs} role="tablist" aria-label="Volunteer workspace">
      {sections.map((section, index) => {
        const Icon = section.icon
        return <button
          key={section.id}
          id={`volunteer-workspace-tab-${section.id}`}
          type="button"
          role="tab"
          aria-selected={active === section.id}
          aria-controls={`volunteer-workspace-panel-${section.id}`}
          tabIndex={active === section.id ? 0 : -1}
          onClick={() => select(section.id)}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
            event.preventDefault()
            const offset = event.key === 'ArrowRight' ? 1 : sections.length - 1
            const next = sections[(index + offset) % sections.length]
            select(next.id)
            nav.current?.querySelector<HTMLButtonElement>(`#volunteer-workspace-tab-${next.id}`)?.focus()
          }}
        >
          <Icon size={15} /> {section.label}
        </button>
      })}
    </div>
    <div
      key={active}
      id={`volunteer-workspace-panel-${active}`}
      role="tabpanel"
      aria-labelledby={`volunteer-workspace-tab-${active}`}
      className={styles.panel}
    >
      {panels[active]}
    </div>
  </div>
}
