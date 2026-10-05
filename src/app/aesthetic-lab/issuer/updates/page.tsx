import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth/session'

/** Keep older notification links working while the unified center becomes canonical. */
export default async function IssuerUpdatesPage() {
  await requireRole('issuer')
  redirect('/aesthetic-lab/issuer/notifications?pane=notifications')
}
