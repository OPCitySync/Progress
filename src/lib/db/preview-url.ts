import { isAbsolute, join } from 'node:path'

/** Preview mode takes precedence over .env URLs, including newly created cities. */
export function previewDatabaseUrl(filename: string): string | null {
  const directory = process.env.CITYSYNC_PREVIEW_DATABASE_DIR
  if (!directory) return null
  if (process.env.VERCEL || !isAbsolute(directory)) {
    throw new Error('Database preview mode requires an absolute local directory outside Vercel.')
  }
  return `file:${join(directory, filename)}`
}
