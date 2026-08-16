import { Bookmark } from 'lucide-react'
import { toggleSavedItemAction } from '@/app/actions'
import styles from './prototype.module.css'

export function SaveTaskButton({ taskId, saved, redirectTo }: { taskId: string; saved: boolean; redirectTo: string }) {
  return <form action={toggleSavedItemAction}><input type="hidden" name="kind" value="task" /><input type="hidden" name="itemId" value={taskId} /><input type="hidden" name="redirectTo" value={redirectTo} /><button className={`${styles.labButton} ${saved ? '' : styles.labButtonSecondary}`} type="submit"><Bookmark size={15} fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Saved' : 'Save'}</button></form>
}
