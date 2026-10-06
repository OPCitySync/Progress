import { redirect } from 'next/navigation'

export default function PublicEventAlias({ params }: { params: { shiftId: string } }) {
  redirect(`/activities/${encodeURIComponent(params.shiftId)}`)
}

