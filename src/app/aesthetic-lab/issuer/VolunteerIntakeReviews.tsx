'use client'
import Link from 'next/link'
import {useState} from 'react'
import {CheckCircle2,FileText} from 'lucide-react'
import type {IntakeQuestion} from '@/lib/services/volunteer-intake'
import {IntakeModal,IntakeError,ProgramAssignment,useIntakeSave,type IntakeProgram} from './VolunteerIntakeControls'
import s from './VolunteerIntake.module.css'

export type ApplicationFile={id:string;name:string;href:string;detail?:string}
export type ApplicationReviewData={id:string;userId:string;name:string;title:string;status:string;introduction:string;questions:IntakeQuestion[];answers:Record<string,string>;internalNote:string;isOnboarding:boolean;organizationName?:string;files?:ApplicationFile[];roleInterests?:string}
export type AdmissionReviewData={claimId:string;userId:string;name:string;title:string;date:string;status:string;assignmentMode:string;programIds:string[];internalNote:string;waivers:{id:string;title:string;complete:boolean;signerName:string|null}[];documents:{id:string;title:string;complete:boolean}[]}
function Profile({userId,name,title}:{userId:string;name:string;title:string}){
  return <div className={s.profile}><div><b>{name}</b><small>{title}</small></div><Link target="_blank" className={s.button} href={'/aesthetic-lab/issuer/volunteers/'+userId}>View Profile</Link></div>
}
export function ApplicationReviewButton({application}:{application:ApplicationReviewData}){
  const[open,setOpen]=useState(false)
  return <><button className={s.button} type="button" onClick={()=>setOpen(true)}>{application.status==='submitted'?'Review Application':'View Decision'}</button>{open?<ApplicationReview application={application} onClose={()=>setOpen(false)}/>:null}</>
}
export function ApplicationDecisionButtons({application}:{application:ApplicationReviewData}){
  const[viewOpen,setViewOpen]=useState(false)
  const[decision,setDecision]=useState<'approved'|'not_approved'|null>(null)
  return <div className={s.decisionActions}>
    <button className={s.button} type="button" onClick={()=>setViewOpen(true)}><FileText size={13}/>View Application</button>
    <button className={s.button+' '+s.approve} type="button" onClick={()=>setDecision('approved')}>Approve</button>
    <button className={s.button+' '+s.reject} type="button" onClick={()=>setDecision('not_approved')}>Reject</button>
    {viewOpen?<ApplicationView application={application} onClose={()=>setViewOpen(false)}/>:null}
    {decision?<ApplicationDecision application={application} decision={decision} onClose={()=>setDecision(null)}/>:null}
  </div>
}
function ApplicationView({application:a,onClose}:{application:ApplicationReviewData;onClose:()=>void}){
  const files=a.files??[]
  return <IntakeModal title="View Application" onClose={onClose}><div className={s.form}>
    <Profile userId={a.userId} name={a.name} title={a.title}/>
    {a.roleInterests?<section className={s.applicationSection}><p className={s.eyebrow}>Role interests</p><p className={s.preserve}>{a.roleInterests}</p></section>:null}
    {a.introduction?<section className={s.applicationSection}><p className={s.eyebrow}>Application introduction</p><p className={s.preserve}>{a.introduction}</p></section>:null}
    <section className={s.applicationSection}><p className={s.eyebrow}>Application responses</p>{a.questions.length?<div className={s.questions}>{a.questions.map(q=><div className={s.answer} key={q.id}><b>{q.label}</b><p>{a.answers[q.id]||'No answer provided'}</p></div>)}</div>:<p className={s.hint}>This role did not require additional application questions.</p>}</section>
    {files.length?<section className={s.applicationSection}><p className={s.eyebrow}>Application files</p><div className={s.applicationFiles}>{files.map(file=><a key={file.id} href={file.href} target="_blank" rel="noreferrer"><FileText size={15}/><span><b>{file.name}</b>{file.detail?<small>{file.detail}</small>:null}</span></a>)}</div></section>:null}
    <footer className={s.footer}><button className={s.button} type="button" onClick={onClose}>Close</button></footer>
  </div></IntakeModal>
}
function ApplicationDecision({application:a,decision,onClose}:{application:ApplicationReviewData;decision:'approved'|'not_approved';onClose:()=>void}){
  const{save,pending,error}=useIntakeSave(onClose)
  const firstName=a.name.trim().split(/\s+/)[0]||'there'
  const organizationName=a.organizationName?.trim()||'our organization'
  const approved=decision==='approved'
  const subject=approved?`Your volunteer application has been approved`:`Update on your volunteer application`
  const message=approved
    ? `Hello ${firstName},\n\nWe’re happy to let you know that your application to volunteer with ${organizationName} has been approved. You can now review available opportunities and continue any required onboarding steps.\n\nWe look forward to working with you.\n\nSincerely,\n${organizationName}`
    : `Hello ${firstName},\n\nThank you for your interest in volunteering with ${organizationName}. After reviewing your application, we are not able to move forward at this time.\n\nWe appreciate the time you took to connect with us and your interest in supporting our work.\n\nSincerely,\n${organizationName}`
  const subjectName=approved?'acceptanceSubject':'rejectionSubject'
  const messageName=approved?'acceptanceMessage':'rejectionMessage'
  return <IntakeModal title={approved?'Approve Applicant':'Reject Applicant'} onClose={onClose} busy={pending}><form className={s.form} action={save}>
    <input type="hidden" name="operation" value="application-review"/><input type="hidden" name="applicationId" value={a.id}/><input type="hidden" name="decision" value={decision}/><input type="hidden" name="confirmed" value="on"/>
    <div className={s.decisionIdentity}><b>{a.name}</b><span>{a.title}</span></div>
    <fieldset disabled={pending}><section className={approved?s.acceptanceLetter:s.rejectionLetter}><div><p className={s.eyebrow}>{approved?'Acceptance':'Rejection'} letter</p><h3>Write the message they will receive.</h3><small>This private letter will be delivered to the applicant’s City/Sync Inbox and retained in your organization’s Messages.</small></div><label>Subject<input name={subjectName} required maxLength={180} defaultValue={subject}/></label><label>Letter<textarea name={messageName} required maxLength={5000} defaultValue={message}/></label></section>
    <label>Internal note <span className={s.optional}>Only authorized organization reviewers can see this.</span><textarea name="internalNote" maxLength={1500} defaultValue={a.internalNote}/></label></fieldset>
    <IntakeError error={error}/><footer className={s.footer}><button className={s.button} type="button" disabled={pending} onClick={onClose}>Cancel</button><button className={s.button+' '+s.primary} type="submit" disabled={pending}>{pending?'Saving…':approved?'Approve & Send Letter':'Reject & Send Letter'}</button></footer>
  </form></IntakeModal>
}
function ApplicationReview({application:a,onClose,initialDecision}:{application:ApplicationReviewData;onClose:()=>void;initialDecision?:'approved'|'not_approved'}){
  const[decision,setDecision]=useState(initialDecision??(a.status==='submitted'?'':a.status))
  const{save,pending,error}=useIntakeSave(onClose)
  const firstName=a.name.trim().split(/\s+/)[0]||'there'
  const organizationName=a.organizationName?.trim()||'our organization'
  const acceptanceSubject=`Your ${a.title} application has been approved`
  const acceptanceMessage=a.isOnboarding
    ? `Hello ${firstName},\n\nWe’re happy to let you know that your application for ${a.title} with ${organizationName} has been approved. You can now choose an available onboarding session and continue the volunteer onboarding process.\n\nWe look forward to welcoming you.\n\nSincerely,\n${organizationName}`
    : `Hello ${firstName},\n\nWe’re happy to let you know that your application to volunteer as ${a.title} with ${organizationName} has been approved. You can now review the role’s available opportunities and continue any required onboarding steps.\n\nWe look forward to working with you.\n\nSincerely,\n${organizationName}`
  const rejectionSubject=`Update on your ${a.title} application`
  const rejectionMessage=`Hello ${firstName},\n\nThank you for your interest in volunteering as ${a.title} with ${organizationName}. After reviewing your application, we are not able to move forward at this time.\n\nWe appreciate the time you took to connect with us and your interest in supporting our work.\n\nSincerely,\n${organizationName}`
  return <IntakeModal title={initialDecision==='approved'?'Approve Applicant':initialDecision==='not_approved'?'Reject Applicant':'Review Application'} onClose={onClose} busy={pending}><form className={s.form} action={save}><input type="hidden" name="operation" value="application-review"/><input type="hidden" name="applicationId" value={a.id}/>
    <Profile userId={a.userId} name={a.name} title={a.title}/>
    {a.introduction?<p className={s.preserve}>{a.introduction}</p>:null}
    <div className={s.questions}>{a.questions.map(q=><div className={s.answer} key={q.id}><b>{q.label}</b><p>{a.answers[q.id]||'No answer provided'}</p></div>)}</div>
    <fieldset disabled={pending}><label>Application decision<select aria-label="Application decision" name="decision" value={decision} required onChange={e=>setDecision(e.target.value)}><option value="">Choose a decision</option><option value="approved">Approve application</option><option value="not_approved">Not approved</option></select></label>
    <p className={s.notice}>{decision==='not_approved'?'The applicant will be notified that this application was not approved. They can contact your organization about a review. This is not a hidden restriction.':a.isOnboarding?'Approval lets this person reserve an onboarding date. You will make a separate roster decision after they attend.':'Approval lets this person pursue this role’s public shifts. It does not automatically add them to your roster or bypass your organization’s onboarding requirements.'}</p>
    {decision==='approved'?<section className={s.acceptanceLetter}><div><p className={s.eyebrow}>Acceptance letter</p><h3>Write the message they will receive.</h3><small>This private letter will be delivered to the applicant’s City/Sync Inbox and retained in your organization’s Messages.</small></div><label>Subject<input name="acceptanceSubject" required maxLength={180} defaultValue={acceptanceSubject}/></label><label>Letter<textarea name="acceptanceMessage" required maxLength={5000} defaultValue={acceptanceMessage}/></label></section>:null}
    {decision==='not_approved'?<section className={s.rejectionLetter}><div><p className={s.eyebrow}>Rejection letter</p><h3>Write the message they will receive.</h3><small>This private letter will be delivered to the applicant’s City/Sync Inbox and retained in your organization’s Messages.</small></div><label>Subject<input name="rejectionSubject" required maxLength={180} defaultValue={rejectionSubject}/></label><label>Letter<textarea name="rejectionMessage" required maxLength={5000} defaultValue={rejectionMessage}/></label></section>:null}
    <label>Internal note <span className={s.optional}>Only authorized organization reviewers can see this.</span><textarea name="internalNote" maxLength={1500} defaultValue={a.internalNote}/></label>
    <label className={s.check}><input type="checkbox" name="confirmed" required/>I reviewed this person’s profile and application and confirm this decision.</label></fieldset>
    <IntakeError error={error}/><footer className={s.footer}><button className={s.button} type="button" disabled={pending} onClick={onClose}>Cancel</button><button className={s.button+' '+s.primary} type="submit" disabled={pending||!decision}>{pending?'Saving…':decision==='not_approved'?'Reject & Send Letter':decision==='approved'?'Approve & Send Letter':'Save Decision'}</button></footer>
  </form></IntakeModal>
}
export function AdmissionReviewButton({person,programs}:{person:AdmissionReviewData;programs:IntakeProgram[]}){
  const[open,setOpen]=useState(false)
  return <><button className={s.button} type="button" onClick={()=>setOpen(true)}>{person.status==='pending'||person.status==='needs_paperwork'?'Review Volunteer':'View Decision'}</button>{open?<AdmissionReview person={person} programs={programs} onClose={()=>setOpen(false)}/>:null}</>
}
function AdmissionReview({person:p,programs,onClose}:{person:AdmissionReviewData;programs:IntakeProgram[];onClose:()=>void}){
  const[decision,setDecision]=useState(p.status==='pending'?'':p.status),[mode,setMode]=useState(p.assignmentMode),[selected,setSelected]=useState(p.programIds)
  const{save,pending,error}=useIntakeSave(onClose)
  return <IntakeModal title="Onboarding Approval" onClose={onClose} busy={pending}><form className={s.form} action={save}><input type="hidden" name="operation" value="admission-review"/><input type="hidden" name="claimId" value={p.claimId}/><Profile userId={p.userId} name={p.name} title={p.title+' · '+p.date}/>
    <fieldset disabled={pending}>
    {p.waivers.length||p.documents.length?<div className={s.paperwork}><h3>Paperwork</h3>{p.waivers.map(w=>w.complete?<p key={w.id}><CheckCircle2 size={15}/><span>{w.title}{w.signerName?' — signed by '+w.signerName:' — paper receipt recorded'}</span></p>:<label key={w.id} className={s.check}><input type="checkbox" name="paperWaiverId" value={w.id}/><span>I have the signed paper copy of <b>{w.title}</b>. Otherwise, leave unchecked for digital signing.</span></label>)}{p.documents.map(d=>d.complete?<p key={d.id}><CheckCircle2 size={15}/>{d.title} — received</p>:<label key={d.id} className={s.check}><input type="checkbox" name="documentId" value={d.id}/><span>I confirm this volunteer received <b>{d.title}</b>.</span></label>)}</div>:<p className={s.hint}>There is no required paperwork attached to this session.</p>}
    <label>Roster decision<select aria-label="Roster decision" name="decision" value={decision} required onChange={e=>setDecision(e.target.value)}><option value="">Choose a decision</option><option value="approved">Approve and add to roster</option><option value="needs_paperwork">Paperwork needed</option><option value="not_approved">Not approved</option></select></label>
    {decision!=='not_approved'?<ProgramAssignment programs={programs} mode={mode} onMode={setMode} selected={selected} onSelected={setSelected}/>:<><input type="hidden" name="assignmentMode" value="all"/><div className={s.warning}><label className={s.check}><input name="confirmRestriction" type="checkbox" required/>I understand this prevents new volunteer sign-ups and assignments at this organization. The volunteer will see this decision. Existing commitments are not cancelled.</label></div></>}
    {decision==='approved'?<p className={s.hint}>Approval adds this person to your roster with the program access selected above. All required paperwork must be complete.</p>:decision==='needs_paperwork'?<p className={s.hint}>The volunteer will be notified of missing paperwork and stay in this review list until approved.</p>:null}
    <label>Internal note <span className={s.optional}>Private to authorized organization reviewers.</span><textarea name="internalNote" defaultValue={p.internalNote} maxLength={1500}/></label><label className={s.check}><input type="checkbox" name="confirmed" required/>I reviewed this volunteer’s profile and confirm this roster decision.</label>
    </fieldset><IntakeError error={error}/><footer className={s.footer}><button type="button" className={s.button} disabled={pending} onClick={onClose}>Cancel</button><button type="submit" className={s.button+' '+s.primary} disabled={pending||!decision}>{pending?'Saving…':'Save Decision'}</button></footer>
  </form></IntakeModal>
}
