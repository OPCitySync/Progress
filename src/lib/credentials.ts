/**
 * Fixed network credential catalog. Credentials are network-wide: once an
 * admin or issuer org grants one to a volunteer, it satisfies that requirement
 * at every organization (portable verification). Opportunities can require a
 * subset of these, gating sign-up the same way liability waivers do.
 *
 * Shared by client and server — keep free of server-only imports.
 */
export type CredentialKey = 'background_check' | 'id_verified' | 'age_18plus' | 'food_safety'

export const CREDENTIALS: { key: CredentialKey; label: string; description: string }[] = [
  { key: 'background_check', label: 'Background check', description: 'Cleared a background check.' },
  { key: 'id_verified', label: 'ID / driver’s license', description: 'Government ID or driver’s license verified.' },
  { key: 'age_18plus', label: '18 or older', description: 'Verified to be at least 18 years old.' },
  { key: 'food_safety', label: 'Food-safety training', description: 'Completed basic food-handling / safety training.' },
]

export const CREDENTIAL_KEYS = CREDENTIALS.map((c) => c.key)
export const CREDENTIAL_LABELS: Record<string, string> = Object.fromEntries(CREDENTIALS.map((c) => [c.key, c.label]))

export function isCredentialKey(k: string): k is CredentialKey {
  return CREDENTIALS.some((c) => c.key === k)
}

export function credentialLabel(key: string): string {
  return CREDENTIAL_LABELS[key] ?? key
}

/** Parse a JSON array of credential keys, dropping anything not in the catalog. */
export function parseCredentialList(raw: string | null | undefined): CredentialKey[] {
  if (!raw) return []
  try {
    const a = JSON.parse(raw)
    if (Array.isArray(a)) return a.filter((x): x is CredentialKey => typeof x === 'string' && isCredentialKey(x))
  } catch {
    /* ignore */
  }
  return []
}
