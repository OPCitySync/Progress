export const ORGANIZATION_BANNER_STYLES = [
  { value: 'original', label: 'Original' },
  { value: 'folded-ribbon', label: 'Folded Ribbon' },
  { value: 'confluence', label: 'Confluence' },
  { value: 'civic-mosaic', label: 'Civic Mosaic' },
] as const

export const ORGANIZATION_BANNER_PALETTES = [
  { value: 'citysync', label: 'City/Sync', colors: ['#15151e', '#35488b', '#f7c95d', '#dd9e33'] },
  { value: 'harbor', label: 'Harbor', colors: ['#112a3d', '#28627a', '#efc15d', '#c88f32'] },
  { value: 'civic-teal', label: 'Civic Teal', colors: ['#172829', '#3e7471', '#e9bd58', '#bf8730'] },
  { value: 'forest', label: 'Forest', colors: ['#1c2924', '#456750', '#d8b45a', '#ab7d31'] },
  { value: 'terracotta', label: 'Terracotta', colors: ['#352120', '#865044', '#efbd67', '#c78138'] },
] as const

export type OrganizationBannerStyle = (typeof ORGANIZATION_BANNER_STYLES)[number]['value']
export type OrganizationBannerPalette = (typeof ORGANIZATION_BANNER_PALETTES)[number]['value']

export const DEFAULT_ORGANIZATION_BANNER_STYLE: OrganizationBannerStyle = 'original'
export const DEFAULT_ORGANIZATION_BANNER_PALETTE: OrganizationBannerPalette = 'citysync'

/**
 * Compact organization mark used anywhere a logo has not been uploaded.
 * One-word names contribute their first two characters; longer names use the
 * first character from each of their first two words.
 */
export function organizationInitials(name: string, fallback = 'O') {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const characters = (word: string) => Array.from(word).filter((character) => /[A-Za-z0-9]/.test(character) || character.toUpperCase() !== character.toLowerCase())
  if (words.length === 0) return fallback.slice(0, 2).toUpperCase()
  if (words.length === 1) return characters(words[0]).slice(0, 2).join('').toUpperCase() || fallback.slice(0, 2).toUpperCase()
  return [characters(words[0])[0], characters(words[1])[0]].filter(Boolean).join('').slice(0, 2).toUpperCase() || fallback.slice(0, 2).toUpperCase()
}

export function organizationBannerPalette(value: unknown) {
  const paletteName = normalizeOrganizationBannerPalette(value)
  return ORGANIZATION_BANNER_PALETTES.find((option) => option.value === paletteName) ?? ORGANIZATION_BANNER_PALETTES[0]
}

const STYLE_KEY = '__citysyncBannerStyle'
const PALETTE_KEY = '__citysyncBannerPalette'

export function normalizeOrganizationBannerStyle(value: unknown): OrganizationBannerStyle {
  return ORGANIZATION_BANNER_STYLES.some((option) => option.value === value)
    ? value as OrganizationBannerStyle
    : DEFAULT_ORGANIZATION_BANNER_STYLE
}

export function normalizeOrganizationBannerPalette(value: unknown): OrganizationBannerPalette {
  return ORGANIZATION_BANNER_PALETTES.some((option) => option.value === value)
    ? value as OrganizationBannerPalette
    : DEFAULT_ORGANIZATION_BANNER_PALETTE
}

function stringMap(raw: string | Record<string, string>): Record<string, string> {
  if (typeof raw !== 'string') return { ...raw }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    )
  } catch {
    return {}
  }
}

/**
 * Appearance is presentation metadata, so it is namespaced inside the
 * profile's existing JSON metadata while the product is still in its
 * front-end iteration phase. Public social links are returned separately.
 */
export function organizationAppearanceFromStorage(raw: string | Record<string, string>) {
  const stored = stringMap(raw)
  const bannerStyle = normalizeOrganizationBannerStyle(stored[STYLE_KEY])
  const bannerPalette = normalizeOrganizationBannerPalette(stored[PALETTE_KEY])
  delete stored[STYLE_KEY]
  delete stored[PALETTE_KEY]
  return { socials: stored, bannerStyle, bannerPalette }
}

export function organizationAppearanceToStorage(
  socials: Record<string, string>,
  bannerStyle: unknown,
  bannerPalette: unknown,
) {
  return JSON.stringify({
    ...socials,
    [STYLE_KEY]: normalizeOrganizationBannerStyle(bannerStyle),
    [PALETTE_KEY]: normalizeOrganizationBannerPalette(bannerPalette),
  })
}

export function updateOrganizationAppearanceStorage(
  raw: string,
  bannerStyle?: unknown,
  bannerPalette?: unknown,
) {
  const current = organizationAppearanceFromStorage(raw)
  return organizationAppearanceToStorage(
    current.socials,
    bannerStyle === undefined ? current.bannerStyle : bannerStyle,
    bannerPalette === undefined ? current.bannerPalette : bannerPalette,
  )
}
