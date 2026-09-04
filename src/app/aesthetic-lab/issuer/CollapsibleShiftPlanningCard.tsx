'use client'

import { ChevronDown, ChevronUp } from 'lucide-react'
import { type ReactNode, useId, useState } from 'react'
import styles from '../prototype.module.css'

/** Keeps the high-value Shift Planning surface available without making it dominate the program page. */
export function CollapsibleShiftPlanningCard({
  actions,
  children,
}: {
  actions: ReactNode
  children: ReactNode
}) {
  const [isExpanded, setIsExpanded] = useState(true)
  const contentId = useId()

  return <section
    id="program-staffing"
    className={`${styles.programDetailSection} ${styles.programRosterSchedulingSection}`}
    data-collapsed={isExpanded ? undefined : 'true'}
  >
    <div className={styles.programDetailHeading}>
      <div><p className={styles.eyebrow}>Shift planning</p><h2>Plan the people and work ahead</h2></div>
      <div className={`${styles.programDetailHeadingActions} ${styles.shiftPlanningCardActions}`}>
        {isExpanded ? actions : null}
        <button
          type="button"
          className={`${styles.catalogWorkspaceAction} ${styles.opportunityWorkspaceButton} ${styles.shiftPlanningCollapseButton}`}
          aria-controls={contentId}
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((value) => !value)}
        >
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {isExpanded ? 'Close' : 'Open'}
        </button>
      </div>
    </div>
    <div id={contentId} className={styles.shiftPlanningCardContent} hidden={!isExpanded}>
      {children}
    </div>
  </section>
}
