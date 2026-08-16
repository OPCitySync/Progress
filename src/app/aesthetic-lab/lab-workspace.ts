import { getActiveCity, getCityNetworks, type CityNetwork } from '@/lib/services/city-networks'
import { getActorContexts, type ActorContext } from '@/lib/services/identity-access'
import type { Session } from '@/lib/auth/session'

/**
 * Shared authenticated context for the visual redesign. Keeping this small
 * means every redesigned screen uses the existing session, city selection,
 * and identity model instead of introducing a parallel prototype state.
 */
export async function getLabWorkspace(session: Session): Promise<{
  city: CityNetwork | null
  cities: CityNetwork[]
  contexts: ActorContext[]
}> {
  const [city, cities, contexts] = await Promise.all([
    getActiveCity(session),
    getCityNetworks(session),
    getActorContexts(session.sub),
  ])

  return { city, cities, contexts }
}
