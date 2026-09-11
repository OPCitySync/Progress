'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, CalendarPlus, CheckCircle2, FileText, Plus, Trash2, X } from 'lucide-react'
import { CalendarDateTimePicker } from './AddCalendarEntryButton'
import { volunteerIntakeAction, participantIntakeAction } from './volunteer-intake-actions'
import type { IntakeQuestion } from '@/lib/services/volunteer-intake'
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
type ApplicationKind = 'onboarding' | 'role'
type ApplicationSetup = {introduction:string;questions:IntakeQuestion[];required:boolean}

export function IntakeApplicationBuilder({taskId,title,initial,kind='onboarding',formId,triggerLabel}:{taskId:string;title:string;initial:ApplicationSetup|null;kind?:ApplicationKind;formId?:string;triggerLabel?:string}){
  const[open,setOpen]=useState(false)
  return <><button type="button" className={s.button} onClick={()=>setOpen(true)}><FileText size={14}/>{triggerLabel??(initial?'Manage Application':'Create Application')}</button>{open?<ApplicationBuilder taskId={taskId} title={title} initial={initial} kind={kind} formId={formId} onClose={()=>setOpen(false)}/>:null}</>
}
type ApplicationTarget={id:string;title:string}
export function IntakeApplicationTemplateCreator({roles,triggerClassName}:{roles:ApplicationTarget[];triggerClassName?:string}){
  const[open,setOpen]=useState(false)
  const first=roles[0]
  return <><button type="button" className={[s.button,triggerClassName].filter(Boolean).join(' ')} disabled={!first} title={first?undefined:'Every volunteer role already has an application template.'} onClick={()=>setOpen(true)}><Plus size={14}/>Create Application</button>{open&&first?<ApplicationBuilder taskId={first.id} title={first.title} targets={roles} initial={null} kind="role" onClose={()=>setOpen(false)}/>:null}</>
}
function ApplicationBuilder({taskId,targets,initial,kind,formId,onClose}:{taskId:string;title:string;targets?:ApplicationTarget[];initial:ApplicationSetup|null;kind:ApplicationKind;formId?:string;onClose:()=>void}){
  const[introduction,setIntroduction]=useState(initial?.introduction??''),[required,setRequired]=useState(initial?.required??true),[questions,setQuestions]=useState<IntakeQuestion[]>(initial?.questions??[{id:crypto.randomUUID(),label:'What interests you about volunteering with us?',type:'long',required:true,options:[]}]),[confirmDelete,setConfirmDelete]=useState(false)
  const[selectedTaskId,setSelectedTaskId]=useState(taskId)
  const{save,pending,error}=useIntakeSave(onClose)
  const change=(id:string,value:Partial<IntakeQuestion>)=>setQuestions(qs=>qs.map(q=>q.id===id?{...q,...value}:q))
  function submit(){const data=new FormData();data.set('operation','application-form');data.set('taskId',selectedTaskId);if(formId)data.set('sourceFormId',formId);data.set('introduction',kind==='role'?'':introduction);data.set('questions',JSON.stringify(questions));if(kind==='role'||required)data.set('required','on');void save(data)}
  function archive(){if(!formId)return;const data=new FormData();data.set('operation','application-form-archive');data.set('formId',formId);void save(data)}
  const isRole = kind === 'role'
  const item = isRole ? 'role' : 'onboarding session'
  if(confirmDelete&&formId)return <IntakeModal title="Delete Application" onClose={()=>setConfirmDelete(false)} busy={pending}><div className={s.deleteConfirmation}><p>Delete this application template from the workspace?</p><p>Existing applications and submitted answers will remain in the organization’s records.</p><IntakeError error={error}/><footer className={s.footer}><button type="button" className={s.button} disabled={pending} onClick={()=>setConfirmDelete(false)}>Keep Application</button><button type="button" className={s.button+' '+s.deleteButton} disabled={pending} onClick={archive}>{pending?'Deleting…':<><Trash2 size={14}/>Delete Application</>}</button></footer></div></IntakeModal>
  return <IntakeModal title={initial?'Manage Application':'Create Application'} onClose={onClose} busy={pending}><form className={s.form} onSubmit={e=>{e.preventDefault();submit()}}>
    <fieldset disabled={pending}>
    {targets?<label>Volunteer Role<select aria-label="Volunteer Role" value={selectedTaskId} onChange={e=>setSelectedTaskId(e.target.value)}>{targets.map(target=><option key={target.id} value={target.id}>{target.title}</option>)}</select></label>:null}
    {!isRole?<><label className={s.check}><input type="checkbox" checked={required} onChange={e=>setRequired(e.target.checked)}/>Require organization approval before reserving a {item}</label><p className={s.hint}>Ask only what helps you understand someone’s fit. Application answers are visible to your authorized reviewers.</p></>:null}
    <div className={s.toolbar}><b>Your questions</b></div>
      {!isRole?<label>Introduction <span className={s.optional}>Optional</span><textarea value={introduction} onChange={e=>setIntroduction(e.target.value)} maxLength={1500}/></label>:null}
      {questions.map((q,index)=><section className={s.question} key={q.id}><div className={s.toolbar}><b>Question {index+1}</b><button type="button" className={s.iconButton} onClick={()=>setQuestions(qs=>qs.filter(item=>item.id!==q.id))} aria-label={'Remove question '+(index+1)}><Trash2 size={14}/></button></div><label>Question<input value={q.label} onChange={e=>change(q.id,{label:e.target.value})} maxLength={240} required/></label><div className={s.two}><label>Answer type<select aria-label="Answer type" value={q.type} onChange={e=>change(q.id,{type:e.target.value as IntakeQuestion['type']})}><option value="short">Short answer</option><option value="long">Long answer</option><option value="choice">Choose one</option><option value="yes_no">Yes / No</option></select></label><label className={s.check}><input type="checkbox" checked={q.required} onChange={e=>change(q.id,{required:e.target.checked})}/>Required answer</label></div>
      {q.type==='choice'?<label>Options <span className={s.optional}>One per line; 2–10 choices</span><textarea required value={q.options.join('\n')} onChange={e=>change(q.id,{options:e.target.value.split('\n')})}/></label>:null}</section>)}
      <button type="button" className={s.button} disabled={questions.length>=12} onClick={()=>setQuestions(qs=>[...qs,{id:crypto.randomUUID(),label:'',type:'short',required:false,options:[]}])}><Plus size={14}/>Add question</button>
    </fieldset><IntakeError error={error}/><footer className={s.footer}>{formId?<button type="button" className={s.button+' '+s.deleteButton+' '+s.deleteApplicationButton} onClick={()=>setConfirmDelete(true)} disabled={pending}><Trash2 size={14}/>Delete Application</button>:null}<button type="button" className={s.button} onClick={onClose} disabled={pending}>Cancel</button><button type="submit" className={s.button+' '+s.primary} disabled={pending||!questions.length}>{pending?'Saving…':'Save Application'}</button></footer>
  </form></IntakeModal>
}
export function IntakeReviewTabs({after,applications}:{after:ReactNode;applications:ReactNode}){
  const[tab,setTab]=useState('after'),id=useId()
  return <div className={s.surface}><div className={s.tabs} role="tablist" aria-label="Onboarding review stage">{[['after','After Onboarding'],['applications','Applications']].map(([value,label])=><button key={value} type="button" id={id+value} role="tab" aria-selected={tab===value} aria-controls={id+'panel'} onClick={()=>setTab(value)}>{label}</button>)}</div><div id={id+'panel'} role="tabpanel" aria-labelledby={id+tab}>{tab==='after'?after:applications}</div></div>
}
export function ParticipantIntakeApplication({taskId,title,form,status,blocked,kind='onboarding'}:{taskId:string;title:string;form:{id:string;introduction:string;questions:IntakeQuestion[]};status:string|null;blocked?:string|null;kind?:ApplicationKind}){
  const[open,setOpen]=useState(false)
  const isRole = kind === 'role'
  return <section id="application" className={base.onboardingProcessCard+' '+s.surface}><div className={s.toolbar}><div><p className={s.eyebrow}>Volunteer application</p><h2>{status==='approved'?(isRole?'Your role application is approved':'You’re approved to choose a date'):status==='submitted'?'Your application is in review':status==='not_approved'?'Your application was not approved':'Start with your application'}</h2></div>{!status&&!blocked?<button className={s.button} type="button" onClick={()=>setOpen(true)}>Apply<ArrowRight size={14}/></button>:null}</div><p className={s.hint}>{blocked??(status==='approved'?(isRole?'You can review public shifts below. If this organization uses onboarding, complete that welcome process before signing up.':'Choose an onboarding date below. The organization will review your roster access after you attend.'):status==='submitted'?'The organization will notify you after reviewing your application. You can reserve a date once approved.':status==='not_approved'?'Contact the organization if you would like to ask about its decision.':`Complete this short application. Organization approval is needed before you can reserve a ${isRole?'shift':'onboarding date'}.`)}</p>
    {open?<ParticipantApplicationDialog taskId={taskId} title={title} form={form} onClose={()=>setOpen(false)}/>:null}
  </section>
}
export function ParticipantProfileApplication({taskId,title,status,blocked}:{taskId:string;title:string;status:string|null;blocked?:string|null}){
  const[open,setOpen]=useState(false)
  return <section id="application" className={base.onboardingProcessCard+' '+s.surface}><div className={s.toolbar}><div><p className={s.eyebrow}>Volunteer application</p><h2>{status==='approved'?'Your role application is approved':status==='submitted'?'Your application is in review':status==='not_approved'?'Your application was not approved':'Apply with your City/Sync profile'}</h2></div>{!status&&!blocked?<button className={s.button} type="button" onClick={()=>setOpen(true)}>Apply<ArrowRight size={14}/></button>:null}</div><p className={s.hint}>{blocked??(status==='approved'?'You can now choose an available public shift. Any organization onboarding requirements still apply.':status==='submitted'?'The organization is reviewing the profile you already use on City/Sync. No additional form is needed.':status==='not_approved'?'Contact the organization if you would like to ask about its decision.':'No questionnaire is required. Applying shares your City/Sync profile with the organization for approval before you choose a shift.')}</p>
    {open?<ParticipantProfileApplicationDialog taskId={taskId} title={title} onClose={()=>setOpen(false)}/>:null}
  </section>
}
function ParticipantProfileApplicationDialog({taskId,title,onClose}:{taskId:string;title:string;onClose:()=>void}){
  const{save,pending,error}=useIntakeSave(onClose,true)
  function submit(){const data=new FormData();data.set('taskId',taskId);data.set('formId','');data.set('answers','{}');void save(data)}
  return <IntakeModal title="Apply for this role" onClose={onClose} busy={pending}><form className={s.form} onSubmit={e=>{e.preventDefault();submit()}}><div className={s.preserve}><b>{title}</b><p>The organization will review your existing City/Sync profile. You do not need to complete a separate application form.</p></div><IntakeError error={error}/><footer className={s.footer}><button type="button" className={s.button} disabled={pending} onClick={onClose}>Cancel</button><button type="submit" className={s.button+' '+s.primary} disabled={pending}>{pending?'Sending…':'Submit Application'}</button></footer></form></IntakeModal>
}
function ParticipantApplicationDialog({taskId,title,form,onClose}:{taskId:string;title:string;form:{id:string;introduction:string;questions:IntakeQuestion[]};onClose:()=>void}){
  const[answers,setAnswers]=useState<Record<string,string>>({}),{save,pending,error}=useIntakeSave(onClose,true)
  function submit(){const data=new FormData();data.set('taskId',taskId);data.set('formId',form.id);data.set('answers',JSON.stringify(answers));void save(data)}
  return <IntakeModal title="Volunteer Application" onClose={onClose} busy={pending}><form className={s.form} onSubmit={e=>{e.preventDefault();submit()}}><p className={s.hint}>{title}</p>{form.introduction?<p className={s.preserve}>{form.introduction}</p>:null}<fieldset disabled={pending}><QuestionFields questions={form.questions} answers={answers} onChange={(id,value)=>setAnswers(a=>({...a,[id]:value}))}/></fieldset><IntakeError error={error}/><footer className={s.footer}><button type="button" className={s.button} disabled={pending} onClick={onClose}>Cancel</button><button type="submit" className={s.button+' '+s.primary} disabled={pending}>{pending?'Sending…':'Submit Application'}</button></footer><p className={s.hint}>This sends your answers to the organization. It does not reserve a session or add you to its roster.</p></form></IntakeModal>
}
