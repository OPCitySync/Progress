'use client'

import { type ReactNode } from 'react'
import styles from '../prototype.module.css'

/** The Workspace is now a program directory. Operational work happens in the
 * relevant Program Details page, avoiding a second set of competing tabs. */
export function IssuerWorkspaceMenu({ programs }: { programs: ReactNode }) {
  return <>
    <section className={styles.issuerPageHero}>
      <div><p className={styles.eyebrow}>Volunteer Programs</p></div>
    </section>
    <section className={styles.workspaceSectionShell} aria-label="Volunteer Programs">
      {programs}
    </section>
  </>
}
