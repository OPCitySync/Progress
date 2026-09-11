'use client'

import { type ReactNode, useState } from 'react'
import { FileText, FolderKanban } from 'lucide-react'
import styles from '../prototype.module.css'

type WorkspaceSection = 'programs' | 'documentation'

const sections = [
  { id: 'programs' as const, label: 'Volunteer Programs', icon: FolderKanban },
  { id: 'documentation' as const, label: 'Documentation', icon: FileText },
]

export function IssuerWorkspaceMenu({ programs, documentation, initialSection = 'programs' }: { programs: ReactNode; documentation: ReactNode; initialSection?: WorkspaceSection }) {
  const [activeSection,setActiveSection]=useState<WorkspaceSection>(initialSection)
  const activeLabel=sections.find(section=>section.id===activeSection)?.label??'Workspace'
  return <>
    <section className={styles.issuerPageHero}><div><p className={styles.eyebrow}>{activeLabel}</p></div></section>
    <section className={styles.workspaceSectionShell} aria-label="Workspace sections">
      <div className={styles.workspaceSectionNav} role="tablist" aria-label="Workspace navigation">
        {sections.map(({id,label,icon:Icon})=><button key={id} type="button" role="tab" aria-selected={activeSection===id} aria-controls={`workspace-${id}`} data-active={activeSection===id} onClick={()=>setActiveSection(id)}><Icon size={15}/>{label}</button>)}
      </div>
      <div id="workspace-programs" role="tabpanel" hidden={activeSection!=='programs'}>{programs}</div>
      <div id="workspace-documentation" role="tabpanel" hidden={activeSection!=='documentation'}>{documentation}</div>
    </section>
  </>
}
