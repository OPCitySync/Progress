import { get } from '@vercel/blob'
import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { onboardingApplications } from '@/lib/db/schema'
import { hasOrganizationPermission, validateActiveSession } from '@/lib/services/identity-access'
import { readPrivateLocalFile } from '@/lib/storage/storage'

export const dynamic = 'force-dynamic'
type FileData={name:string;url:string;type?:string}

function readFile(answers:string,key:string):FileData|null{
  try{const values=JSON.parse(answers) as Record<string,unknown>;const raw=values[key];if(typeof raw!=='string')return null;const file=JSON.parse(raw) as Record<string,unknown>;return typeof file.name==='string'&&typeof file.url==='string'?{name:file.name,url:file.url,type:typeof file.type==='string'?file.type:undefined}:null}catch{return null}
}

export async function GET(request:NextRequest,{params}:{params:{applicationId:string;kind:string}}){
  const key=params.kind==='resume'?'__resumeFile':params.kind==='cover-letter'?'__coverLetterFile':null
  if(!key)return new NextResponse('Not found',{status:404})
  const application=(await db.select().from(onboardingApplications).where(eq(onboardingApplications.id,params.applicationId)).limit(1))[0]
  if(!application)return new NextResponse('Not found',{status:404})
  const rawSession=await getSession(),session=rawSession?await validateActiveSession(rawSession):null
  const authorized=session?.sub===application.userId||(session?.role==='issuer'&&session.orgId===application.orgId&&await hasOrganizationPermission(session,'participants.manage'))
  if(!authorized)return new NextResponse('Not found',{status:404})
  const file=readFile(application.answers,key)
  if(!file)return new NextResponse('Not found',{status:404})
  const name=file.name.replace(/[\r\n"]/g,'_')
  if(file.url.startsWith('local-private:')){
    const bytes=await readPrivateLocalFile(file.url)
    if(!bytes)return new NextResponse('Not found',{status:404})
    return new NextResponse(new Uint8Array(bytes),{headers:{'Content-Type':file.type||'application/octet-stream','Content-Disposition':`inline; filename="${name}"`,'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-cache'}})
  }
  const result=await get(file.url,{access:'private',ifNoneMatch:request.headers.get('if-none-match')??undefined})
  if(!result)return new NextResponse('Not found',{status:404})
  if(result.statusCode===304)return new NextResponse(null,{status:304,headers:{ETag:result.blob.etag,'Cache-Control':'private, no-cache'}})
  if(result.statusCode!==200||!result.stream)return new NextResponse('Not found',{status:404})
  return new NextResponse(result.stream,{headers:{'Content-Type':result.blob.contentType||file.type||'application/octet-stream','Content-Disposition':`inline; filename="${name}"`,'X-Content-Type-Options':'nosniff',ETag:result.blob.etag,'Cache-Control':'private, no-cache'}})
}
