import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function InvitePage({
  searchParams,
}: {
  searchParams: { code?: string; error?: string; ok?: string }
}) {
  const params = new URLSearchParams()
  if (searchParams.code) params.set('code', searchParams.code)
  if (searchParams.error) params.set('error', searchParams.error)
  if (searchParams.ok) params.set('ok', searchParams.ok)
  redirect(`/aesthetic-lab/invite${params.size ? `?${params.toString()}` : ''}`)
}
