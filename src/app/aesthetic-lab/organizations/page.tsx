import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function OrganizationsLabPage() {
  redirect('/aesthetic-lab/opportunities')
}
