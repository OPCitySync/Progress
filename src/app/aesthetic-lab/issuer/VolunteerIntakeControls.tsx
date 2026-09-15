'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, CalendarPlus, CheckCircle2, FileText, Plus, Trash2, Upload, X } from 'lucide-react'
import { CalendarDateTimePicker } from './AddCalendarEntryButton'
import { volunteerIntakeAction, participantIntakeAction } from './volunteer-intake-actions'
import type { ApplicationFilePolicy, ApplicationScope, IntakeQuestion } from '@/lib/services/volunteer-intake'
import s from './VolunteerIntake.module.css'
import base from '../prototype.module.css'

export type IntakeProgram = {id:string;name:string}
type Result = {ok:true}|{ok:false;error:string}
export function IntakeModal({title,onClose,busy=false,children,calendar=false}:{title:string;onClose:()=>void;busy?:boolean;children:ReactNode;calendar?:boolean}) {
  const ref=useRef<HTMLDivElement>(null),id=useId(),close=useRef(onClose),busyRef=useRef(busy)
  close.current=onClose;busyRef.current=busy
  useEffect(()=>{
    const prior=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow
    document.body.style.overflow='hidden';ref.current?.focus()
    function key(e:KeyboardEvent){
      if(e.key==='Escape'&&!busyRef.current){e.preventDefault();close.current()}
      if(e.key==='Tab'){
        const nodes=Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled):not([type=hidden]),textarea:not(:disabled),select:not(:disabled)')??[]).filter(el=>el.getClientRects().length)
        if(!nodes.length){e.preventDefault();return}
        const first=nodes[0],last=nodes[nodes.length-1]
        if(e.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){e.preventDefault();last.focus()}
        else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===ref.current)){e.preventDefault();first.focus()}
      }
    }
    document.addEventListener('keydown',key)
    return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key);prior?.focus()}
  },[])
  return createPortal(<div className={s.backdrop} onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose()}}>
    <div className={s.dialog+' '+(calendar?s.calendar+' '+base.issuerCalendarModalPicker:'')} ref={ref} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}>
      <header><div><p className={s.eyebrow}>Volunteer onboarding</p><h2 id={id}>{title}</h2></div>{!calendar?<button type="button" className={s.iconButton} disabled={busy} aria-label="Close dialog" onClick={onClose}><X size={17}/></button>:null}</header>
      {children}
    </div>
  </div>,document.body)
}
export function useIntakeSave(onSaved:()=>void,participant=false){
  const router=useRouter(),busy=useRef(false)
  const [pending,setPending]=useState(false),[error,setError]=useState('')
  async function save(data:FormData){
    if(busy.current)return
    busy.current=true;setPending(true);setError('')
    try{
      const result:Result=await(participant?participantIntakeAction:volunteerIntakeAction)(data)
      if(!result.ok){setError(result.error);return}
      router.refresh();onSaved()
    }catch{setError('Unable to save. Your entries are still here; please try again.')}
    finally{busy.current=false;setPending(false)}
  }
  return{save,pending,error,setError}
}
export function IntakeError({error}:{error:string}){return error?<p role="alert" className={s.error}>{error}</p>:null}
export function ProgramAssignment({programs,mode,onMode,selected,onSelected}:{programs:IntakeProgram[];mode:string;onMode:(m:string)=>void;selected:string[];onSelected:(ids:string[])=>void}){
  return <div className={s.assignment}><label>Onboarding Assignment<select name="assignmentMode" aria-label="Onboarding Assignment" value={mode} onChange={e=>onMode(e.target.value)}><option value="all">All Programs</option><option value="specific">Specific Programs</option></select></label>
    {mode==='specific'?<fieldset className={s.programChoices}><legend>Select programs</legend>{programs.length?programs.map(p=><label className={s.check} key={p.id}><input type="checkbox" name="programId" value={p.id} checked={selected.includes(p.id)} onChange={e=>onSelected(e.target.checked?[...selected,p.id]:selected.filter(id=>id!==p.id))}/>{p.name}</label>):<p>Create a Program Area first, or choose All Programs.</p>}</fieldset>:null}
  </div>
}
export function VolunteerIntakeWizard({defaultLocation,programs}:{defaultLocation:string;programs:IntakeProgram[]}){
  const [open,setOpen]=useState(false)
  return <><button className={s.button} type="button" onClick={()=>setOpen(true)}><Plus size={14}/>Add Session</button>{open?<SessionWizard defaultLocation={defaultLocation} programs={programs} onClose={()=>setOpen(false)}/>:null}</>
}
function SessionWizard({defaultLocation,programs,onClose}:{defaultLocation:string;programs:IntakeProgram[];onClose:()=>void}){
  const [step,setStep]=useState(0),[title,setTitle]=useState(''),[location,setLocation]=useState(defaultLocation),[description,setDescription]=useState(''),[notes,setNotes]=useState(''),[capacity,setCapacity]=useState('5'),[duration,setDuration]=useState('60'),[mode,setMode]=useState('all'),[selected,setSelected]=useState<string[]>([])
  const {save,pending,error,setError}=useIntakeSave(onClose)
  function next(){if(step===0&&(!title.trim()||!location.trim())){setError('Add a title and location to continue.');return}if(step===1&&!description.trim()){setError('Describe what volunteers can expect.');return}setError('');setStep(step+1)}
  function submit(){
    const data=new FormData();data.set('operation','session');data.set('title',title);data.set('location',location);data.set('description',description);data.set('notes',notes);data.set('capacity',capacity);data.set('duration',duration);data.set('assignmentMode',mode);selected.forEach(id=>data.append('programId',id));void save(data)
  }
  return <IntakeModal title="Add Session" onClose={onClose} busy={pending}>
    <ol className={s.steps} aria-label="Session setup steps">{['Place','Welcome','Details'].map((label,i)=><li key={label} aria-current={step===i?'step':undefined} data-complete={i<step}>{i+1}<span>{label}</span></li>)}</ol>
    <form className={s.form} onSubmit={e=>{e.preventDefault();step<2?next():submit()}}>
      <fieldset disabled={pending}><div className={s.step} key={step}>
        {step===0?<><label>Session Title<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={120} required autoFocus placeholder="New volunteer welcome"/></label><label>Location<input value={location} onChange={e=>setLocation(e.target.value)} maxLength={240} required placeholder="Address or meeting location"/></label></>:step===1?<><label>Onboarding Description<textarea value={description} onChange={e=>setDescription(e.target.value)} maxLength={3000} required autoFocus placeholder="What will volunteers learn and experience?"/></label><label>Notes <span className={s.optional}>Optional</span><textarea value={notes} onChange={e=>setNotes(e.target.value)} maxLength={3000} placeholder="What to bring, where to meet, or how to prepare."/></label></>:<><div className={s.two}><label>Volunteer Capacity<select aria-label="Volunteer Capacity" value={capacity} onChange={e=>setCapacity(e.target.value)}>{['2','3','4','5'].map(n=><option key={n} value={n}>{n} volunteers</option>)}<option value="flexible">Flexible</option></select></label><label>Duration<select aria-label="Duration" value={duration} onChange={e=>setDuration(e.target.value)}><option value="30">30 minutes</option><option value="60">1 hour</option><option value="90">1 hour 30 minutes</option><option value="120">2 hours</option></select></label></div><ProgramAssignment programs={programs} mode={mode} onMode={setMode} selected={selected} onSelected={setSelected}/><p className={s.hint}>Save your session here. Choose its first date with Publish Onboarding.</p></>}
      </div></fieldset><IntakeError error={error}/><footer className={s.footer}><button type="button" className={s.button} disabled={pending} onClick={()=>{setError('');step?setStep(step-1):onClose()}}>{step?<><ArrowLeft size={14}/>Back</>:'Cancel'}</button><button type="submit" className={s.button+' '+s.primary} disabled={pending}>{pending?'Creating…':step<2?'Continue':'Create Session'}{step<2?<ArrowRight size={15}/>:null}</button></footer>
    </form>
  </IntakeModal>
}
export function PublishIntakeButton({taskId,title,suggestedStartsAt,duration}:{taskId:string;title:string;suggestedStartsAt:number;duration:number}){
  const[open,setOpen]=useState(false)
  return <><button type="button" className={s.button} onClick={()=>setOpen(true)}><CalendarPlus size={14}/>Publish Onboarding</button>{open?<PublishIntake taskId={taskId} title={title} initial={suggestedStartsAt} duration={duration} onClose={()=>setOpen(false)}/>:null}</>
}
function PublishIntake({taskId,title,initial,duration,onClose}:{taskId:string;title:string;initial:number;duration:number;onClose:()=>void}){
  const[value,setValue]=useState(()=>{const date=new Date(Math.max(initial,Date.now()+86400000));date.setSeconds(0,0);date.setMinutes(0);return date}),[recurring,setRecurring]=useState(false)
  const{save,pending,error}=useIntakeSave(onClose)
  function submit(){const data=new FormData();data.set('operation','publish');data.set('taskId',taskId);data.set('startsAt',String(value.getTime()));if(recurring)data.set('recurring','on');void save(data)}
  return <IntakeModal title="Publish Onboarding" onClose={onClose} busy={pending} calendar>
    <div className={s.publishSummary}><b>{title}</b><span>{duration} minutes · Public signup</span></div>
    <fieldset className={s.pickerFieldset} disabled={pending}><CalendarDateTimePicker label="Onboarding" value={value} onChange={setValue} onCancel={onClose} onDone={submit} doneLabel="Publish Onboarding" pending={pending}>
      <label className={s.check+' '+s.recurrence}><input type="checkbox" checked={recurring} onChange={e=>setRecurring(e.target.checked)}/>Repeat weekly</label>
      {recurring?<p className={s.hint}>The next weekly date publishes automatically after the current session ends.</p>:null}<IntakeError error={error}/>
    </CalendarDateTimePicker></fieldset>
  </IntakeModal>
}
export function QuestionFields({questions,answers,onChange,disabled=false}:{questions:IntakeQuestion[];answers:Record<string,string>;onChange:(id:string,value:string)=>void;disabled?:boolean}){
  return <div className={s.questions}>{questions.map(q=><label key={q.id}>{q.label}{q.required?<span className={s.optional}>Required</span>:<span className={s.optional}>Optional</span>}
    {q.type==='long'?<textarea disabled={disabled} required={q.required} maxLength={3000} value={answers[q.id]??''} onChange={e=>onChange(q.id,e.target.value)}/>:q.type==='choice'||q.type==='yes_no'?<select disabled={disabled} required={q.required} value={answers[q.id]??''} onChange={e=>onChange(q.id,e.target.value)}><option value="">Choose an answer</option>{(q.type==='yes_no'?['Yes','No']:q.options).map(o=><option key={o}>{o}</option>)}</select>:<input disabled={disabled} required={q.required} maxLength={500} value={answers[q.id]??''} onChange={e=>onChange(q.id,e.target.value)}/>}
  </label>)}</div>
}
type ApplicationKind = 'onboarding' | 'role' | 'program'
type ApplicationSetup = {introduction:string;questions:IntakeQuestion[];required:boolean;scope?:ApplicationScope;targetTaskId?:string|null;resumePolicy?:ApplicationFilePolicy;coverLetterPolicy?:ApplicationFilePolicy;published?:boolean}
type RoleInterest = {id:string;title:string}

export function IntakeApplicationBuilder({taskId,title,initial,kind='onboarding',formId,triggerLabel,targets}:{taskId:string;title:string;initial:ApplicationSetup|null;kind?:ApplicationKind;formId?:string;triggerLabel?:string;targets?:ApplicationTarget[]}){
  const[open,setOpen]=useState(false)
  return <><button type="button" className={s.button} onClick={()=>setOpen(true)}><FileText size={14}/>{triggerLabel??(initial?'Edit':'Create Application')}</button>{open?<ApplicationBuilder taskId={taskId} title={title} targets={targets} initial={initial} kind={kind} formId={formId} onClose={()=>setOpen(false)}/>:null}</>
}
type ApplicationTarget={id:string;title:string}
export function IntakeApplicationTemplateCreator({roles,triggerClassName}:{roles:ApplicationTarget[];triggerClassName?:string}){
  const[open,setOpen]=useState(false)
  const first=roles[0]
  return <><button type="button" className={[s.button,triggerClassName].filter(Boolean).join(' ')} disabled={!first} title={first?undefined:'Create a volunteer role before creating an application.'} onClick={()=>setOpen(true)}><Plus size={14}/>Create Application</button>{open&&first?<ApplicationBuilder taskId={first.id} title="Volunteer application" targets={roles} initial={null} kind="program" onClose={()=>setOpen(false)}/>:null}</>
}
function ApplicationBuilder({taskId,targets,initial,kind,formId,onClose}:{taskId:string;title:string;targets?:ApplicationTarget[];initial:ApplicationSetup|null;kind:ApplicationKind;formId?:string;onClose:()=>void}){
  const[introduction,setIntroduction]=useState(initial?.introduction??''),[required,setRequired]=useState(initial?.required??true),[questions,setQuestions]=useState<IntakeQuestion[]>(initial?.questions??[]),[confirmDelete,setConfirmDelete]=useState(false)
  const[scope,setScope]=useState<ApplicationScope>(initial?.scope??(kind==='program'?'all':'role'))
  const[selectedTaskId,setSelectedTaskId]=useState(initial?.targetTaskId??taskId)
  const[resumePolicy,setResumePolicy]=useState<ApplicationFilePolicy>(initial?.resumePolicy??'none')
  const[coverLetterPolicy,setCoverLetterPolicy]=useState<ApplicationFilePolicy>(initial?.coverLetterPolicy??'none')
  const{save,pending,error}=useIntakeSave(onClose)
  const change=(id:string,value:Partial<IntakeQuestion>)=>setQuestions(qs=>qs.map(q=>q.id===id?{...q,...value}:q))
  function submit(publish=false){const data=new FormData();data.set('operation','application-form');data.set('taskId',selectedTaskId);if(formId)data.set('sourceFormId',formId);data.set('introduction',kind==='role'?'':introduction);data.set('questions',JSON.stringify(questions));data.set('scope',scope);data.set('resumePolicy',resumePolicy);data.set('coverLetterPolicy',coverLetterPolicy);if(publish)data.set('publish','on');if(kind!=='onboarding'||required)data.set('required','on');void save(data)}
  function archive(){if(!formId)return;const data=new FormData();data.set('operation','application-form-archive');data.set('formId',formId);void save(data)}
  const isRole = kind === 'role'
  const isProgram = kind === 'program'
  const item = isRole ? 'role' : 'onboarding session'
  if(confirmDelete&&formId)return <IntakeModal title="Delete Application" onClose={()=>setConfirmDelete(false)} busy={pending}><div className={s.deleteConfirmation}><p>Delete this application template from the workspace?</p><p>Existing applications and submitted answers will remain in the organization’s records.</p><IntakeError error={error}/><footer className={s.footer}><button type="button" className={s.button} disabled={pending} onClick={()=>setConfirmDelete(false)}>Keep Application</button><button type="button" className={s.button+' '+s.deleteButton} disabled={pending} onClick={archive}>{pending?'Deleting…':<><Trash2 size={14}/>Delete Application</>}</button></footer></div></IntakeModal>
  return <IntakeModal title={isProgram?(initial?'Edit Application':'Create Application'):initial?'Manage Application':'Create Application'} onClose={onClose} busy={pending}><form className={s.form} onSubmit={e=>{e.preventDefault();submit(false)}}>
    <fieldset disabled={pending}>
    {targets?<label>Who is this application for?<select aria-label="Application audience" value={scope==='all'?'all':selectedTaskId} onChange={e=>{if(e.target.value==='all'){setScope('all');setSelectedTaskId(taskId)}else{setScope('role');setSelectedTaskId(e.target.value)}}}><option value="all">All Roles</option>{targets.map(target=><option key={target.id} value={target.id}>{target.title}</option>)}</select></label>:null}
    {isProgram?<div className={s.applicationRequirements}><div><b>Requested files</b><small>Choose what applicants should include.</small></div><div className={s.two}><label>Resume<select value={resumePolicy} onChange={e=>setResumePolicy(e.target.value as ApplicationFilePolicy)}><option value="none">Not requested</option><option value="optional">Optional</option><option value="required">Required</option></select></label><label>Cover Letter<select value={coverLetterPolicy} onChange={e=>setCoverLetterPolicy(e.target.value as ApplicationFilePolicy)}><option value="none">Not requested</option><option value="optional">Optional</option><option value="required">Required</option></select></label></div></div>:null}
    {kind==='onboarding'?<><label className={s.check}><input type="checkbox" checked={required} onChange={e=>setRequired(e.target.checked)}/>Require organization approval before reserving a {item}</label><p className={s.hint}>Ask only what helps you understand someone’s fit. Application answers are visible to your authorized reviewers.</p></>:null}
    <div className={s.toolbar}><b>Your questions</b></div>
      {!isRole?<label>Introduction <span className={s.optional}>Optional</span><textarea value={introduction} onChange={e=>setIntroduction(e.target.value)} maxLength={1500} placeholder={isProgram?'Explain the work, the roles available, and what applicants can expect.':undefined}/></label>:null}
      {questions.map((q,index)=><section className={s.question} key={q.id}><div className={s.toolbar}><b>Question {index+1}</b><button type="button" className={s.iconButton} onClick={()=>setQuestions(qs=>qs.filter(item=>item.id!==q.id))} aria-label={'Remove question '+(index+1)}><Trash2 size={14}/></button></div><label>Question<input value={q.label} onChange={e=>change(q.id,{label:e.target.value})} maxLength={240} required/></label><div className={s.two}><label>Answer type<select aria-label="Answer type" value={q.type} onChange={e=>change(q.id,{type:e.target.value as IntakeQuestion['type']})}><option value="short">Short answer</option><option value="long">Long answer</option><option value="choice">Choose one</option><option value="yes_no">Yes / No</option></select></label><label className={s.check}><input type="checkbox" checked={q.required} onChange={e=>change(q.id,{required:e.target.checked})}/>Required answer</label></div>
      {q.type==='choice'?<label>Options <span className={s.optional}>One per line; 2–10 choices</span><textarea required value={q.options.join('\n')} onChange={e=>change(q.id,{options:e.target.value.split('\n')})}/></label>:null}</section>)}
      <button type="button" className={s.button} disabled={questions.length>=12} onClick={()=>setQuestions(qs=>[...qs,{id:crypto.randomUUID(),label:'',type:'short',required:false,options:[]}])}><Plus size={14}/>Add question</button>
    </fieldset><IntakeError error={error}/><footer className={s.footer}>{formId?<button type="button" className={s.button+' '+s.deleteButton+' '+s.deleteApplicationButton} onClick={()=>setConfirmDelete(true)} disabled={pending}><Trash2 size={14}/>Delete Application</button>:null}<button type="button" className={s.button} onClick={onClose} disabled={pending}>Cancel</button><button type="submit" className={s.button} disabled={pending}>{pending?'Saving…':'Save Draft'}</button>{isProgram?<button type="button" className={s.button+' '+s.primary} disabled={pending} onClick={()=>submit(true)}>{pending?'Opening…':initial?.published?'Save & Keep Open':'Save & Open'}</button>:null}</footer>
  </form></IntakeModal>
}
export function IntakeReviewTabs({after,applications}:{after:ReactNode;applications:ReactNode}){
  const[tab,setTab]=useState('after'),id=useId()
  return <div className={s.surface}><div className={s.tabs} role="tablist" aria-label="Onboarding review stage">{[['after','After Onboarding'],['applications','Applications']].map(([value,label])=><button key={value} type="button" id={id+value} role="tab" aria-selected={tab===value} aria-controls={id+'panel'} onClick={()=>setTab(value)}>{label}</button>)}</div><div id={id+'panel'} role="tabpanel" aria-labelledby={id+tab}>{tab==='after'?after:applications}</div></div>
}
type ParticipantApplicationForm={id:string;introduction:string;questions:IntakeQuestion[];scope?:ApplicationScope;resumePolicy?:ApplicationFilePolicy;coverLetterPolicy?:ApplicationFilePolicy}
export function ParticipantIntakeApplication({taskId,title,form,status,blocked,kind='onboarding',roles=[]}:{taskId:string;title:string;form:ParticipantApplicationForm;status:string|null;blocked?:string|null;kind?:ApplicationKind;roles?:RoleInterest[]}){
  const[open,setOpen]=useState(false)
  const isRole = kind === 'role'
  if(isRole)return <ParticipantRoleApplicationCard taskId={taskId} form={form} status={status} blocked={blocked} roles={form.scope==='all'?roles:[]}/>
  return <section id="application" className={base.onboardingProcessCard+' '+s.surface}><div className={s.toolbar}><div><p className={s.eyebrow}>Volunteer application</p><h2>{status==='approved'?(isRole?'Your volunteer application is approved':'You’re approved to choose a date'):status==='submitted'?'Your application is in review':status==='not_approved'?'Your application was not approved':'Apply to volunteer'}</h2></div>{!status&&!blocked?<button className={s.button} type="button" onClick={()=>setOpen(true)}>Apply<ArrowRight size={14}/></button>:null}</div><p className={s.hint}>{blocked??(status==='approved'?(isRole?'Explore this organization’s shifts and complete any required onboarding before signing up.':'Choose an onboarding date below. The organization will review your roster access after you attend.'):status==='submitted'?'The organization will notify you after reviewing your application.':status==='not_approved'?'Contact the organization if you would like to ask about its decision.':isRole?'Apply once, share what interests you, and let the organization help connect you with the right role.':'Complete this short application. Organization approval is needed before you can reserve an onboarding date.')}</p>
    {open?<ParticipantApplicationDialog taskId={taskId} title={title} form={form} roles={isRole&&form.scope==='all'?roles:[]} onClose={()=>setOpen(false)}/>:null}
  </section>
}

function ParticipantApplicationShell({children}:{children:ReactNode}){
  return <section id="application" className={s.surface+' '+s.inlineApplicationCard}>
    <div className={base.paletteTreatmentHeader+' '+s.inlineApplicationHeader}><p className={base.eyebrow}>Volunteer Application</p></div>
    <div className={base.paletteTreatmentBody+' '+s.inlineApplicationBody}>{children}</div>
  </section>
}

function applicationStatusCopy(status:string|null,blocked?:string|null){
  if(blocked)return {title:'Application unavailable',detail:blocked}
  if(status==='approved')return {title:'Your volunteer application is approved',detail:'Explore this organization’s opportunities and complete any required onboarding before signing up.'}
  if(status==='submitted')return {title:'Your application is in review',detail:'The organization will notify you after reviewing your application.'}
  if(status==='not_approved')return {title:'Your application was not approved',detail:'Contact the organization if you would like to ask about its decision.'}
  return null
}

function ParticipantRoleApplicationCard({taskId,form,status,blocked,roles}:{taskId:string;form:ParticipantApplicationForm;status:string|null;blocked?:string|null;roles:RoleInterest[]}){
  const[answers,setAnswers]=useState<Record<string,string>>({}),[selected,setSelected]=useState<string[]>([]),[flexible,setFlexible]=useState(false),[resume,setResume]=useState<UploadedApplicationFile|null>(null),[coverLetter,setCoverLetter]=useState<UploadedApplicationFile|null>(null),{save,pending,error,setError}=useIntakeSave(()=>{},true)
  const resumePolicy=form.resumePolicy??'none',coverLetterPolicy=form.coverLetterPolicy??'none',oneClick=form.questions.length===0&&resumePolicy==='none'&&coverLetterPolicy==='none',state=applicationStatusCopy(status,blocked)
  function submit(){const roleInterests=roles.length&&!oneClick?roleInterestAnswer(selected,flexible):'';if(roles.length&&!oneClick&&!roleInterests){setError('Choose at least one role, or let the organization know you are flexible.');return}if(resumePolicy==='required'&&!resume){setError('Upload your resume before submitting.');return}if(coverLetterPolicy==='required'&&!coverLetter){setError('Upload your cover letter before submitting.');return}const data=new FormData();data.set('taskId',taskId);data.set('formId',form.id);data.set('answers',JSON.stringify({...answers,...(roleInterests?{__roleInterests:roleInterests}:{}),...(resume?{__resumeFile:JSON.stringify(resume)}:{}),...(coverLetter?{__coverLetterFile:JSON.stringify(coverLetter)}:{})}));void save(data)}
  return <ParticipantApplicationShell>{state?<><h2 className={s.inlineApplicationTitle}>{state.title}</h2><p className={s.hint}>{state.detail}</p></>:<><h2 className={s.inlineApplicationTitle}>Application Questions</h2>{form.introduction?<p className={s.preserve}>{form.introduction}</p>:null}<form className={s.form} onSubmit={e=>{e.preventDefault();submit()}}><fieldset disabled={pending}>{roles.length&&!oneClick?<RoleInterestFields roles={roles} selected={selected} onSelected={setSelected} flexible={flexible} onFlexible={setFlexible}/>:null}{form.questions.length?<QuestionFields questions={form.questions} answers={answers} onChange={(id,value)=>setAnswers(a=>({...a,[id]:value}))}/>:<div className={s.preserve}><b>No additional questions</b><p>Your City/Sync profile will be sent to the organization for review.</p></div>}<div className={s.applicationFileFields}><ApplicationFileField label="Resume" policy={resumePolicy} value={resume} onChange={setResume}/><ApplicationFileField label="Cover Letter" policy={coverLetterPolicy} value={coverLetter} onChange={setCoverLetter}/></div></fieldset><IntakeError error={error}/><footer className={s.footer+' '+s.inlineApplicationFooter}><button type="submit" className={s.button} disabled={pending}>{pending?'Submitting…':'Submit Application'}</button></footer></form></>}</ParticipantApplicationShell>
}

export function ParticipantProfileApplication({taskId,status,blocked,roles=[]}:{taskId:string;status:string|null;blocked?:string|null;roles?:RoleInterest[]}){
  const[selected,setSelected]=useState<string[]>([]),[flexible,setFlexible]=useState(false),{save,pending,error,setError}=useIntakeSave(()=>{},true),state=applicationStatusCopy(status,blocked)
  function submit(){const roleInterests=roleInterestAnswer(selected,flexible);if(!roleInterests){setError('Choose at least one role, or let the organization know you are flexible.');return}const data=new FormData();data.set('taskId',taskId);data.set('formId','');data.set('answers',JSON.stringify({__roleInterests:roleInterests}));void save(data)}
  return <ParticipantApplicationShell>{state?<><h2 className={s.inlineApplicationTitle}>{state.title}</h2><p className={s.hint}>{state.detail}</p></>:<><h2 className={s.inlineApplicationTitle}>Application Questions</h2><p className={s.hint}>No questionnaire is required. Choose what interests you and share your City/Sync profile for organization review.</p><form className={s.form} onSubmit={e=>{e.preventDefault();submit()}}><fieldset disabled={pending}><RoleInterestFields roles={roles} selected={selected} onSelected={setSelected} flexible={flexible} onFlexible={setFlexible}/></fieldset><IntakeError error={error}/><footer className={s.footer+' '+s.inlineApplicationFooter}><button type="submit" className={s.button} disabled={pending}>{pending?'Submitting…':'Submit Application'}</button></footer></form></>}</ParticipantApplicationShell>
}
function RoleInterestFields({roles,selected,onSelected,flexible,onFlexible}:{roles:RoleInterest[];selected:string[];onSelected:(ids:string[])=>void;flexible:boolean;onFlexible:(value:boolean)=>void}){
  return <fieldset className={s.roleInterests}><legend>What kinds of roles interest you?</legend><p>Choose any that sound right. This is a preference, not a commitment.</p>{roles.map(role=><label className={s.check} key={role.id}><input type="checkbox" checked={selected.includes(role.title)} disabled={flexible} onChange={e=>onSelected(e.target.checked?[...selected,role.title]:selected.filter(title=>title!==role.title))}/>{role.title}</label>)}<label className={s.check}><input type="checkbox" checked={flexible} onChange={e=>{onFlexible(e.target.checked);if(e.target.checked)onSelected([])}}/>I’m flexible — help me find the right fit</label></fieldset>
}
function roleInterestAnswer(selected:string[],flexible:boolean){return flexible?'I’m flexible — help me find the right fit':selected.join(' · ')}
type UploadedApplicationFile={name:string;url:string;type:string;size:number}
function ApplicationFileField({label,policy,value,onChange}:{label:string;policy:ApplicationFilePolicy;value:UploadedApplicationFile|null;onChange:(file:UploadedApplicationFile|null)=>void}){
  const[uploading,setUploading]=useState(false),[error,setError]=useState('')
  if(policy==='none')return null
  async function upload(file:File){
    setUploading(true);setError('')
    try{const data=new FormData();data.set('file',file);const response=await fetch('/api/upload/application-file',{method:'POST',body:data});const payload=await response.json() as {url?:string;error?:string};if(!response.ok||!payload.url)throw new Error(payload.error||'Upload failed.');onChange({name:file.name,url:payload.url,type:file.type,size:file.size})}catch(cause){setError(cause instanceof Error?cause.message:'Upload failed.')}finally{setUploading(false)}
  }
  return <div className={s.applicationFileField}><div><b>{label}</b><span>{policy==='required'?'Required':'Optional'}</span></div>{value?<div className={s.applicationFileReceipt}><FileText size={15}/><span>{value.name}</span><button type="button" className={s.iconButton} onClick={()=>onChange(null)} aria-label={`Remove ${label}`}><X size={13}/></button></div>:<label className={s.applicationFileUpload}><Upload size={15}/><span>{uploading?'Uploading…':`Upload ${label}`}</span><input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={uploading} onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file)}}/></label>}{error?<p className={s.error}>{error}</p>:null}</div>
}
function ParticipantApplicationDialog({taskId,title,form,roles,onClose}:{taskId:string;title:string;form:ParticipantApplicationForm;roles:RoleInterest[];onClose:()=>void}){
  const[answers,setAnswers]=useState<Record<string,string>>({}),[selected,setSelected]=useState<string[]>([]),[flexible,setFlexible]=useState(false),[resume,setResume]=useState<UploadedApplicationFile|null>(null),[coverLetter,setCoverLetter]=useState<UploadedApplicationFile|null>(null),{save,pending,error,setError}=useIntakeSave(onClose,true)
  const resumePolicy=form.resumePolicy??'none',coverLetterPolicy=form.coverLetterPolicy??'none'
  const oneClick=form.questions.length===0&&resumePolicy==='none'&&coverLetterPolicy==='none'
  function submit(){const roleInterests=roles.length&&!oneClick?roleInterestAnswer(selected,flexible):'';if(roles.length&&!oneClick&&!roleInterests){setError('Choose at least one role, or let the organization know you are flexible.');return}if(resumePolicy==='required'&&!resume){setError('Upload your resume before applying.');return}if(coverLetterPolicy==='required'&&!coverLetter){setError('Upload your cover letter before applying.');return}const data=new FormData();data.set('taskId',taskId);data.set('formId',form.id);data.set('answers',JSON.stringify({...answers,...(roleInterests?{__roleInterests:roleInterests}:{}),...(resume?{__resumeFile:JSON.stringify(resume)}:{}),...(coverLetter?{__coverLetterFile:JSON.stringify(coverLetter)}:{})}));void save(data)}
  return <IntakeModal title="Volunteer Application" onClose={onClose} busy={pending}><form className={s.form} onSubmit={e=>{e.preventDefault();submit()}}><p className={s.hint}>{title}</p>{form.introduction?<p className={s.preserve}>{form.introduction}</p>:null}{oneClick?<div className={s.preserve}><b>Apply with your City/Sync profile</b><p>No additional questions or files are required. Your application will still be sent to the organization for review.</p></div>:null}<fieldset disabled={pending}>{roles.length&&!oneClick?<RoleInterestFields roles={roles} selected={selected} onSelected={setSelected} flexible={flexible} onFlexible={setFlexible}/>:null}<QuestionFields questions={form.questions} answers={answers} onChange={(id,value)=>setAnswers(a=>({...a,[id]:value}))}/><div className={s.applicationFileFields}><ApplicationFileField label="Resume" policy={resumePolicy} value={resume} onChange={setResume}/><ApplicationFileField label="Cover Letter" policy={coverLetterPolicy} value={coverLetter} onChange={setCoverLetter}/></div></fieldset><IntakeError error={error}/><footer className={s.footer}><button type="button" className={s.button} disabled={pending} onClick={onClose}>Cancel</button><button type="submit" className={s.button+' '+s.primary} disabled={pending}>{pending?'Sending…':oneClick?'Apply':'Submit Application'}</button></footer><p className={s.hint}>This sends your profile and application to the organization for review. It does not reserve a shift or add you to its roster.</p></form></IntakeModal>
}
