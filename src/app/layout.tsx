import type { Metadata } from 'next'
import { Suspense } from 'react'
import { NavigationHistoryTracker } from './aesthetic-lab/NavigationHistoryTracker'
import './globals.css'

export const metadata: Metadata = {
  title: 'City/Sync — Volunteer Management',
  description:
    'Civic contribution, recognized. Verified volunteer work earns civic credits redeemable with local community partners.',
  icons: { icon: '/favicon.ico', apple: '/apple-touch-icon.png' },
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
