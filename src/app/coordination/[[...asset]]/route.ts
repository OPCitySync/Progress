import { coordinationAsset, coordinationPrototypeEnabled } from '@/lib/coordination-prototype'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** A full document, deliberately outside React layouts, Tailwind and platform CSS. */
export async function GET(_request: Request, { params }: { params: { asset?: string[] } }) {
  if (!coordinationPrototypeEnabled()) return new Response('Not found', { status: 404 })
  const asset = await coordinationAsset(params.asset?.join('/') || 'index.html')
  if (!asset) return new Response('Not found', { status: 404 })
  return new Response(asset.body, {
    headers: {
      'Content-Type': asset.contentType,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-CitySync-Data-Mode': 'local-prototype-demo',
      // This stage is browser-local: no prototype action can call a platform API.
      'Content-Security-Policy': "connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'",
    },
  })
}
