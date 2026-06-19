import type { Metadata } from 'next'
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
      <body>{children}</body>
    </html>
  )
}
