'use client'
import {useRef,useState} from 'react'
import {useRouter} from 'next/navigation'
import {workspaceLegacyAction} from './workspace-legacy-action'
export function useWorkspaceSave(operation:string,onSaved:()=>void){
  const router=useRouter(),busy=useRef(false)
  const [pending,setPending]=useState(false),[error,setError]=useState('')
  async function submit(data:FormData){
    if(busy.current)return
    busy.current=true;setPending(true);setError('')
    try{
      const result=await workspaceLegacyAction(operation,data)
      if(!result.ok){setError(result.error);return}
      onSaved()
      if(result.destination)router.push(result.destination)
      router.refresh()
    }catch{setError('Unable to save. Please try again.')}finally{busy.current=false;setPending(false)}
  }
  return {submit,pending,error}
}
