'use client'

import { type ReactNode, useState } from 'react'
import { FileText, FolderKanban, Repeat2, UsersRound } from 'lucide-react'
import styles from '../prototype.module.css'

type WorkspaceSection = 'programs' | 'documentation' | 'onboarding' | 'opportunities'

const sections: Array<{ id: WorkspaceSection; label: string; icon: typeof FileText }> = [
  { id: 'programs', label: 'Volunteer Programs', icon: FolderKanban },
  { id: 'documentation', label: 'Documentation', icon: FileText },
  { id: 'onboarding', label: 'Onboarding', icon: Repeat2 },
  { id: 'opportunities', label: 'Opportunities', icon: UsersRound },
]

export function IssuerWorkspaceMenu({
  programs,
  documentation,
  onboarding,
  opportunities,
  initialSection = 'documentation',
}: {
  programs: ReactNode
  documentation: ReactNode
  onboarding: ReactNode
  opportunities: ReactNode
  initialSection?: WorkspaceSection
}) {
  const [activeSection, setActiveSection] = useState<WorkspaceSection>(initialSection)
  const panels: Record<WorkspaceSection, ReactNode> = { programs, documentation, onboarding, opportunities }

  return (
    <section className={styles.workspaceSectionShell} aria-label="Workspace sections">
      <div className={styles.workspaceSectionNav} role="tablist" aria-label="Workspace navigation">
        {sections.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeSection === id}
            aria-controls={`workspace-${id}`}
            data-active={activeSection === id}
            onClick={() => setActiveSection(id)}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>
      {sections.map(({ id }) => (
        <div key={id} id={`workspace-${id}`} role="tabpanel" hidden={activeSection !== id}>
          {panels[id]}
        </div>
      ))}
    </section>
  )
}
