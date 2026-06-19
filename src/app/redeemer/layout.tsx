import { requireRole } from '@/lib/auth/session'
import { AppShell } from '@/components/AppShell'

export default async function RedeemerLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('redeemer')
  return <AppShell session={session}>{children}</AppShell>
}
