'use client'

import { Check, Send, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { IntakeError, IntakeModal, useIntakeSave } from './VolunteerIntakeControls'
import styles from './ProgramWorkspace.module.css'
import intakeStyles from './VolunteerIntake.module.css'
import prototypeStyles from '../prototype.module.css'

type Candidate = {
  id: string
  name: string
  email: string
  roleTitles: string[]
  state: 'available' | 'invited' | 'reserved'
}

type SessionOption = {
  shiftId: string
  label: string
  candidates: Candidate[]
}

export function InviteOnboardingVolunteersButton({sessions}:{sessions:SessionOption[]}){
  const[open,setOpen]=useState(false)
  const[selected,setSelected]=useState<string[]>([])
  const[selectedShiftId,setSelectedShiftId]=useState(sessions[0]?.shiftId??'')
  const activeSession=sessions.find(session=>session.shiftId===selectedShiftId)??sessions[0]
  const candidates=activeSession?.candidates??[]
  const available=candidates.filter(candidate=>candidate.state==='available')
  const hasSessions=sessions.length>0
  const hasCandidates=sessions.some(session=>session.candidates.length>0)
  const hasAvailable=sessions.some(session=>session.candidates.some(candidate=>candidate.state==='available'))
  const invitationsComplete=hasSessions&&hasCandidates&&!hasAvailable
  const {save,pending,error}=useIntakeSave(()=>setOpen(false))
  function openPicker(){
    const firstAvailable=sessions.find(session=>session.candidates.some(candidate=>candidate.state==='available'))
    setSelectedShiftId(firstAvailable?.shiftId??sessions[0]?.shiftId??'')
    setSelected([])
    setOpen(true)
  }
  function toggle(id:string,checked:boolean){setSelected(current=>checked?[...current,id]:current.filter(value=>value!==id))}
  function send(){
    if(!activeSession)return
    const data=new FormData()
    data.set('operation','session-invite')
    data.set('shiftId',activeSession.shiftId)
    selected.forEach(userId=>data.append('userId',userId))
    void save(data)
  }
  return <>
    <button type="button" className={`${prototypeStyles.catalogWorkspaceAction} ${prototypeStyles.opportunityWorkspaceButton}`} onClick={openPicker}>{invitationsComplete?<><Check size={14}/>Invitations Sent</>:<><UsersRound size={14}/>Invite Volunteers</>}</button>
    {open?<IntakeModal title="Invite Volunteers" onClose={()=>setOpen(false)} busy={pending}>
      <form className={intakeStyles.form} onSubmit={event=>{event.preventDefault();send()}}>
        <p className={intakeStyles.hint}>Invite approved volunteers to this onboarding session. They will receive a notification and choose whether to reserve a spot.</p>
        {!hasSessions?<p className={intakeStyles.empty}>Add an upcoming onboarding date before inviting volunteers.</p>:!hasCandidates?<p className={intakeStyles.empty}>No approved volunteers are currently awaiting orientation.</p>:<>
          {sessions.length>1?<label>Session date<select value={activeSession?.shiftId??''} onChange={event=>{setSelectedShiftId(event.target.value);setSelected([])}}>{sessions.map(session=><option key={session.shiftId} value={session.shiftId}>{session.label}</option>)}</select></label>:<p className={styles.inviteSessionDate}><b>Session date</b><span>{activeSession?.label}</span></p>}
          <div className={styles.inviteVolunteerToolbar}><b>{selected.length} selected</b><button type="button" className={styles.button} disabled={pending||!available.length} onClick={()=>setSelected(selected.length===available.length?[]:available.map(candidate=>candidate.id))}>{selected.length===available.length&&available.length?'Clear selected':'Select all available'}</button></div>
          <fieldset className={styles.inviteVolunteerList} disabled={pending}>
            {candidates.map(candidate=><label key={candidate.id} className={styles.inviteVolunteerRow} data-unavailable={candidate.state!=='available'||undefined}>
              <input type="checkbox" checked={selected.includes(candidate.id)} disabled={candidate.state!=='available'} onChange={event=>toggle(candidate.id,event.target.checked)}/>
              <span aria-hidden="true">{candidate.name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'V'}</span>
              <span><b>{candidate.name}</b><small>{candidate.roleTitles.join(' · ')||candidate.email}</small></span>
              {candidate.state!=='available'?<em>{candidate.state==='reserved'?'Already reserved':'Already invited'}</em>:null}
            </label>)}
          </fieldset>
        </>}
        <IntakeError error={error}/>
        <footer className={intakeStyles.footer}><button type="button" className={intakeStyles.button} disabled={pending} onClick={()=>setOpen(false)}>{hasSessions&&hasCandidates?'Cancel':'Close'}</button>{hasSessions&&hasCandidates?<button type="submit" className={intakeStyles.button+' '+intakeStyles.primary} disabled={pending||!selected.length}><Send size={14}/>{pending?'Sending…':`Send Invitation${selected.length===1?'':'s'}`}</button>:null}</footer>
      </form>
    </IntakeModal>:null}
  </>
}
