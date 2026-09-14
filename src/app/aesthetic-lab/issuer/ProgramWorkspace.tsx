'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { BarChart3, CalendarDays, Check, ClipboardList, HeartHandshake, Plus, UserRoundPlus, X } from 'lucide-react'
import { programWorkspaceAction, participantOnboardingAction } from './program-workspace-actions'
import styles from './ProgramWorkspace.module.css'

type Result = {ok:true}|{ok:false;error:string}
export function WorkspaceForm({children, scope, operation, onSaved, participant=false, orgId, submitLabel='Save', successLabel='Saved', disabled=false}:{
  children?:ReactNode; scope:string;operation:string;onSaved?:()=>void;participant?:boolean;orgId?:string;submitLabel?:string;successLabel?:string;disabled?:boolean
}){
  const router=useRouter()
  const busy=useRef(false)
  const [pending,setPending]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false)
  async function submit(data:FormData){
    if(busy.current)return
    busy.current=true
    setPending(true);setError('');setSaved(false)
    try{
      const result:Result=await (participant?participantOnboardingAction:programWorkspaceAction)(data)
      if(!result.ok){setError(result.error);return}
      setSaved(true);router.refresh();onSaved?.()
    }catch{setError('Unable to save. Please try again.')}finally{busy.current=false;setPending(false)}
  }
  return <form action={submit} className={styles.form}>
    <input type="hidden" name="scope" value={scope}/><input type="hidden" name="operation" value={operation}/>
    {orgId?<input type="hidden" name="orgId" value={orgId}/>:null}
    <fieldset disabled={pending}>{children}</fieldset>
    {error?<p className={styles.error} role="alert">{error}</p>:null}
    <div className={styles.formFooter}>{onSaved?<button type="button" disabled={pending} onClick={onSaved}>Cancel</button>:null}
      {saved&&!onSaved?<small role="status"><Check size={13}/>{successLabel}</small>:null}
      <button type="submit" disabled={pending||disabled}>{pending?'Saving…':submitLabel}</button>
    </div>
  </form>
}

export function WorkspaceDialog({label,title,children,icon=true,triggerClassName}:{label:string;title:string;children:ReactNode;icon?:boolean;triggerClassName?:string}){
  const [open,setOpen]=useState(false),id=useId()
  const trigger=useRef<HTMLButtonElement>(null),dialog=useRef<HTMLDivElement>(null)
  useEffect(()=>{
    if(!open)return
    const old=document.body.style.overflow;document.body.style.overflow='hidden'
    dialog.current?.focus()
    function key(e:KeyboardEvent){
      if(e.key==='Escape')setOpen(false)
      if(e.key==='Tab'){
        const nodes=dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]')
        if(!nodes?.length)return
        const first=nodes[0],last=nodes[nodes.length-1]
        if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){e.preventDefault();last.focus()}
        if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
      }
    }
    document.addEventListener('keydown',key)
    return ()=>{document.body.style.overflow=old;document.removeEventListener('keydown',key);trigger.current?.focus()}
  },[open])
  return <><button ref={trigger} type="button" className={triggerClassName||styles.button} aria-haspopup="dialog" onClick={()=>setOpen(true)}>{icon?<Plus size={14}/>:null}{label}</button>
    {open?createPortal(<div className={styles.backdrop} onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} ref={dialog}>
        <header><h2 id={id}>{title}</h2><button type="button" aria-label="Close dialog" onClick={()=>setOpen(false)}><X size={17}/></button></header>
        <div ><DialogContents onSaved={()=>setOpen(false)}>{children}</DialogContents></div>
      </div>
    </div>,document.body):null}
  </>
}
// A context gives server-rendered forms a success-only close callback.
import { createContext, useContext } from 'react'
const CloseContext=createContext<(()=>void)|undefined>(undefined)
function DialogContents({children,onSaved}:{children:ReactNode;onSaved:()=>void}){return <CloseContext.Provider value={onSaved}>{children}</CloseContext.Provider>}
export function DialogForm(props:Omit<Parameters<typeof WorkspaceForm>[0],'onSaved'>){const close=useContext(CloseContext);return <WorkspaceForm {...props} onSaved={close}/>}

const sections=[
  {id:'positions',label:'Roles & Applications',icon:ClipboardList},
  {id:'onboarding',label:'Onboarding',icon:UserRoundPlus},
  {id:'scheduling',label:'Shift Planning',icon:CalendarDays},
  {id:'recognition',label:'Recognition',icon:HeartHandshake},
  {id:'overview',label:'Program Overview',icon:BarChart3},
]
export function ProgramNavigation({initialSection='overview',panels}:{initialSection?:string;panels:Record<string,ReactNode>}){
  const [active,setActive]=useState(sections.some(s=>s.id===initialSection)?initialSection:'overview')
  const nav=useRef<HTMLDivElement>(null)
  const select=(id:string)=>{setActive(id);const url=new URL(location.href);url.searchParams.set('section',id);url.hash='';history.replaceState({},'',url)}
  useEffect(()=>{if(initialSection&&sections.some(s=>s.id===initialSection))setActive(initialSection)},[initialSection])
  useEffect(()=>{
    function sync(){const hash=location.hash;const mapped=hash.includes('opportunities')?'positions':hash.includes('schedule')||hash.includes('staffing')?'scheduling':null; const id=mapped||new URLSearchParams(location.search).get('section')||'overview';if(sections.some(s=>s.id===id))setActive(id)}
    sync();window.addEventListener('hashchange',sync);window.addEventListener('popstate',sync)
    return()=>{window.removeEventListener('hashchange',sync);window.removeEventListener('popstate',sync)}
  },[])
  return <div className={styles.workspace}>
    <div ref={nav} className={styles.tabs} role="tablist" aria-label="Program workspace">
      {sections.map((s,index)=><button key={s.id} id={'tab-'+s.id} role="tab" aria-selected={active===s.id} aria-controls={'panel-'+s.id} tabIndex={active===s.id?0:-1} onClick={()=>select(s.id)} onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const next=sections[(index+(e.key==='ArrowRight'?1:sections.length-1))%sections.length];select(next.id);nav.current?.querySelector<HTMLButtonElement>('#tab-'+next.id)?.focus()}}}><s.icon size={15}/>{s.label}</button>)}
    </div>
    <div key={active} id={'panel-'+active} role="tabpanel" aria-labelledby={'tab-'+active} className={styles.panel}>{panels[active]}</div>
  </div>
}
export function ThankYouLetterComposer({scope,events}:{scope:string;events:Array<{id:string;title:string;date:string;people:Array<{id:string;name:string}>}>}){
  const [shiftId,setShiftId]=useState(events[0]?.id||''),[message,setMessage]=useState('')
  const shift=events.find(e=>e.id===shiftId)
  return <DialogForm scope={scope} operation="recognize" submitLabel="Create & Send" disabled={!shiftId}>
    <input type="hidden" name="kind" value="letter"/>
    <label>Completed shift<select name="shiftId" value={shiftId} onChange={e=>{setShiftId(e.target.value);setMessage('')}} disabled={!events.length}>{events.length?events.map(e=><option key={e.id} value={e.id}>{e.title} · {e.date}</option>):<option value="">No verified shifts available</option>}</select></label>
    <label>Thank You Letter<textarea name="message" required maxLength={3000} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Tell the team what you noticed, how their work helped, and why it mattered."/></label>
    <button type="button" className={styles.textButton} onClick={()=>setMessage(`Thank you for giving your time to ${shift?.title || 'our program'}. We appreciate the care and effort you brought to this work.\n\nOne thing that stood out was…`)}>Help me get started</button>
  </DialogForm>
}
export function OnboardingSetupEditor({scope,initial,documents}:{scope:string;initial?:{onboardingMode:string;headline:string;welcome:string;waiverMethod:string;requireSession:number;documentIds:string};documents:Array<{id:string;title:string}>}){
  const [mode,setMode]=useState(initial?.onboardingMode||(scope==='organization'?'program':'organization'))
  let selected:string[]=[];try{selected=JSON.parse(initial?.documentIds||'[]')}catch{}
  return <DialogForm scope={scope} operation="onboarding" submitLabel="Save onboarding">
    <label>Onboarding approach<select name="mode" value={mode} onChange={e=>setMode(e.target.value)}>{scope!=='organization'?<option value="organization">Use the organization’s shared onboarding</option>:null}<option value="program">{scope==='organization'?'One shared welcome for the organization':'A welcome specific to this program'}</option><option value="none">No onboarding required</option></select></label>
    {mode==='program'?<>
      <label>Invitation headline<input name="headline" maxLength={180} defaultValue={initial?.headline} placeholder="Give people a reason to get involved."/></label>
      <label>Welcome message<textarea name="welcome" maxLength={2000} defaultValue={initial?.welcome} placeholder="Tell people who you help and how their time will make a difference."/></label>
      <label>How will waivers be received?<select name="waiverMethod" defaultValue={initial?.waiverMethod||'digital'}><option value="digital">Digital signature</option><option value="paper">Staff confirms a signed paper copy</option><option value="either">Digital signature or confirmed paper copy</option></select></label>
      <label className={styles.check}><input type="checkbox" name="requireSession" defaultChecked={Boolean(initial?.requireSession)}/>Require attendance at an onboarding session</label>
      {documents.length?<fieldset><legend>Documents to review before approval</legend>{documents.map(d=><label className={styles.check} key={d.id}><input type="checkbox" name="documentId" value={d.id} defaultChecked={selected.includes(d.id)}/>{d.title}</label>)}</fieldset>:null}
      <p className={styles.hint}>Active waivers for this welcome are included automatically. You review each candidate’s profile before approval.</p>
    </>:<>
      <input type="hidden" name="waiverMethod" value={initial?.waiverMethod||'digital'}/>
      <p className={styles.hint}>{mode==='organization'?'Use the welcome, documents, and approval process configured in the Organization program. Volunteers complete it once.':'Volunteers can join shifts without completing a program welcome. Existing city membership and participation restrictions still apply.'}</p>
    </>}
    <p className={styles.hint}>Existing roster members stay on the roster. You can change this approach later.</p>
  </DialogForm>
}
