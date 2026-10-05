import type { Metadata } from 'next'
import IssuerHomeOperatingBrief from './IssuerHomeOperatingBrief'

export const metadata: Metadata = {
  title: 'Issuer Operating Brief · MyCity',
  description: 'An experimental operating home page for volunteer organizations in MyCity.',
}

export default function IssuerHomeConceptPage() {
  return <IssuerHomeOperatingBrief />
}
