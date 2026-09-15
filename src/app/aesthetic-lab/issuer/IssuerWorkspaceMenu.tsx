'use client'

import { FolderKanban, FolderOpen, Megaphone } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import workspaceStyles from './ProgramWorkspace.module.css'
import styles from '../prototype.module.css'

const sections = [
  { id: 'documents', label: 'Document Library', icon: FolderOpen },
  { id: 'programs', label: 'Volunteer Programs', icon: FolderKanban },
  { id: 'opportunities', label: 'Published Opportunities', icon: Megaphone },
] as const

type WorkspaceSection = (typeof sections)[number]['id']

function isWorkspaceSection(value: string | undefined): value is WorkspaceSection {
  return sections.some((section) => section.id === value)
}

export function IssuerWorkspaceMenu({
  initialSection = 'documents',
  documents,
  programs,
  opportunities,
}: {
  initialSection?: string
  documents: ReactNode
  programs: ReactNode
  opportunities: ReactNode
}) {
  const [active, setActive] = useState<WorkspaceSection>(isWorkspaceSection(initialSection) ? initialSection : 'documents')
  const nav = useRef<HTMLDivElement>(null)

  function select(id: WorkspaceSection) {
    setActive(id)
    const url = new URL(window.location.href)
    url.searchParams.set('workspace', id)
    url.hash = ''
    window.history.replaceState({}, '', url)
  }

  useEffect(() => {
    if (isWorkspaceSection(initialSection)) setActive(initialSection)
  }, [initialSection])

  useEffect(() => {
    function sync() {
      const section = new URLSearchParams(window.location.search).get('workspace') ?? undefined
      setActive(isWorkspaceSection(section) ? section : 'documents')
    }

    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  const panels: Record<WorkspaceSection, ReactNode> = { documents, programs, opportunities }

  return <div className={workspaceStyles.workspace}>
    <div ref={nav} className={workspaceStyles.tabs} role="tablist" aria-label="Organization workspace">
      {sections.map((section, index) => {
        const Icon = section.icon
        return <button
          key={section.id}
          id={`organization-workspace-tab-${section.id}`}
          type="button"
          role="tab"
          aria-selected={active === section.id}
          aria-controls={`organization-workspace-panel-${section.id}`}
          tabIndex={active === section.id ? 0 : -1}
          onClick={() => select(section.id)}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
            event.preventDefault()
            const offset = event.key === 'ArrowRight' ? 1 : sections.length - 1
            const next = sections[(index + offset) % sections.length]
            select(next.id)
            nav.current?.querySelector<HTMLButtonElement>(`#organization-workspace-tab-${next.id}`)?.focus()
          }}
        >
          <Icon size={15} /> {section.label}
        </button>
      })}
    </div>
    <div
      key={active}
      id={`organization-workspace-panel-${active}`}
      role="tabpanel"
      aria-labelledby={`organization-workspace-tab-${active}`}
      className={`${workspaceStyles.panel} ${styles.organizationWorkspacePanel}`}
    >
      {panels[active]}
    </div>
  </div>
}
