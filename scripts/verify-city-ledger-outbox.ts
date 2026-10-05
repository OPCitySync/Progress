/** Self-isolating outbox check. The source database is read only. */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'

async function main() {
  const directory=mkdtempSync(join(tmpdir(),'citysync-outbox-check-'))
  const database=join(directory,'app.db')
  execFileSync('sqlite3',[resolve(process.argv[2]||'local.db'),'.backup '+JSON.stringify(database)])
  process.env.DATABASE_URL='file:'+database
  delete process.env.DATABASE_AUTH_TOKEN
  const cityId='outbox-test'
  process.env.CITY_DB_OUTBOX_TEST_URL='file:'+join(directory,'city.db')
  const {db,client}=await import('../src/lib/db/client')
  const {cityEvents}=await import('../src/lib/db/city-schema')
  const {getCityDb,getCityClient,provisionCityDatabase}=await import('../src/lib/db/city-client')
  const {appendEvent}=await import('../src/lib/ledger/ledger')
  const {flushCityLedgerOutbox}=await import('../src/lib/ledger/city-outbox')
  const {EventTypes}=await import('../src/lib/ledger/events')
  await provisionCityDatabase(cityId)
  await db.transaction(async tx=>{
    await appendEvent(tx,EventTypes.TASK_CREATED,{taskId:'outbox-check',orgId:'outbox-check',cityId,title:'Isolated outbox integration check',credits:1},'outbox-checker')
    await appendEvent(tx,EventTypes.VOLUNTEER_ADMISSION_REVIEWED,{orgId:'outbox-check',cityId,participantId:'test-participant',status:'not_approved'},'outbox-checker')
  })
  const first=await flushCityLedgerOutbox(cityId),second=await flushCityLedgerOutbox(cityId)
  const events=await getCityDb(cityId).select().from(cityEvents)
  assert.equal(first.delivered,1);assert.equal(first.pending,0);assert.equal(first.failed,false)
  assert.equal(second.delivered,0);assert.equal(events.length,1)
  assert.equal(events[0].type,EventTypes.TASK_CREATED,'private admission is never mirrored')
  client.close();getCityClient(cityId).close()
  console.log('PASS: public outbox delivery is idempotent; private onboarding stays local. Disposable database: '+database)
}
main().catch(error=>{console.error(error);process.exitCode=1})
