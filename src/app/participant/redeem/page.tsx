import { redirect } from 'next/navigation'

/** Redemptions remain sandboxed while the participant MVP focuses on volunteering. */
export default function RedeemPage() {
  redirect('/participant')
}
