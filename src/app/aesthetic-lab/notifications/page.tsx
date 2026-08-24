import { redirect } from 'next/navigation'

/** Keep existing saved notification links working after the Messages update. */
export default function LegacyParticipantNotificationsPage() {
  redirect('/aesthetic-lab/messages')
}
