/**
 * Sandbox mode (default ON): removes gates that only matter in production —
 * organizations are auto-approved at registration. Set SANDBOX_MODE=false
 * to restore admin review before orgs can publish.
 */
export function isSandbox(): boolean {
  return process.env.SANDBOX_MODE !== 'false'
}

/**
 * Capability flags for staged rollout. The product ships in iterations:
 * iteration 1 is pure volunteer management (Issuers ↔ Participants); the
 * civic-credit economy, redeemers, and the catalog approval gate arrive later.
 *
 * Defaults: everything ON (full build visible in development). Set
 * PROGRAM_PHASE=volunteer-mgmt to apply the iteration-1 preset (hides the
 * economy + the approval gate, keeps the catalog as a convenience). Individual
 * FEATURE_* env vars override either way.
 *
 *   FEATURE_CREDITS / FEATURE_REDEEMERS / FEATURE_CATALOG / FEATURE_CATALOG_APPROVAL
 *     = 'true' | 'false'
 */
export type Features = {
  credits: boolean
  redeemers: boolean
  catalog: boolean
  catalogApproval: boolean
}

function flag(name: string, fallback: boolean): boolean {
  const v = process.env[name]
  if (v === 'true') return true
  if (v === 'false') return false
  return fallback
}

export function features(): Features {
  // Iteration-1 preset: volunteer management only.
  const iter1 = process.env.PROGRAM_PHASE === 'volunteer-mgmt'
  return {
    credits: flag('FEATURE_CREDITS', !iter1),
    redeemers: flag('FEATURE_REDEEMERS', !iter1),
    catalog: flag('FEATURE_CATALOG', true), // catalog is on in every iteration
    catalogApproval: flag('FEATURE_CATALOG_APPROVAL', !iter1),
  }
}

export function featureEnabled(name: keyof Features): boolean {
  return features()[name]
}
