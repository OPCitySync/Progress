/** Disposable regression data only; never mutates the source database. */
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

async function main(){
  const directory=mkdtempSync(join(tmpdir(),'citysync-intake-check-')),database=join(directory,'app.db')
  execFileSync('sqlite3',[resolve(process.argv[2]||'local.db'),'.backup '+JSON.stringify(database)])
  process.env.DATABASE_URL='file:'+database
  delete process.env.DATABASE_AUTH_TOKEN
  process.env.CITY_DB_BERKELEY_URL='file:'+join(directory,'city.db')
  const {db,client}=await import('../src/lib/db/client'),s=await import('../src/lib/db/schema'),{eq,and}=await import('drizzle-orm')
  const {volunteerIntakeDDL}=await import('../src/lib/db/volunteer-intake-schema')
  const {programWorkspaceDDL}=await import('../src/lib/db/program-workspace-schema')
  for(const statement of [...programWorkspaceDDL,...volunteerIntakeDDL])await client.execute(statement)
  try{await client.execute('ALTER TABLE onboarding_application_forms ADD COLUMN archived_at INTEGER')}catch{}
  const v=await import('../src/lib/services/volunteer-intake')
  const {registerOrg,registerParticipant}=await import('../src/lib/services/identity')
  const {createVolunteerProgram}=await import('../src/lib/services/volunteer-programs')
  const {publishOnboardingSession}=await import('../src/lib/services/onboarding-session')
  const {checkClaimGate,claimShift}=await import('../src/lib/services/opportunities')
  const {programAccessError}=await import('../src/lib/services/program-workspace')
  const {getRoster}=await import('../src/lib/services/roster')
  const {createWaiverVersion,getOnboardingWaiverSetup}=await import('../src/lib/services/waivers')
  const password='Intake-QA-2026!'
  const owner=await registerOrg({orgName:'Onboarding QA Organization',orgType:'issuer',description:'Disposable test organization',address:'100 Test Way',name:'Casey Intake QA',email:'intake-owner@example.invalid',password,cityId:'berkeley'})
  assert.ok(owner.ok);if(!owner.ok)throw Error('Owner setup failed')
  const orgId=owner.orgId,actorId=owner.userId
  await db.update(s.orgs).set({status:'approved'}).where(eq(s.orgs.id,orgId))
  await db.insert(s.cityMemberships).values({id:crypto.randomUUID(),cityId:'berkeley',memberKind:'organization',memberId:orgId,joinedAt:Date.now()}).onConflictDoNothing()
  // The test owner opens in issuer context through the normal login flow.
  await db.update(s.users).set({role:'issuer',orgId}).where(eq(s.users.id,actorId))
  const program=await createVolunteerProgram({orgId,actorId,name:'Community Kitchen',description:'A test program'})
  const other=await createVolunteerProgram({orgId,actorId,name:'Park Care',description:'Another test program'})
  assert.ok(program.ok&&other.ok);if(!program.ok||!other.ok)throw Error('Programs failed')
  async function person(name:string,email:string){const p=await registerParticipant({name,email,password,homeCityId:'berkeley'});assert.ok(p.ok);if(!p.ok)throw Error('Participant setup failed');return p.userId}
  const userId=await person('Taylor Intake QA','intake-regression@example.invalid')
  const input={orgId,cityId:'berkeley',actorId,title:'Meet the Community Kitchen',location:'100 Test Way',description:'Get to know our kitchen team and volunteer work.',notes:'Bring comfortable shoes. Meet at the front door.',capacity:'2',duration:90,assignmentMode:'specific',programIds:[program.id]}
  const made=await v.createVolunteerIntake(input);assert.ok(made.ok);if(!made.ok)throw Error('Intake setup failed')
  const taskId=made.taskId
  assert.equal((await db.select().from(s.shifts).where(eq(s.shifts.taskId,taskId))).length,0,'creating a session does not publish a date')
  assert.equal((await v.createVolunteerIntake({...input,programIds:['not-your-program']})).ok,false,'foreign program blocked')
  assert.equal((await v.createVolunteerIntake({...input,capacity:'15'})).ok,false,'invalid capacity blocked')
  const flexible=await v.createVolunteerIntake({...input,title:'Organization Welcome',assignmentMode:'all',programIds:[],capacity:'flexible',duration:30})
  assert.ok(flexible.ok);if(!flexible.ok)throw Error('Flexible intake setup failed')
  assert.equal((await db.select().from(s.tasks).where(eq(s.tasks.id,flexible.taskId)))[0].slots,10,'flexible is internally capped at ten')
  const questions=[{id:'motivation',label:'Why would you like to volunteer?',type:'long' as const,required:true,options:[]},{id:'availability',label:'Which time works best?',type:'choice' as const,required:true,options:['Morning','Afternoon']},{id:'experience',label:'Have you volunteered before?',type:'yes_no' as const,required:false,options:[]}]
  assert.equal((await v.saveIntakeApplicationForm({orgId,actorId,taskId,introduction:'Tell us a little about yourself.',questions,required:true})).ok,true)
  const form=(await v.getIntakeForm(taskId)).form!
  assert.equal((await v.intakeReservationGate(taskId,userId)).ok,false,'application gate before submission')
  assert.equal((await v.submitIntakeApplication({taskId,userId,formId:form.id,answers:{}})).ok,false,'required answers enforced')
  assert.equal((await v.submitIntakeApplication({taskId,userId,formId:'stale-form',answers:{motivation:'Help',availability:'Morning'}})).ok,false,'stale application rejected')
  assert.equal((await v.submitIntakeApplication({taskId,userId:actorId,formId:form.id,answers:{motivation:'Help',availability:'Morning'}})).ok,false,'staff cannot apply')
  assert.equal((await v.submitIntakeApplication({taskId,userId,formId:form.id,answers:{motivation:'PRIVATE-QA-ANSWER',availability:'Morning'}})).ok,true)
  const application=(await db.select().from(s.onboardingApplications).where(and(eq(s.onboardingApplications.taskId,taskId),eq(s.onboardingApplications.userId,userId))))[0]
  assert.equal((await v.intakeReservationGate(taskId,userId)).ok,false,'pending application cannot reserve')
  assert.equal((await getRoster(orgId)).volunteers.some(p=>p.userId===userId),false,'application is not roster membership')
  const acceptance={acceptanceSubject:'Welcome to the team',acceptanceMessage:'PRIVATE-ACCEPTANCE-LETTER'}
  const review={orgId,actorId,applicationId:application.id,decision:'approved',internalNote:'PRIVATE-QA-NOTE',confirmed:true,...acceptance}
  assert.equal((await v.reviewIntakeApplication({...review,orgId:'another-org'})).ok,false,'cross-org review denied')
  assert.equal((await v.reviewIntakeApplication({...review,confirmed:false})).ok,false,'review confirmation required')
  assert.equal((await v.reviewIntakeApplication(review)).ok,true)
  assert.equal((await v.intakeReservationGate(taskId,userId)).ok,true,'approved application may reserve')
  assert.notEqual(await programAccessError(orgId,program.id,userId),null,'application approval does not grant regular shifts')
  const start=Date.now()+2*86400000
  assert.equal((await publishOnboardingSession({orgId,actorId,taskId,startsAt:start,recurring:false})).ok,true)
  assert.equal((await publishOnboardingSession({orgId,actorId,taskId,startsAt:start,recurring:false})).ok,false,'duplicate date blocked')
  const shift=(await db.select().from(s.shifts).where(eq(s.shifts.taskId,taskId)))[0]
  assert.equal(shift.capacity,2);assert.equal(shift.endsAt!-shift.startsAt!,90*60000,'published duration matches wizard')
  const reserved=await claimShift(shift.id,userId)
  assert.ok(reserved.ok,'approved applicant can reserve: '+JSON.stringify(reserved))
  const claim=(await db.select().from(s.claims).where(and(eq(s.claims.shiftId,shift.id),eq(s.claims.userId,userId))))[0]
  assert.equal((await getRoster(orgId)).volunteers.some(p=>p.userId===userId),false,'reservation is not roster approval')
  const decision={orgId,actorId,claimId:claim.id,decision:'approved',assignmentMode:'specific',programIds:[program.id],paperWaiverIds:[] as string[],documentIds:[] as string[],internalNote:'PRIVATE-QA-NOTE',confirmed:true,confirmRestriction:false}
  assert.equal((await v.saveVolunteerAdmission(decision)).ok,false,'cannot approve before attendance')
  await db.update(s.shifts).set({startsAt:Date.now()-7200000,endsAt:Date.now()-1800000,status:'closed'}).where(eq(s.shifts.id,shift.id))
  await db.update(s.claims).set({status:'verified',checkedInAt:Date.now()-7000000}).where(eq(s.claims.id,claim.id))
  const waiver=await createWaiverVersion({orgId,actorId,programId:program.id,title:'Nonbinding QA receipt',body:'TEST DATA ONLY. This is not an agreement.'});assert.ok(waiver.ok);if(!waiver.ok)throw Error('Waiver setup failed')
  assert.equal((await getOnboardingWaiverSetup(orgId,(await db.select().from(s.tasks).where(eq(s.tasks.id,taskId)))[0])).waivers.length,1,'intake waivers follow selected programs')
  assert.equal((await v.saveVolunteerAdmission(decision)).ok,false,'missing waiver blocks approval')
  assert.equal((await v.saveVolunteerAdmission({...decision,decision:'needs_paperwork'})).ok,true)
  assert.equal((await v.listIntakeReviews(orgId,'berkeley')).candidates.some(c=>c.user.id===userId),true,'attendee appears for review')
  assert.equal((await v.saveVolunteerAdmission({...decision,paperWaiverIds:[waiver.id]})).ok,true,'staff paper receipt and approval')
  assert.equal((await getRoster(orgId)).volunteers.some(p=>p.userId===userId),true,'approved attendee is in roster')
  assert.equal(await programAccessError(orgId,program.id,userId),null,'specific program allowed')
  assert.notEqual(await programAccessError(orgId,other.id,userId),null,'other program not silently allowed')
  assert.equal((await v.saveVolunteerAdmission({...decision,assignmentMode:'all',programIds:[]})).ok,true)
  assert.equal(await programAccessError(orgId,other.id,userId),null,'all-program approval includes other programs')
  assert.equal((await v.saveVolunteerAdmission({...decision,decision:'not_approved'})).ok,false,'decline impact confirmation required')
  assert.equal((await v.saveVolunteerAdmission({...decision,decision:'not_approved',confirmRestriction:true})).ok,true)
  assert.equal((await getRoster(orgId)).volunteers.some(p=>p.userId===userId),false,'declined person removed from current roster')
  assert.equal((await db.select().from(s.claims).where(eq(s.claims.id,claim.id)))[0].status,'verified','decision preserves attendance')
  assert.equal((await v.intakeReservationGate(flexible.taskId,userId)).ok,false,'org decision also guards onboarding')
  assert.equal((await v.saveVolunteerAdmission({...decision,assignmentMode:'all',programIds:[]})).ok,true,'org can reconsider')
  assert.equal((await v.saveIntakeApplicationForm({orgId,actorId,taskId,introduction:'Updated questions',questions:[...questions,{id:'extra',label:'Anything else?',type:'short',required:false,options:[]}],required:true})).ok,true)
  assert.equal((await v.getIntakeForm(taskId)).form!.version,2)
  assert.equal((await v.intakeReservationGate(taskId,userId)).ok,true,'new form version preserves existing approval')
  assert.equal((await db.select().from(s.onboardingApplications).where(eq(s.onboardingApplications.id,application.id)))[0].formId,form.id,'submitted answers retain original questions')
  const roleId=crypto.randomUUID(),roleApplicantId=await person('Morgan Role QA','role-applicant@example.invalid')
  await db.insert(s.tasks).values({id:roleId,orgId,cityId:'berkeley',title:'Profile Review Role',description:'A role that uses Apply without custom questions.',location:'100 Test Way',credits:5,slots:2,startsAt:'',status:'open',programId:program.id,isOnboarding:0,createdBy:actorId,createdAt:Date.now()})
  assert.equal((await v.setRolePublication({orgId,actorId,taskId:roleId,published:true})).ok,true,'profile-only role published')
  assert.equal((await v.getIntakeForm(roleId)).form,null,'profile-only Apply does not require a custom form')
  assert.equal((await v.submitIntakeApplication({taskId:roleId,userId:roleApplicantId,formId:'',answers:{}})).ok,true,'profile-only Apply submitted')
  const roleApplication=(await db.select().from(s.onboardingApplications).where(and(eq(s.onboardingApplications.taskId,roleId),eq(s.onboardingApplications.userId,roleApplicantId))))[0]
  assert.ok(roleApplication.formId.startsWith('profile-review:'),'profile-only request uses an internal form record')
  assert.equal((await v.intakeReservationGate(roleId,roleApplicantId)).ok,false,'profile-only request still requires approval')
  assert.equal((await v.reviewIntakeApplication({orgId,actorId,applicationId:roleApplication.id,decision:'approved',internalNote:'',confirmed:true,...acceptance})).ok,true,'profile-only application can be approved')
  assert.equal((await v.intakeReservationGate(roleId,roleApplicantId)).ok,true,'approved profile-only applicant can reserve')
  const rejectedApplicantId=await person('Riley Rejection QA','rejection-letter@example.invalid')
  assert.equal((await v.submitIntakeApplication({taskId:roleId,userId:rejectedApplicantId,formId:'',answers:{}})).ok,true,'rejection fixture can apply')
  const rejectedApplication=(await db.select().from(s.onboardingApplications).where(and(eq(s.onboardingApplications.taskId,roleId),eq(s.onboardingApplications.userId,rejectedApplicantId))))[0]
  const rejectedReview={orgId,actorId,applicationId:rejectedApplication.id,decision:'not_approved',internalNote:'PRIVATE-REJECTION-NOTE',confirmed:true}
  assert.equal((await v.reviewIntakeApplication(rejectedReview)).ok,false,'rejection requires a participant-facing letter')
  assert.equal((await v.reviewIntakeApplication({...rejectedReview,rejectionSubject:'Update on your application',rejectionMessage:'PRIVATE-REJECTION-LETTER'})).ok,true,'rejection sends a letter')
  const rejectionLetters=await db.select({message:s.orgMessages,recipient:s.messageRecipients}).from(s.orgMessages).innerJoin(s.messageRecipients,eq(s.messageRecipients.messageId,s.orgMessages.id)).where(eq(s.messageRecipients.userId,rejectedApplicantId))
  assert.equal(rejectionLetters.length,1,'rejection creates one private message')
  assert.equal(rejectionLetters[0].message.body,'PRIVATE-REJECTION-LETTER','applicant receives the reviewer-authored letter')
  const acceptanceLetters=await db.select({message:s.orgMessages,recipient:s.messageRecipients}).from(s.orgMessages).innerJoin(s.messageRecipients,eq(s.messageRecipients.messageId,s.orgMessages.id)).where(eq(s.messageRecipients.userId,userId))
  assert.equal(acceptanceLetters.length,1,'approval creates one private message')
  assert.equal(acceptanceLetters[0].message.body,'PRIVATE-ACCEPTANCE-LETTER','approved applicant receives the reviewer-authored letter')
  const archiveRoleId=crypto.randomUUID()
  await db.insert(s.tasks).values({id:archiveRoleId,orgId,cityId:'berkeley',title:'Application Archive QA',description:'A role used to verify application archival.',location:'100 Test Way',credits:5,slots:2,startsAt:'',status:'open',programId:program.id,isOnboarding:0,createdBy:actorId,createdAt:Date.now()})
  const archiveQuestions=[{id:'interest',label:'Why are you interested?',type:'long' as const,required:true,options:[]}]
  assert.equal((await v.saveIntakeApplicationForm({orgId,actorId,taskId:archiveRoleId,introduction:'',questions:archiveQuestions,required:true})).ok,true)
  const firstArchiveForm=(await v.getIntakeForm(archiveRoleId)).form!
  assert.equal((await v.saveIntakeApplicationForm({orgId,actorId,taskId:archiveRoleId,introduction:'',questions:[...archiveQuestions,{id:'availability',label:'When can you help?',type:'short' as const,required:false,options:[]}],required:true})).ok,true)
  const secondArchiveForm=(await v.getIntakeForm(archiveRoleId)).form!
  assert.notEqual(secondArchiveForm.id,firstArchiveForm.id,'same role can retain multiple application templates')
  assert.equal((await v.publishIntakeApplicationForm({orgId,actorId,formId:secondArchiveForm.id})).ok,true,'a specific application template can be published')
  const publishedArchiveForm=await v.getIntakeForm(archiveRoleId)
  assert.equal(publishedArchiveForm.form?.id,secondArchiveForm.id,'publishing selects the requested application template')
  assert.equal(publishedArchiveForm.intake?.applicationPublic,1,'publishing opens the role application to participants')
  assert.equal((await v.unpublishIntakeApplicationForm({orgId,actorId,formId:secondArchiveForm.id})).ok,true,'a published application can be unpublished')
  assert.equal((await v.getIntakeForm(archiveRoleId)).intake?.applicationPublic,0,'unpublishing removes the application from public access')
  assert.equal((await v.publishIntakeApplicationForm({orgId,actorId,formId:secondArchiveForm.id})).ok,true,'an unpublished application can be published again')
  assert.equal((await v.archiveIntakeApplicationForm({orgId,actorId,formId:secondArchiveForm.id})).ok,true,'managed application can be archived')
  assert.equal((await v.getIntakeForm(archiveRoleId)).form?.id,firstArchiveForm.id,'deleting the active template restores the prior role template')
  assert.ok((await db.select().from(s.onboardingApplicationForms).where(eq(s.onboardingApplicationForms.id,secondArchiveForm.id)))[0].archivedAt,'deleted template remains available for historical answers')
  const invitationStartsAt=Date.now()+3*86400000
  assert.equal((await publishOnboardingSession({orgId,actorId,taskId,startsAt:invitationStartsAt,recurring:false})).ok,true,'future orientation available for invitations')
  const invitationShift=(await db.select().from(s.shifts).where(and(eq(s.shifts.taskId,taskId),eq(s.shifts.startsAt,invitationStartsAt))))[0]
  assert.equal((await v.inviteApprovedVolunteersToOnboardingSession({orgId,actorId,shiftId:invitationShift.id,userIds:[roleApplicantId]})).ok,true,'approved role applicant can be invited to orientation')
  const invitation=(await db.select().from(s.notifications).where(and(eq(s.notifications.userId,roleApplicantId),eq(s.notifications.kind,'onboarding_session_invitation'))))[0]
  assert.ok(invitation.link.includes(invitationShift.id),'orientation invitation links to the selected dated session')
  assert.equal((await v.inviteApprovedVolunteersToOnboardingSession({orgId,actorId,shiftId:invitationShift.id,userIds:[roleApplicantId]})).ok,false,'duplicate invitation is not sent')
  assert.equal((await v.inviteApprovedVolunteersToOnboardingSession({orgId,actorId,shiftId:invitationShift.id,userIds:[actorId]})).ok,false,'organization staff cannot be invited as volunteers')
  const ledger=await db.select().from(s.events)
  assert.ok(ledger.some(e=>e.type==='VOLUNTEER_ADMISSION_REVIEWED'))
  assert.ok(!ledger.some(e=>e.payload.includes('PRIVATE-QA-ANSWER')||e.payload.includes('PRIVATE-QA-NOTE')||e.payload.includes('PRIVATE-REJECTION-NOTE')||e.payload.includes('PRIVATE-REJECTION-LETTER')||e.payload.includes('PRIVATE-ACCEPTANCE-LETTER')),'private content stays out of audit and outbox payloads')
  const {isPrivateOnboardingEvent}=await import('../src/lib/ledger/onboarding-privacy')
  const queued=await db.select().from(s.cityLedgerOutbox)
  assert.ok(!queued.some(event=>isPrivateOnboardingEvent(event.type)),'intake decisions do not enter the public city outbox')
  const sent=await db.select().from(s.notifications).where(eq(s.notifications.userId,userId))
  assert.ok(!sent.some(n=>n.body.includes('PRIVATE-QA-NOTE')),'internal notes stay out of participant notifications')
  // UI fixtures: one pre-session applicant and one attendee awaiting a roster decision.
  const applicantId=await person('Avery Intake QA','intake-applicant@example.invalid')
  const attendeeId=await person('Jordan Review QA','intake-attendee@example.invalid')
  const current=(await v.getIntakeForm(taskId)).form!
  for(const id of [applicantId,attendeeId])assert.equal((await v.submitIntakeApplication({taskId,userId:id,formId:current.id,answers:{motivation:'I would love to support our neighborhood kitchen.',availability:'Morning',experience:'Yes'}})).ok,true)
  const attendeeApplication=(await db.select().from(s.onboardingApplications).where(and(eq(s.onboardingApplications.taskId,taskId),eq(s.onboardingApplications.userId,attendeeId))))[0]
  await v.reviewIntakeApplication({orgId,actorId,applicationId:attendeeApplication.id,decision:'approved',internalNote:'',confirmed:true,...acceptance})
  await db.insert(s.claims).values({id:crypto.randomUUID(),taskId,shiftId:shift.id,userId:attendeeId,status:'verified',checkedInAt:Date.now()-7000000,createdAt:Date.now(),updatedAt:Date.now()})
  await db.update(s.orgProfiles).set({published:1}).where(eq(s.orgProfiles.orgId,orgId))
  client.close()
  console.log('PASS: intake wizard, capacities, duration, form versions, custom and profile-only applications, application approval, reservation gate, attendance gate, paperwork, scoped admission, explicit decline, reconsideration, privacy, staff exclusion, tenant ownership, roster preservation.')
  console.log(JSON.stringify({directory,database,orgId,taskId,flexibleTaskId:flexible.taskId,applicantId,attendeeId,ownerId:actorId,programId:program.id}))
}
main().catch(error=>{console.error(error);process.exitCode=1})
