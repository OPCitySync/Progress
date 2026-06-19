import { requireSession } from '@/lib/auth/session'
import { AppShell } from '@/components/AppShell'

export default async function FeedLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()
  return <AppShell session={session}>{children}</AppShell>
}
