import { NextResponse } from 'next/server'
import { processDueReminders } from '@/lib/services/notifications'
import { flushAllCityLedgerOutbox } from '@/lib/ledger/city-outbox'

export const dynamic = 'force-dynamic'

/**
 * Drains due reminders. Intended to be hit on a schedule (Vercel Cron sends
 * `Authorization: Bearer ${CRON_SECRET}` automatically). If CRON_SECRET is
 * unset (local dev), the endpoint is open for convenience.
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    const qs = new URL(req.url).searchParams.get('secret')
    if (auth !== `Bearer ${secret}` && qs !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }
  const [res, cityLedger] = await Promise.all([processDueReminders(), flushAllCityLedgerOutbox()])
  return NextResponse.json({ ok: true, ...res, cityLedger })
}

export const GET = handle
export const POST = handle
