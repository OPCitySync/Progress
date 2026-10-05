/** Match a browser request to its public host, even when Next uses an internal URL. */
export function browserRequestIsSameOrigin(request: Request): boolean {
  try {
    const origin = new URL(request.headers.get('origin') ?? '')
    const protocol = request.headers.get('x-forwarded-proto') ?? new URL(request.url).protocol.slice(0, -1)
    return origin.host === request.headers.get('host') && origin.protocol === `${protocol}:`
  } catch {
    return false
  }
}
