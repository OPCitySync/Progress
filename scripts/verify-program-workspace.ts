/** Regression checks use a disposable copy; never write to a working database. */
import assert from 'node:assert/strict'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {execFileSync} from 'node:child_process'

async function main(){
  const directory=mkdtempSync(join(tmpdir(),'citysync-workspace-check-'))
  const source=resolve(process.argv[2]||'local.db')
  const database=join(directory,'app.db')
  execFileSync('sqlite3',[source,'.backup '+JSON.stringify(database)])
  process.env.DATABASE_URL='file:'+database
  delete process.env.DATABASE_AUTH_TOKEN
  const {db,client}=await import('../src/lib/db/client')
  const s=await import('../src/lib/db/schema')
  const {and,eq}=await import('drizzle-orm')
  const {programWorkspaceDDL}=await import('../src/lib/db/program-workspace-schema')
  const {programPolicy,programAccessError,candidateReadiness,onboardingMaterials,registerProgramCandidate,recordCandidateSubmission}=await import('../src/lib/services/program-workspace')
  const {createTask,assignVolunteersToShift}=await import('../src/lib/services/opportunities')
  const {createVolunteerProgram}=await import('../src/lib/services/volunteer-programs')
  const {getRoster}=await import('../src/lib/services/roster')
  const {createWaiverVersion}=await import('../src/lib/services/waivers')
  for(const statement of programWorkspaceDDL)await client.execute(statement)
  for(const statement of (await import('../src/lib/db/volunteer-intake-schema')).volunteerIntakeDDL)await client.execute(statement)
  const now=Date.now(),orgId='qa-workspace-org',userId='qa-workspace-person'
  await db.insert(s.users).values({id:userId,name:'Test Volunteer',email:'workspace-test@example.invalid',passwordHash:'not-a-login',role:'participant',createdAt:now})
  await db.insert(s.orgs).values({id:orgId,name:'Workspace test organization',type:'issuer',status:'approved',ownerUserId:userId,createdAt:now,requestedCityId:'berkeley'})
  const program=await createVolunteerProgram({orgId,actorId:userId,name:'Test program',description:'Isolated test'})
  assert.ok(program.ok);
  const second=await createVolunteerProgram({orgId,actorId:userId,name:'Other program',description:'Isolated test'})
  assert.ok(second.ok);
  await db.insert(s.programWorkspaceSettings).values({id:'qa-shared',orgId,scope:'organization',onboardingMode:'program',waiverMethod:'either',updatedAt:now})
  assert.equal((await programPolicy(orgId,program.id))?.scope,'organization','program inherits shared welcome')
  await db.update(s.programWorkspaceSettings).set({onboardingMode:'none'}).where(eq(s.programWorkspaceSettings.id,'qa-shared'))
  assert.equal((await programPolicy(orgId,program.id))?.onboardingMode,'none','shared no-onboarding choice is inherited')
  assert.equal(await programAccessError(orgId,program.id,userId),null,'explicit no-onboarding permits participation')
  await db.insert(s.programWorkspaceSettings).values({id:'qa-specific',orgId,scope:program.id,onboardingMode:'program',waiverMethod:'either',documentIds:'["qa-document"]',updatedAt:now})
  await db.insert(s.programWorkspaceSettings).values({id:'qa-other',orgId,scope:second.id,onboardingMode:'program',waiverMethod:'digital',updatedAt:now})
  const waiver=await createWaiverVersion({orgId,actorId:userId,programId:program.id,title:'Nonbinding test placeholder',body:'TEST ONLY. This fixture is not an agreement.'})
  assert.ok(waiver.ok);
  await db.insert(s.organizationDocuments).values({id:'qa-document',orgId,programId:program.id,category:'guide',title:'Test guide',body:'Test instructions',createdByUserId:userId,createdAt:now,updatedAt:now})
  await db.transaction(tx=>registerProgramCandidate(tx,orgId,program.id,userId))
  assert.equal((await candidateReadiness(orgId,program.id,userId)).complete,false,'unsigned/unreceived requirements block completion')
  assert.notEqual(await programAccessError(orgId,program.id,userId),null,'candidate cannot bypass review')
  assert.equal((await onboardingMaterials(orgId,second.id)).waivers.length,0,'another program waiver is not included')
  await db.update(s.programApplicants).set({paperWaiverConfirmedAt:now,paperWaiverIds:JSON.stringify([waiver.id])}).where(and(eq(s.programApplicants.userId,userId),eq(s.programApplicants.scope,program.id)))
  await db.insert(s.programDocumentReceipts).values({id:'qa-receipt',orgId,userId,documentId:'qa-document',documentUpdatedAt:now,receivedAt:now})
  assert.equal((await candidateReadiness(orgId,program.id,userId)).complete,true,'paper waiver and document receipt satisfy requirements')
  await db.update(s.organizationDocuments).set({updatedAt:now+1}).where(eq(s.organizationDocuments.id,'qa-document'))
  assert.equal((await candidateReadiness(orgId,program.id,userId)).complete,false,'a changed document requires a new receipt')
  await db.insert(s.programDocumentReceipts).values({id:'qa-receipt-v2',orgId,userId,documentId:'qa-document',documentUpdatedAt:now+1,receivedAt:now+1})
  const secondWaiver=await createWaiverVersion({orgId,actorId:userId,programId:program.id,title:'Second nonbinding test placeholder',body:'TEST ONLY. Not a legal agreement.'})
  assert.ok(secondWaiver.ok);
  assert.equal((await candidateReadiness(orgId,program.id,userId)).complete,false,'new waiver is not covered by an older paper attestation')
  await db.update(s.programApplicants).set({paperWaiverIds:JSON.stringify([waiver.id,secondWaiver.id])}).where(and(eq(s.programApplicants.userId,userId),eq(s.programApplicants.scope,program.id)))
  assert.equal((await recordCandidateSubmission(orgId,program.id,userId)).ok,true,'complete checklist can request review')
  assert.equal((await getRoster(orgId)).volunteers.length,0,'submission does not silently add candidate to roster')
  await db.update(s.programApplicants).set({status:'approved',reviewedAt:now+2,reviewedBy:userId}).where(and(eq(s.programApplicants.userId,userId),eq(s.programApplicants.scope,program.id)))
  await db.insert(s.volunteerRosterMembers).values({id:'qa-approved-member',orgId,userId,source:'approval',invitedByUserId:userId,joinedAt:now+2})
  assert.equal(await programAccessError(orgId,program.id,userId),null,'approved candidate can join their program')
  assert.notEqual(await programAccessError(orgId,second.id,userId),null,'approval does not grant another program approval')
  const {appendEvent}=await import('../src/lib/ledger/ledger')
  await db.transaction(tx=>appendEvent(tx,'PROGRAM_ONBOARDING_CONFIGURED',{orgId,programId:second.id,mode:'program'},userId))
  await db.update(s.volunteerRosterMembers).set({joinedAt:Date.now()+100}).where(eq(s.volunteerRosterMembers.id,'qa-approved-member'))
  await db.update(s.programWorkspaceSettings).set({updatedAt:Date.now()+1000,headline:'Edited welcome'}).where(eq(s.programWorkspaceSettings.id,'qa-other'))
  assert.notEqual(await programAccessError(orgId,second.id,userId),null,'editing a welcome does not grandfather a newer member past review')
  assert.equal((await getRoster(orgId)).volunteers.length,1,'approved explicit member appears without prior claims')
  const scheduled=await createTask({orgId,actorId:userId,cityId:'berkeley',programId:program.id,title:'Test shift-first position',description:'Isolated test',location:'Test room',credits:10,slots:2,defaultDurationMinutes:90,startsAt:'',initialShift:{startsAt:now+86400000,capacity:2,durationMinutes:90,visibility:'private',recurring:false}})
  assert.ok(scheduled.ok);if(!scheduled.ok||!scheduled.shiftId)throw Error('Shift creation failed')
  const task=(await db.select().from(s.tasks).where(eq(s.tasks.id,scheduled.id)))[0]
  assert.equal(task.slots,2);assert.equal(task.defaultDurationMinutes,90)
  const assignment=await assignVolunteersToShift({orgId,actorId:userId,shiftId:scheduled.shiftId,userIds:[userId]})
  assert.ok(assignment.ok,'newly approved roster member can be assigned without prior claims')
  await db.insert(s.organizationDelegations).values({id:'qa-staff',identityId:'qa-staff-identity',userId,orgId,role:'member',status:'active',grantedByUserId:userId,createdAt:now+3,updatedAt:now+3})
  assert.equal((await getRoster(orgId)).volunteers.length,0,'staff status overrides volunteer membership')
  assert.equal((await assignVolunteersToShift({orgId,actorId:userId,shiftId:scheduled.shiftId,userIds:[userId]})).ok,false,'staff cannot be assigned as volunteers')
  const ledger=await db.select().from(s.events).where(eq(s.events.type,'PROGRAM_APPLICATION_SUBMITTED'))
  assert.ok(ledger.length,'application submission has an audit record')
  client.close()
  console.log('PASS: program-workspace regression checks (shared/program/none policies, requirement versions, approval, roster, shift-first reuse, assignment, staff precedence, audit record).')
  console.log('Disposable test database: '+database)
}
main().catch(error=>{console.error(error);process.exitCode=1})
