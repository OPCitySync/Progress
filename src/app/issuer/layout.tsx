import { requireRole } from '@/lib/auth/session'
import { AppShell } from '@/components/AppShell'

export default async function IssuerLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('issuer')
  return <AppShell session={session}>{children}</AppShell>
}
