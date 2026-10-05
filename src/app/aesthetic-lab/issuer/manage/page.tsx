import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function ManageOrganizationRedirect({
  searchParams,
}: {
  searchParams: { invite?: string; inviteRole?: string; ok?: string; error?: string }
}) {
  const query = new URLSearchParams()
  if (searchParams.invite) query.set('invite', searchParams.invite)
  if (searchParams.inviteRole) query.set('inviteRole', searchParams.inviteRole)
  if (searchParams.ok) query.set('ok', searchParams.ok)
  if (searchParams.error) query.set('error', searchParams.error)
  redirect(`/aesthetic-lab/settings${query.size ? `?${query.toString()}` : ''}`)
}
