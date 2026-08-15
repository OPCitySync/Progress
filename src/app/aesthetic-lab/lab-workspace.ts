import { getActiveCity, type CityNetwork } from '@/lib/services/city-networks'
import { getActorContexts, type ActorContext } from '@/lib/services/identity-access'
import type { Session } from '@/lib/auth/session'

/**
 * Shared authenticated context for the visual redesign. Keeping this small
 * means every redesigned screen uses the existing session, city selection,
 * and identity model instead of introducing a parallel prototype state.
 */
export async function getLabWorkspace(session: Session): Promise<{
  city: CityNetwork | null
  contexts: ActorContext[]
}> {
  const [city, contexts] = await Promise.all([
    getActiveCity(session),
    getActorContexts(session.sub),
  ])

  return { city, contexts }
}
