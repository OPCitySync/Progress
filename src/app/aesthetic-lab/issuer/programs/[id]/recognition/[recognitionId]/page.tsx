import Link from 'next/link'
import {notFound} from 'next/navigation'
import {and,eq} from 'drizzle-orm'
import {requireRole} from '@/lib/auth/session'
import {db} from '@/lib/db/client'
import {orgs,programRecognitions,shifts,tasks,users} from '@/lib/db/schema'
import {PrintButton} from '../../../../ProgramWorkspace'
import styles from '../../../../ProgramWorkspace.module.css'
export const dynamic='force-dynamic'
export default async function AppreciationLetter({params}:{params:{id:string;recognitionId:string}}){
  const session=await requireRole('issuer')
  const row=(await db.select({letter:programRecognitions,org:orgs,shift:shifts,task:tasks,author:users}).from(programRecognitions).innerJoin(orgs,eq(programRecognitions.orgId,orgs.id)).innerJoin(shifts,eq(programRecognitions.shiftId,shifts.id)).innerJoin(tasks,eq(shifts.taskId,tasks.id)).leftJoin(users,eq(programRecognitions.actorId,users.id)).where(and(eq(programRecognitions.id,params.recognitionId),eq(programRecognitions.orgId,session.orgId!),eq(programRecognitions.scope,params.id),eq(programRecognitions.kind,'letter'))).limit(1))[0]
  if(!row)notFound()
  return <main className={styles.letter}><div className={styles.actions}><Link className={styles.button} href={'/aesthetic-lab/issuer/programs/'+params.id+'?section=recognition'}>← Program</Link><PrintButton/></div><p className={styles.eyebrow}>{row.org.name}</p><h1>With our appreciation</h1><p>To {row.letter.recipientNames},</p><p>{row.letter.message}</p><p><b>{row.task.title}</b><br/>{row.shift.startsAt?new Date(row.shift.startsAt).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}):'Verified participation'}</p><footer><p>{row.author?.name||'Your organization team'}<br/>{row.org.name}</p><p>Signature ______________________________</p></footer></main>
}
