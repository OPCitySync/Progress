import { planningProblem, transitionPlanning, planningActivities } from './planning-model.js';
import { planningRoster, planningInviteDialog, planningCard } from './planning-view.js';
export function bindPlanning({context,render,commit,showDialog,closeDialog,toast,create}) {
  let drag=null, suppressClick=false;
  const active=()=>context().ui.mode==='coordinator'&&context().ui.page==='planning';
  const clearDrag=()=>document.querySelectorAll('[data-plan-drop]').forEach(el=>{delete el.dataset.dragOver;delete el.dataset.denied;});
  function apply(action){
    try{const result=transitionPlanning(context().state,{...action,actor:context().ui.mode});commit(result);closeDialog();return true;}
    catch(error){const out=document.querySelector('#dialog[open] .form-error');if(out){out.textContent=error.message;out.focus();}else toast(error.message);return false;}
  }
  function invite(activityId,personId=context().ui.planning.personId){
    if(!active())return;
    const ctx=context(),problem=planningProblem(ctx.state,personId,activityId);
    if(problem){toast(problem);return;}
    const a=ctx.state.activities.find(a=>a.id===activityId);
    if(a.roles.length===1){apply({type:'invite',activityId,personId,roleId:a.roles[0].id});return;}
    showDialog('Choose a role for this invitation',planningInviteDialog(ctx,activityId,personId));
  }
  document.addEventListener('click',event=>{
    const b=event.target.closest('[data-plan-action]');if(!b||b.disabled||!active())return;
    if(suppressClick){event.preventDefault();return;}
    const ctx=context(),p=ctx.ui.planning,d=b.dataset;
    switch(d.planAction){
      case 'person':p.personId=p.personId===d.person?'':d.person;render();break;
      case 'clear':p.personId='';render();break;
      case 'mode':p.mode=d.mode;p.programId='';render();break;
      case 'program':p.programId=d.program;render();break;
      case 'back':p.programId='';render();break;
      case 'invite':invite(d.activity);break;
      case 'create':create(p.mode==='events'?'event':p.mode==='recurring'?'shift':undefined,p.programId);break;
      case 'print':{const items=planningActivities(ctx.state,p),program=ctx.state.programWorkspace.programs.find(x=>x.id===p.programId);showDialog('Printable planning summary',`<div class="dialog-body"><div class="passport-print-sheet planning-print"><span class="eyebrow">BERKELEY NEIGHBORS · PLANNING</span><h2>${ctx.e(program?.name||({programs:'All programs',events:'One-Time Activities',recurring:'Recurring Activities'})[p.mode])}</h2><p>All dates · Sorted by date · Confirmed and invited places remain separate.</p>${items.map(a=>planningCard({...ctx,ui:{...ctx.ui,planning:{...p,personId:''}}},a)).join('')||'<p>No work in this view.</p>'}</div></div><div class="dialog-footer">${ctx.button('Close','close','','btn secondary')}${ctx.button('Print / Save PDF','ppPrintNow','','btn primary')}</div>`,true);break;}
      case 'remove':{const c=ctx.state.commitments.find(c=>c.id===d.commitment),a=ctx.state.activities.find(a=>a.id===c?.activityId),person=ctx.state.people.find(v=>v.id===c?.personId);if(!c||!a||!person)return;const label=c.status==='proposed'?'Withdraw invitation':'Remove from this date';showDialog(label,`<form data-plan-form="remove" data-commitment="${ctx.e(c.id)}"><div class="dialog-body"><p><strong>${ctx.e(person.name)}</strong> · ${ctx.e(a.title)}</p><p>This changes only this activity’s place and leaves a local update for the volunteer. Other commitments are preserved.</p><label>Note to the volunteer · optional<textarea name="note" maxlength="400"></textarea></label><p class="form-error" role="alert" tabindex="-1"></p></div><div class="dialog-footer">${ctx.button('Keep place','close','','btn secondary')}<button type="submit" class="btn primary">${label}</button></div></form>`);break;}
    }
  });
  document.addEventListener('input',event=>{if(!active()||event.target.id!=='planning-search')return;context().ui.planning.query=event.target.value;document.querySelector('#planning-roster-list').innerHTML=planningRoster(context());});
  document.addEventListener('submit',event=>{
    const form=event.target.closest('[data-plan-form]');if(!form||!active())return;event.preventDefault();const values=new FormData(form),d=form.dataset;
    if(d.planForm==='invite')apply({type:'invite',activityId:d.activity,personId:d.person,roleId:values.get('roleId')});
    if(d.planForm==='remove')apply({type:'remove',commitmentId:d.commitment,note:values.get('note')});
  });
  // Pointer dragging also works in embedded browsers where native HTML drops differ.
  document.addEventListener('dragstart',event=>{if(event.target.closest('.planning-person'))event.preventDefault();});
  document.addEventListener('pointerdown',event=>{
    const source=event.target.closest('.planning-person[draggable="true"]');
    if(!source||!active()||event.button!==0||event.pointerType==='touch')return;
    drag={source,person:source.dataset.person,x:event.clientX,y:event.clientY,id:event.pointerId,moving:false};
    source.setPointerCapture(event.pointerId);
  });
  document.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.id)return;
    if(!drag.moving&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<6)return;
    drag.moving=true;drag.source.classList.add('dragging');event.preventDefault();clearDrag();
    const card=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-plan-drop]');
    if(card){card.dataset.dragOver='true';card.dataset.denied=planningProblem(context().state,drag.person,card.dataset.planDrop)?'true':'false';}
  });
  function finishDrag(event,canceled=false){
    if(!drag||event.pointerId!==drag.id)return;
    const current=drag;drag=null;current.source.classList.remove('dragging');clearDrag();
    if(current.source.hasPointerCapture(current.id))current.source.releasePointerCapture(current.id);
    if(!current.moving)return;
    suppressClick=true;setTimeout(()=>{suppressClick=false;},0);
    if(canceled||!active())return;
    context().ui.planning.personId=current.person;
    const card=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-plan-drop]');
    render();if(card)invite(card.dataset.planDrop,current.person);
  }
  document.addEventListener('pointerup',event=>finishDrag(event));
  document.addEventListener('pointercancel',event=>finishDrag(event,true));
}
