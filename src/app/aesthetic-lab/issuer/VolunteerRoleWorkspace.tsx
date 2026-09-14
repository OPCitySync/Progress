'use client'

import { CalendarDays, CheckCircle2, Circle, FileText, Globe2, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { CreateVolunteerRoleButton } from './CreateVolunteerRoleButton'
import { ManageOpportunityTemplateButton } from './ManageOpportunityTemplateButton'
import { IntakeApplicationBuilder, IntakeApplicationTemplateCreator, IntakeError, IntakeModal, useIntakeSave } from './VolunteerIntakeControls'
import { ApplicationDecisionButtons } from './VolunteerIntakeReviews'
import type { ApplicationFilePolicy, ApplicationScope, IntakeQuestion } from '@/lib/services/volunteer-intake'
import styles from '../prototype.module.css'

type RoleItem = {
  task: { id:string; title:string; description:string; location:string; slots:number; defaultDurationMinutes:number }
  upcoming: number
  application: { introduction:string; questions:IntakeQuestion[]; required:boolean } | null
  published: boolean
}
type RoleApplicant = { id:string; userId:string; name:string; email:string; roleTitle:string; appliedAt:number; introduction:string; questions:IntakeQuestion[]; answers:Record<string,string>; internalNote:string; organizationName:string; files?:{id:string;name:string;href:string;detail?:string}[] }
type RoleApplicationTemplate = { id:string; taskId:string; roleTitle:string; version:number; introduction:string; questions:IntakeQuestion[]; createdAt:number; published:boolean; scope:ApplicationScope; targetTaskId:string|null; resumePolicy:ApplicationFilePolicy; coverLetterPolicy:ApplicationFilePolicy }

function ApplicationPublicationButton({formId,published,title}:{formId:string;published:boolean;title:string}) {
  const [confirming,setConfirming]=useState(false)
  const {save,pending,error}=useIntakeSave(()=>setConfirming(false))
  function updatePublication(next:boolean){
    const data=new FormData()
    data.set('operation',next?'application-form-publish':'application-form-unpublish')
    data.set('formId',formId)
    void save(data)
  }
  return <>
    <button type="button" className={`${styles.catalogWorkspaceAction} ${styles.opportunityWorkspaceButton}`} disabled={pending} onClick={()=>published?updatePublication(false):setConfirming(true)}>{pending?(published?'Closing…':'Opening…'):published?<><Circle size={14}/>Close</>:<><Globe2 size={14}/>Open to Public</>}</button>
    <IntakeError error={error}/>
    {confirming?<IntakeModal title="Open Volunteer Applications" onClose={()=>setConfirming(false)} busy={pending}>
      <div className={styles.volunteerIntakeConfirmation}>
        <p><b>{title}</b> will be open to the public. Civic-Participants can apply and every submission will still come to your organization for review.</p>
        <footer><button type="button" className={styles.catalogWorkspaceAction} disabled={pending} onClick={()=>setConfirming(false)}>Cancel</button><button type="button" className={`${styles.catalogWorkspaceAction} ${styles.opportunityWorkspaceButton}`} disabled={pending} onClick={()=>updatePublication(true)}>{pending?'Opening…':'Open Applications'}</button></footer>
        <IntakeError error={error}/>
      </div>
    </IntakeModal>:null}
  </>
}

export function VolunteerRoleWorkspace({roles,applicationTemplates,applicants,program,scope,organizationAddress,defaultDurationMinutes,defaultVisibility,redirectTo}:{roles:RoleItem[];applicationTemplates:RoleApplicationTemplate[];applicants:RoleApplicant[];program:{id:string|null;name:string};scope:string;organizationAddress:string;defaultDurationMinutes:number;defaultVisibility:'public'|'private';redirectTo:string}) {
  return <div className={styles.volunteerRoleWorkspace}>
    <section className={`${styles.programDetailSection} ${styles.volunteerRoleDirectoryCard}`}>
      <div className={styles.programDetailHeading}><div><p className={styles.eyebrow}>Volunteer Roles</p><h2>Define how people can help.</h2></div><CreateVolunteerRoleButton scope={scope} organizationAddress={organizationAddress} defaultDurationMinutes={defaultDurationMinutes} defaultVisibility={defaultVisibility} triggerClassName={`${styles.catalogWorkspaceAction} ${styles.opportunityWorkspaceButton}`}/></div>
      {roles.length?<div className={styles.volunteerRoleDirectoryList}>{roles.map(role=><article className={styles.volunteerRoleDirectoryItem} key={role.task.id}><span><CalendarDays size={15}/></span><div><b>{role.task.title}</b><small>{role.upcoming?`${role.upcoming} upcoming shift${role.upcoming===1?'':'s'}`:'Available for future scheduling'}</small></div><div className={styles.volunteerRoleItemActions}><ManageOpportunityTemplateButton task={role.task} program={program} redirectTo={redirectTo}/></div></article>)}</div>:<p className={styles.programDetailEmpty}>Create a volunteer role to define how people can help. You can open one shared application after the first role exists.</p>}
    </section>

    <section className={`${styles.programDetailSection} ${styles.applicationTemplateCard} ${styles.volunteerIntakeCard}`} aria-label="Volunteer Intake">
      <div className={styles.programDetailHeading}><div><p className={styles.eyebrow}>Application Templates</p><h2>Create clear ways to apply.</h2></div><div className={styles.programDetailHeadingActions}><IntakeApplicationTemplateCreator roles={roles.map(role=>({id:role.task.id,title:role.task.title}))} triggerClassName={`${styles.catalogWorkspaceAction} ${styles.opportunityWorkspaceButton}`}/></div></div>
      {roles.length?<>
        <div className={styles.volunteerIntakeSummary}>
          {applicationTemplates.length?applicationTemplates.map(template=>{
            const targetTitle=template.scope==='all'?'All Roles':roles.find(role=>role.task.id===(template.targetTaskId??template.taskId))?.task.title??template.roleTitle
            const requirements=[template.resumePolicy!=='none'?`Resume ${template.resumePolicy}`:null,template.coverLetterPolicy!=='none'?`Cover letter ${template.coverLetterPolicy}`:null,template.questions.length?`${template.questions.length} question${template.questions.length===1?'':'s'}`:null].filter(Boolean)
            const applicationTitle=template.scope==='all'?'General Volunteer Application':`${targetTitle} Application`
            return <article className={styles.volunteerIntakeApplicationRow} key={template.id}><span><FileText size={16}/></span><div><b>{applicationTitle}</b><p>{targetTitle} · {requirements.length?requirements.join(' · '):'One-click application'}</p></div><span className={styles.volunteerIntakeState} data-open={template.published}>{template.published?<CheckCircle2 size={13}/>:<Circle size={13}/>} {template.published?'Open':'Draft'}</span><div className={styles.volunteerRoleItemActions}><IntakeApplicationBuilder taskId={template.taskId} title={applicationTitle} targets={roles.map(role=>({id:role.task.id,title:role.task.title}))} kind="program" formId={template.id} triggerLabel="Edit" initial={{introduction:template.introduction,questions:template.questions,required:true,scope:template.scope,targetTaskId:template.targetTaskId,resumePolicy:template.resumePolicy,coverLetterPolicy:template.coverLetterPolicy,published:template.published}}/><ApplicationPublicationButton formId={template.id} published={template.published} title={applicationTitle}/></div></article>
          }):<div className={styles.volunteerIntakeEmpty}><UsersRound size={20}/><p>No application templates yet. Create a one-click application or request questions and files when they help your review.</p></div>}
        </div>
      </>:<div className={styles.volunteerIntakeEmpty}><UsersRound size={20}/><p>Create a volunteer role before creating an application.</p></div>}
    </section>

    <section className={`${styles.programDetailSection} ${styles.roleApplicantCard}`}>
      <div><p className={styles.eyebrow}>Unreviewed Applicants</p><h2>{applicants.length?'People ready for review':'No applicants waiting'}</h2></div>
      {applicants.length?<div className={styles.roleApplicantList}>{applicants.map(applicant=><article key={applicant.id}><div><b>{applicant.name}</b><small>{applicant.answers.__roleInterests||applicant.roleTitle}</small><span>{applicant.email}</span></div><ApplicationDecisionButtons application={{id:applicant.id,userId:applicant.userId,name:applicant.name,title:applicant.roleTitle,status:'submitted',introduction:applicant.introduction,questions:applicant.questions,answers:applicant.answers,internalNote:applicant.internalNote,isOnboarding:false,organizationName:applicant.organizationName,roleInterests:applicant.answers.__roleInterests,files:applicant.files}}/></article>)}</div>:<p className={styles.roleApplicantEmpty}>New volunteer applications will appear here until your organization reviews them.</p>}
    </section>
  </div>
}
