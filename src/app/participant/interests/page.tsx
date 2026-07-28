import { redirect } from 'next/navigation'

/** Interests stay stored for matching, but this MVP no longer exposes a separate page. */
export default function InterestsPage() {
  redirect('/participant/opportunities')
}
