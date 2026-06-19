import { requireRole } from '@/lib/auth/session'
import { AppShell } from '@/components/AppShell'

export default async function ParticipantLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('participant')
  return <AppShell session={session}>{children}</AppShell>
}
