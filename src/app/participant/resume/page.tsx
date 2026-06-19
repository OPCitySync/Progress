import { requireRole } from '@/lib/auth/session'
import { getMyResume } from '@/lib/services/resume'
import { setResumePublicAction } from '@/app/actions'
import { Card, PageHeader, Flash, Button, Badge, Mono } from '@/components/ui'
import { ResumeView } from '@/components/ResumeView'

export const dynamic = 'force-dynamic'

export default async function ParticipantResumePage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string }
}) {
  const session = await requireRole('participant')
  const data = await getMyResume(session.sub)
  if (!data) return null

  const base = process.env.APP_URL ?? ''
  const shareUrl = data.token ? `${base}/resume/${data.token}` : ''

  return (
    <>
      <PageHeader
        title="My service résumé"
        subtitle="A verifiable record of your civic contributions you can share with schools, employers, or anyone."
      />
      <Flash searchParams={searchParams} />

      <Card className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-ink-800">Share link</p>
            <Badge tone={data.isPublic ? 'green' : 'gray'}>{data.isPublic ? 'Public' : 'Private'}</Badge>
          </div>
          {data.isPublic && data.token ? (
            <p className="mt-1 text-sm">
              <a href={`/resume/${data.token}`} target="_blank" className="text-brand-600 hover:text-brand-500">
                <Mono>{shareUrl || `/resume/${data.token}`}</Mono>
              </a>
            </p>
          ) : (
            <p className="mt-1 text-sm text-ink-500">Your résumé is private. Make it public to get a share link.</p>
          )}
        </div>
        <form action={setResumePublicAction}>
          <input type="hidden" name="public" value={data.isPublic ? 'false' : 'true'} />
          <Button type="submit" variant={data.isPublic ? 'secondary' : 'primary'}>
            {data.isPublic ? 'Make private' : 'Make shareable'}
          </Button>
        </form>
      </Card>

      <ResumeView data={data} />
    </>
  )
}
