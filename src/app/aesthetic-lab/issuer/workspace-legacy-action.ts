'use server'
import {isRedirectError,getURLFromRedirectError} from 'next/dist/client/components/redirect'
import {createOnboardingSessionAction,createOrganizationDocumentAction,createWaiverAction,createVolunteerProgramAction,scheduleNewShiftAction,updateVolunteerProgramSettingsAction,publishTemplateEventAction,publishOnboardingSessionAction,updateOnboardingSessionAction} from '@/app/actions'
const handlers={session:createOnboardingSessionAction,document:createOrganizationDocumentAction,waiver:createWaiverAction,program:createVolunteerProgramAction,shift:scheduleNewShiftAction,settings:updateVolunteerProgramSettingsAction,publishShift:publishTemplateEventAction,publishWelcome:publishOnboardingSessionAction,manageWelcome:updateOnboardingSessionAction}
export async function workspaceLegacyAction(operation:string,data:FormData){
  const handler=handlers[operation as keyof typeof handlers]
  if(!handler)return {ok:false as const,error:'Unknown workspace action.'}
  try{await handler(data);return {ok:true as const,destination:null}}
  catch(error){
    if(isRedirectError(error)){
      const destination=getURLFromRedirectError(error)
      if(!destination||!destination.startsWith('/')||destination.startsWith('//'))return {ok:false as const,error:'Unable to return to the workspace.'}
      const url=new URL(destination,'http://localhost')
      if(url.searchParams.has('error'))return {ok:false as const,error:url.searchParams.get('error')||'Unable to save.'}
      return {ok:true as const,destination}
    }
    console.error('Workspace form could not save',error)
    return {ok:false as const,error:'Your changes could not be saved. Please try again.'}
  }
}
