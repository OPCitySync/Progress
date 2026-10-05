import type { Metadata } from 'next'
import { Suspense } from 'react'
import { NavigationHistoryTracker } from './aesthetic-lab/NavigationHistoryTracker'
import './globals.css'

export const metadata: Metadata = {
  title: 'MyCity — Volunteer Coordination',
  description:
    'Find local volunteer opportunities, coordinate with organizations, and carry your service history forward.',
  icons: { icon: '/brand/mycity-symbol-dark.svg' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Suspense fallback={null}><NavigationHistoryTracker /></Suspense>
        {children}
      </body>
    </html>
  )
}
