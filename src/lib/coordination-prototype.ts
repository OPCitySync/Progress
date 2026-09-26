import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/** The original frontend is the single source of truth, not a second CSS port. */
export const COORDINATION_ASSETS = [
  'index.html',
  'styles.css', 'feed.css', 'passport.css', 'recruitment.css', 'program.css',
  'profile.css', 'navigation.css', 'volunteer.css', 'planning.css', 'issuer-home.css',
  'app.js', 'model.js', 'navigation-view.js',
  'feed-model.js', 'feed-view.js', 'passport-model.js', 'passport-view.js', 'resume-view.js',
  'recruitment-model.js', 'recruitment-view.js', 'program-model.js', 'program-view.js',
  'profile-model.js', 'profile-view.js', 'planning-model.js', 'planning-view.js',
  'planning-controller.js', 'issuer-home-model.js', 'issuer-home-view.js', 'issuer-home-controller.js',
  'assets/garden-story.svg', 'assets/together-story.svg',
] as const

export function coordinationPrototypeEnabled() {
  return process.env.CITYSYNC_COORDINATION_UI === 'prototype' && !process.env.VERCEL
}

export async function coordinationAsset(path: string) {
  // An explicit runtime-only manifest prevents serving documents, tests, or arbitrary files.
  if (!(COORDINATION_ASSETS as readonly string[]).includes(path)) return null
  let body = await readFile(join(process.cwd(), 'experiments/volunteer-coordination', path), 'utf8')
  let contentType = 'text/javascript; charset=utf-8'
  if (path.endsWith('.css')) contentType = 'text/css; charset=utf-8'
  if (path.endsWith('.svg')) contentType = 'image/svg+xml; charset=utf-8'
  if (path === 'index.html') {
    contentType = 'text/html; charset=utf-8'
    body = body.replaceAll('href="/', 'href="/coordination/').replaceAll('src="/', 'src="/coordination/')
      .replace('<head>', '<head>\n    <meta name="citysync-data-mode" content="local-prototype-demo" />')
  }
  if (path === 'feed-model.js') body = body.replaceAll("'/assets/", "'/coordination/assets/")
  if (path === 'app.js') {
    // Preserve copied feed, profile and invitation links under the mounted UI path.
    body = body.replaceAll('location.origin', "(location.origin + '/coordination')")
  }
  return { body, contentType }
}
