'use client'

import { CalendarDays, Check, FileText, Globe2 } from 'lucide-react'
import { CreateVolunteerRoleButton } from './CreateVolunteerRoleButton'
import { ManageOpportunityTemplateButton } from './ManageOpportunityTemplateButton'
import { IntakeApplicationBuilder, IntakeApplicationTemplateCreator, IntakeError, useIntakeSave } from './VolunteerIntakeControls'
import { ApplicationDecisionButtons } from './VolunteerIntakeReviews'
import type { IntakeQuestion } from '@/lib/services/volunteer-intake'
import styles from '../prototype.module.css'

type RoleItem = {
  task: { id:string; title:string; description:string; location:string; slots:number; defaultDurationMinutes:number }
  upcoming: number
  application: { introduction:string; questions:IntakeQuestion[]; required:boolean } | null
  published: boolean
}
type RoleApplicant = { id:string; userId:string; name:string; email:string; roleTitle:string; appliedAt:number; introduction:string; questions:IntakeQuestion[]; answers:Record<string,string>; internalNote:string; organizationName:string }
type RoleApplicationTemplate = { id:string; taskId:string; roleTitle:string; version:number; introduction:string; questions:IntakeQuestion[]; createdAt:number; published:boolean }

function PublishApplicationButton({formId,published}:{formId:string;published:boolean}) {
  const {save,pending,error}=useIntakeSave(()=>{})
  function updatePublication(){
    const data=new FormData()
    data.set('operation',published?'application-form-unpublish':'application-form-publish')
    data.set('formId',formId)
    void save(data)
  }
  return <div className={styles.applicationPublishControl}>
    <button type="button" className={`${styles.catalogWorkspaceAction} ${styles.opportunityWorkspaceButton}`} disabled={pending} onClick={updatePublication}>{pending?(published?'Unpublishing…':'Publishing…'):published?<><Check size={14}/>Unpublish Application</>:<><Globe2 size={14}/>Publish Application</>}</button>
    <IntakeError error={error}/>
  </div>
}

export function VolunteerRoleWorkspace({roles,applicationTemplates,applicants,program,scope,organizationAddress,defaultDurationMinutes,defaultVisibility,redirectTo}:{roles:RoleItem[];applicationTemplates:RoleApplicationTemplate[];applicants:RoleApplicant[];program:{id:string|null;name:string};scope:string;organizationAddress:string;defaultDurationMinutes:number;defaultVisibility:'public'|'private';redirectTo:string}) {
  const availableRoles=roles.map(role=>({id:role.task.id,title:role.task.title}))
  return <div className={styles.volunteerRoleWorkspace}>
    <section className={`${styles.programDetailSection} ${styles.volunteerRoleDirectoryCard}`}>
      <div className={styles.programDetailHeading}><div><p className={styles.eyebrow}>Volunteer Roles</p><h2>Define how people can help.</h2></div><CreateVolunteerRoleButton scope={scope} organizationAddress={organizationAddress} defaultDurationMinutes={defaultDurationMinutes} defaultVisibility={defaultVisibility} triggerClassName={`${styles.catalogWorkspaceAction} ${styles.opportunityWorkspaceButton}`}/></div>
      {roles.length?<div className={styles.volunteerRoleDirectoryList}>{roles.map(role=><article className={styles.volunteerRoleDirectoryItem} key={role.task.id}><span><CalendarDays size={15}/></span><div><b>{role.task.title}</b><small>{role.published?'Published opportunity':role.upcoming?'Scheduled · not publicly listed':'Draft role'}</small></div><div className={styles.volunteerRoleItemActions}><ManageOpportunityTemplateButton task={role.task} program={program} redirectTo={redirectTo}/></div></article>)}</div>:<p className={styles.programDetailEmpty}>Create a volunteer role to define how people can help. Applications and public visibility can be added afterward.</p>}
    </section>
    <section className={`${styles.programDetailSection} ${styles.applicationTemplateCard}`} aria-label="Application Templates">
      <div className={styles.programDetailHeading}><div><p className={styles.eyebrow}>Application Templates</p><h2>Create and manage application forms.</h2></div><IntakeApplicationTemplateCreator roles={availableRoles} triggerClassName={`${styles.catalogWorkspaceAction} ${styles.opportunityWorkspaceButton}`}/></div>
      {applicationTemplates.length?<div className={styles.applicationTemplateList}>{applicationTemplates.map(template=><article className={styles.applicationTemplateItem} key={template.id}><span><FileText size={15}/></span><div><b>{template.roleTitle} Application</b><small>Saved {new Date(template.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</small></div><div className={styles.applicationTemplateActions}><IntakeApplicationBuilder taskId={template.taskId} title={template.roleTitle} kind="role" formId={template.id} triggerLabel="Edit" initial={{introduction:template.introduction,questions:template.questions,required:true}}/><PublishApplicationButton formId={template.id} published={template.published}/></div></article>)}</div>:<p className={styles.programDetailEmpty}>Create an application when a role needs questions before approval.</p>}
    </section>
    <section className={`${styles.programDetailSection} ${styles.roleApplicantCard}`}>
      <div><p className={styles.eyebrow}>Unreviewed Applicants</p><h2>{applicants.length?'People ready for review':'No applicants waiting'}</h2></div>
      {applicants.length?<div className={styles.roleApplicantList}>{applicants.map(applicant=><article key={applicant.id}><div><b>{applicant.name}</b><small>{applicant.roleTitle}</small><span>{applicant.email}</span></div><ApplicationDecisionButtons application={{id:applicant.id,userId:applicant.userId,name:applicant.name,title:applicant.roleTitle,status:'submitted',introduction:applicant.introduction,questions:applicant.questions,answers:applicant.answers,internalNote:applicant.internalNote,isOnboarding:false,organizationName:applicant.organizationName}}/></article>)}</div>:<p className={styles.roleApplicantEmpty}>New applications will appear here until your organization reviews them.</p>}
    </section>
  </div>
}
