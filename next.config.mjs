/**
 * Keep the live development server and production verification builds in
 * completely separate output directories. A `next build` otherwise replaces
 * files inside `.next` while `next dev` may still be serving them, which can
 * leave the browser with HTML whose referenced CSS chunk no longer exists.
 */
const nextConfig = (phase) => ({
  reactStrictMode: true,
  distDir: phase === 'phase-development-server' ? '.next-dev' : '.next',
  async redirects() {
    return [
      {
        source: '/aesthetic-lab/issuer/onboarding',
        destination: '/aesthetic-lab/issuer/catalog',
        permanent: false,
      },
      {
        source: '/aesthetic-lab/chats/:id',
        destination: '/aesthetic-lab/messages?pane=events&event=:id',
        permanent: false,
      },
      {
        source: '/aesthetic-lab/issuer/notifications/chats/:id',
        destination: '/aesthetic-lab/issuer/notifications?pane=events',
        permanent: false,
      },
      {
        source: '/aesthetic-lab/issuer/profile/edit',
        destination: '/aesthetic-lab/issuer/profile',
        permanent: false,
      },
      {
        source: '/aesthetic-lab/issuer/programs/:id/recognition/:recognitionId',
        destination: '/aesthetic-lab/issuer/programs/:id?section=recognition',
        permanent: false,
      },
    ]
  },
  experimental: {
    // Organization documents are deliberately capped at 10 MB in the upload
    // actions, so permit that same request size before an action is invoked.
    serverActions: { bodySizeLimit: '10mb' },
  },
})

export default nextConfig
