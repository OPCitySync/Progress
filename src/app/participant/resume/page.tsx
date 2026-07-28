import { redirect } from 'next/navigation'

/** The résumé is now part of participant Home. Keep legacy bookmarks useful. */
export default function ParticipantResumePage() {
  redirect('/participant')
}
