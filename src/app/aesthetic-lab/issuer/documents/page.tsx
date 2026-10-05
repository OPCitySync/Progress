import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function IssuerDocumentsLabPage({
  searchParams,
}: {
  searchParams: { ok?: string; error?: string }
}) {
  const params = new URLSearchParams({ workspace: 'documents' })
  if (searchParams.ok) params.set('ok', searchParams.ok)
  if (searchParams.error) params.set('error', searchParams.error)
  redirect(`/aesthetic-lab/issuer/catalog?${params.toString()}`)
}
