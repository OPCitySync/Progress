import { transitionIssuerHome, moveCalendar } from './issuer-home-model.js';
import { homeHistory, homeNoteDialog } from './issuer-home-view.js';
import { today } from './passport-model.js';
import { planningMonday } from './planning-model.js';

export function bindIssuerHome({context,render,commit,showDialog,closeDialog,navigate,toast}) {
  const active=()=>context().ui.mode==='coordinator'&&['calendar','feed'].includes(context().ui.page);
  function apply(action) {
    try {commit(transitionIssuerHome(context().state,{...action,actor:context().ui.mode}));return true;}
    catch(error){const output=document.querySelector('#dialog[open] .form-error');if(output){output.textContent=error.message;output.focus();}else toast(error.message);return false;}
  }
  document.addEventListener('click',event=>{
    const b=event.target.closest('[data-home-action]');if(!b||b.disabled||!active())return;
    const {ui,state}=context(),h=ui.home,d=b.dataset;
    switch(d.homeAction) {
      case 'collapse':h.queueCollapsed=!h.queueCollapsed;render();document.querySelector('[data-home-action="collapse"]')?.focus();break;
      case 'queueAll':h.queueAll=!h.queueAll;render();document.querySelector('#home-queue-title')?.focus();break;
      case 'acknowledge':if(apply({type:'acknowledge',key:d.key}))document.querySelector('#home-queue-title')?.focus();break;
      case 'history':showDialog('Action history',homeHistory(context()),true);break;
      case 'restore':if(apply({type:'restore',key:d.key}))showDialog('Action history',homeHistory(context()),true);break;
      case 'view':h.period=d.view;h.day='';h.selectedEntry='';render();break;
      case 'period':h.anchor=moveCalendar(h.anchor,h.period,Number(d.direction));h.day='';h.selectedEntry='';render();break;
      case 'today':h.anchor=today();h.day='';h.selectedEntry='';render();break;
      case 'day':h.day=d.date;h.selectedEntry=d.entry||'';render();document.querySelector('#home-day-title')?.focus({preventScroll:true});document.querySelector('.home-calendar')?.scrollIntoView({block:'start'});break;
      case 'back':h.day='';h.selectedEntry='';render();break;
      case 'note':showDialog(d.id?'Edit organization note':'Add calendar note',homeNoteDialog(context(),d.id,d.date),true);break;
      case 'conversation':ui.messageActivity=d.id;navigate('messages',d.id);break;
      case 'planning':{const a=state.activities.find(a=>a.id===d.id);ui.planning={...ui.planning,mode:a.programId?'programs':a.type==='event'?'events':'recurring',programId:a.programId||'',start:planningMonday(a.date),weeks:'2',personId:''};navigate('planning');break;}
    }
  });
  document.addEventListener('submit',event=>{
    const form=event.target.closest('[data-home-form]');if(!form||!active())return;event.preventDefault();
    const values=Object.fromEntries(new FormData(form));
    if(apply({type:'saveNote',id:form.dataset.id,...values})){const h=context().ui.home;h.anchor=values.start.slice(0,10);h.day=h.anchor;closeDialog();render();}
  });
}
