import Link from 'next/link'
import {notFound} from 'next/navigation'
import {and,eq} from 'drizzle-orm'
import {db} from '@/lib/db/client'
import {orgs,volunteerPrograms} from '@/lib/db/schema'
import {getSession} from '@/lib/auth/session'
import {validateActiveSession,isActiveOrganizationStaff} from '@/lib/services/identity-access'
import {candidateReadiness,onboardingMaterials} from '@/lib/services/program-workspace'
import {DialogForm,WorkspaceDialog,WorkspaceForm} from '../../../issuer/ProgramWorkspace'
import {HistoryBackButton} from '../../../HistoryBackButton'
import styles from '../../../issuer/ProgramWorkspace.module.css'
export const dynamic='force-dynamic'
export default async function Welcome({params}:{params:{orgId:string;scope:string}}){
  const org=(await db.select().from(orgs).where(and(eq(orgs.id,params.orgId),eq(orgs.status,'approved'))).limit(1))[0]
  if(!org)notFound()
  const program=params.scope==='organization'?null:(await db.select().from(volunteerPrograms).where(and(eq(volunteerPrograms.id,params.scope),eq(volunteerPrograms.orgId,org.id))).limit(1))[0]
  if(params.scope!=='organization'&&!program)notFound()
  const raw=await getSession(),session=raw?await validateActiveSession(raw):null
  const participant=session?.role==='participant',preview=session?.role==='issuer'&&session.orgId===org.id
  const materials=await onboardingMaterials(org.id,params.scope),policy=materials.policy
  if(!policy||policy.onboardingMode==='none')return <main className={styles.standalone}><section className={styles.card}><h1>{org.name}</h1><p>This welcome is not currently active.</p><Link href="/aesthetic-lab/opportunities">Explore opportunities</Link></section></main>
  const readiness=participant?await candidateReadiness(org.id,params.scope,session.sub):null
  const staff=participant?await isActiveOrganizationStaff(org.id,session.sub):false
  const path='/aesthetic-lab/onboarding/'+org.id+'/'+params.scope
  const props={scope:params.scope,orgId:org.id,participant:true as const}
  return <main className={styles.standalone}>
    <section className={styles.info}><p className={styles.eyebrow}>{org.name}{program?' · '+program.name:''}</p><h1>{policy.headline||'A place for your time and talents.'}</h1><p>{policy.welcome||'Get to know our work, prepare for your first experience, and let our team welcome you personally.'}</p><p className={styles.hint}>Prepare your checklist → Request review → Receive a personal welcome</p>
      {preview?<p className={styles.hint}>Volunteer preview. Checklist controls appear when using a Civic Participant account.</p>:!session?<div className={styles.actions}><Link className={styles.button} href={'/signup?type=participant&next='+encodeURIComponent(path)}>Create an account to begin</Link><Link className={styles.button} href={'/login?next='+encodeURIComponent(path)}>Sign in</Link></div>:staff?<p>Your staff role takes priority here. You cannot join your own organization as a volunteer.</p>:participant&&!readiness?.application?<WorkspaceForm {...props} operation="start" submitLabel="Begin my welcome"/>:null}
    </section>
    {readiness?.application||preview?<>
      <section className={styles.card}><header className={styles.heading}><div><p className={styles.eyebrow}>Your checklist</p><h2>A little preparation goes a long way.</h2></div></header>
        {materials.waivers.map(w=>{
          const complete=readiness?.waiverItems.find(item=>item.id===w.id)?.complete
          return <article className={styles.row} key={w.id}><div><b>{complete?'✓ ':''}{w.title}</b><small>{complete?'Received':policy.waiverMethod==='paper'?'Provide a signed paper copy to the organization':'Read and sign your waiver'}</small></div><WorkspaceDialog label={complete?'View waiver':'Review waiver'} title={w.title} icon={false}>
            {w.body?<div className={styles.documentBody}>{w.body}</div>:null}
            {w.documentUrl?<p><a className={styles.button} target="_blank" rel="noreferrer" href={'/api/organization-files/waiver/'+w.id+'?scope='+params.scope+'&download=1'}>Download {w.documentName||'waiver'}</a></p>:null}
            {participant&&!staff&&!complete&&policy.waiverMethod!=='paper'?<DialogForm {...props} operation="sign" submitLabel="Sign waiver"><input type="hidden" name="waiverId" value={w.id}/><label>Your full legal name<input name="signerName" autoComplete="name" required minLength={2}/></label><label className={styles.check}><input type="checkbox" name="consent" required/>I read this waiver and agree to sign it electronically using the name above.</label></DialogForm>:null}
            {policy.waiverMethod!=='digital'?<p className={styles.hint}>You may give the organization a signed paper copy. A staff member will confirm receipt.</p>:null}
          </WorkspaceDialog></article>
        })}
        {materials.documents.map(d=><article className={styles.row} key={d.id}><div><b>{readiness?.documentItems.find(item=>item.id===d.id)?.complete?'✓ ':''}{d.title}</b><small>Review before joining</small></div><WorkspaceDialog label="Review document" title={d.title} icon={false}>
          {d.body?<div className={styles.documentBody}>{d.body}</div>:null}{d.documentUrl?<p><a className={styles.button} target="_blank" rel="noreferrer" href={'/api/organization-files/document/'+d.id+'?scope='+params.scope+'&download=1'}>Download {d.documentName||'document'}</a></p>:null}
          {participant&&!staff?<DialogForm {...props} operation="receipt" submitLabel="Confirm receipt"><input type="hidden" name="documentId" value={d.id}/><label className={styles.check}><input type="checkbox" name="received" required/>I received and reviewed this document.</label></DialogForm>:null}
        </WorkspaceDialog></article>)}
        {policy.requireSession?<div className={styles.row}><div><b>{readiness?.sessionComplete?'✓ ':''}Attend an onboarding session</b><small>{readiness?.sessionComplete?'Your attendance has been verified.':'Choose a session below. The organization will verify attendance.'}</small></div></div>:null}
        {!materials.waivers.length&&!materials.documents.length&&!policy.requireSession?<p className={styles.hint}>No forms or orientation are required. Send your profile to the team for a personal review.</p>:null}
      </section>
      {materials.sessions.length?<section className={styles.card}><p className={styles.eyebrow}>Meet the team</p><h2>Onboarding sessions</h2>{materials.sessions.map(t=><article className={styles.row} key={t.id}><div><b>{t.title}</b><small>{t.location}</small></div><Link className={styles.button} href={'/aesthetic-lab/opportunities/'+t.id}>Choose a session</Link></article>)}</section>:policy.requireSession?<section className={styles.card}><p>The organization will publish an onboarding date here. Your other checklist progress is saved.</p></section>:null}
      {participant&&!staff?<section className={styles.card}><p className={styles.eyebrow}>A personal welcome</p>{readiness?.application?.status==='approved'?<><h2>Welcome to the team.</h2><p>Your profile has been reviewed and you are on the organization’s volunteer roster.</p><Link className={styles.button} href="/aesthetic-lab/opportunities?tab=organizations">Find your next opportunity</Link></>:readiness?.application?.status==='submitted'?<><h2>Your checklist is with the team.</h2><p>You will receive a notification when they review your profile.</p></>:<><h2>Ready to introduce yourself?</h2>{readiness?.application?.status==='declined'?<p>Your previous application was not approved. Contact the organization before requesting another review.</p>:null}<p className={styles.hint}>The organization reviews your profile and checklist before adding you to its roster.</p><WorkspaceForm {...props} operation="submit" submitLabel="Request my review" disabled={!readiness?.complete}/>{!readiness?.complete?<p className={styles.hint}>Complete the remaining requirements above to request review.</p>:null}</>}</section>:null}
    </>:null}
    <HistoryBackButton fallback={preview?'/aesthetic-lab/issuer/programs/'+params.scope+'?section=onboarding':'/aesthetic-lab/opportunities'}/>
  </main>
}
