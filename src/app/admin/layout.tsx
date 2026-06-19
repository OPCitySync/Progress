import { requireRole } from '@/lib/auth/session'
import { AppShell } from '@/components/AppShell'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('admin')
  return <AppShell session={session}>{children}</AppShell>
}
