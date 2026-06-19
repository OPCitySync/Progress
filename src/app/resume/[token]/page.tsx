import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { PublicHeader } from '@/components/profile/PublicHeader'
import { ResumeView } from '@/components/ResumeView'
import { getResumeByToken } from '@/lib/services/resume'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const data = await getResumeByToken(params.token)
  if (!data) return { title: 'Résumé not found · City/Sync' }
  return {
    title: `${data.name} · Civic service record · City/Sync`,
    description: `${data.totals.contributions} verified contributions and ${data.totals.hours} volunteer hours, recorded on the City/Sync ledger.`,
  }
}

export default async function PublicResumePage({ params }: { params: { token: string } }) {
  const data = await getResumeByToken(params.token)
  if (!data) notFound()

  return (
    <div className="min-h-screen bg-ink-50">
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <ResumeView data={data} />
      </main>
    </div>
  )
}
