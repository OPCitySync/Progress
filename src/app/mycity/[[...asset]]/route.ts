import { coordinationAsset, coordinationIntegratedEnabled } from '@/lib/coordination-prototype'
import { requireSession } from '@/lib/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** The branch's primary MyCity UI, served from the same frontend as the prototype. */
export async function GET(_request: Request, { params }: { params: { asset?: string[] } }) {
  if (!coordinationIntegratedEnabled()) return new Response('Not found', { status: 404 })
  const session = await requireSession('/mycity')
  const asset = await coordinationAsset(params.asset?.join('/') || 'index.html', '/mycity')
  if (!asset) return new Response('Not found', { status: 404 })
  const defaultRoute = session.role === 'participant' ? 'volunteer' : 'coordinator'
  const body = !params.asset?.length
    ? asset.body
      .replace('content="local-prototype-demo"', 'content="integrated-preview-sample-data"')
      .replace('</head>', `<script>if (!location.hash) location.replace('/mycity#/${defaultRoute}/home')</script>\n  </head>`)
    : asset.body
  return new Response(body, {
    headers: {
      'Content-Type': asset.contentType,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-CitySync-Data-Mode': 'integrated-preview-sample-data',
      'Content-Security-Policy': "connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'",
    },
  })
}
