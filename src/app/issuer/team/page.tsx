import { redirect } from 'next/navigation'

/** Team access now lives in the organization-specific Settings surface. */
export default function IssuerTeamPage() {
  redirect('/settings')
}
