/**
 * Small integration check for the city-ledger outbox. Run it against an empty
 * disposable DATABASE_URL and CITY_DB_BERKELEY_URL after `npm run db:migrate`.
 */
import { db, client } from '../src/lib/db/client'
import { cityEvents } from '../src/lib/db/city-schema'
import { getCityDb } from '../src/lib/db/city-client'
import { appendEvent } from '../src/lib/ledger/ledger'
import { flushCityLedgerOutbox } from '../src/lib/ledger/city-outbox'
import { EventTypes } from '../src/lib/ledger/events'

async function main() {
  await db.transaction(async (tx) => {
    await appendEvent(
      tx,
      EventTypes.TASK_CREATED,
      { taskId: 'outbox-check', orgId: 'outbox-check', cityId: 'berkeley', title: 'Outbox integration check', credits: 1 },
      'outbox-checker',
    )
  })

  const first = await flushCityLedgerOutbox('berkeley')
  const second = await flushCityLedgerOutbox('berkeley')
  const events = await getCityDb('berkeley').select().from(cityEvents)

  if (first.delivered !== 1 || first.pending !== 0 || first.failed || second.delivered !== 0 || events.length !== 1) {
    throw new Error(`Outbox integration check failed: ${JSON.stringify({ first, second, cityEvents: events.length })}`)
  }
  console.log('✓ City-ledger outbox delivered once and retry remained idempotent.')
  client.close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
