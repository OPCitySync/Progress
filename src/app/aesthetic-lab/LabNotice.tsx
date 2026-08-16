import { CheckCircle2, CircleAlert } from 'lucide-react'
import styles from './prototype.module.css'

export function LabNotice({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null
  return <p className={`${styles.labNotice} ${error ? styles.labNoticeError : styles.labNoticeSuccess}`}>
    {error ? <CircleAlert size={16} /> : <CheckCircle2 size={16} />} {error ?? ok}
  </p>
}
