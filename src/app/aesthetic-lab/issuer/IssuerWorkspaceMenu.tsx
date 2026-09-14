import { type ReactNode } from 'react'
import styles from '../prototype.module.css'

export function IssuerWorkspaceMenu({ programs }: { programs: ReactNode }) {
  return <section className={styles.workspaceSectionShell} aria-label="Volunteer Programs">
    <div>{programs}</div>
  </section>
}
