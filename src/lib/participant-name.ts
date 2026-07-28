/**
 * A participant's username is their chosen public display name. Their account
 * name remains available for account recovery and organization delegations,
 * but participant-facing surfaces always prefer the chosen username.
 */
export function participantDisplayName(person: { name: string; username?: string | null }): string {
  return person.username?.trim() || person.name
}
