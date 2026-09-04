'use client'

import { Printer } from 'lucide-react'
import styles from '../../../../prototype.module.css'

export function PrintScheduleControls() {
  return <button type="button" className={styles.printScheduleButton} onClick={() => window.print()}><Printer size={15} /> Print / Save PDF</button>
}
