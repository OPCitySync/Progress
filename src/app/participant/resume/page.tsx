import { requireRole } from '@/lib/auth/session'
import { getMyResume } from '@/lib/services/resume'
import { setResumePublicAction } from '@/app/actions'
import { Badge, Button, Card, Mono, PageHeader } from '@/components/ui'
import { ResumeView } from '@/components/ResumeView'

export const dynamic = 'force-dynamic'

/** A private service record accessed from the participant Opportunities section. */
export default async function ParticipantResumePage() {
  const session = await requireRole('participant')
  const resume = await getMyResume(session.sub)
  if (!resume) return null

  return (
    <>
      <PageHeader
        title="Service History"
        subtitle="Your verified volunteer history is private unless you choose to share it."
      />

      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-ink-800">Share link</p>
              <Badge tone={resume.isPublic ? 'green' : 'gray'}>{resume.isPublic ? 'Public' : 'Private'}</Badge>
            </div>
            {resume.isPublic && resume.token ? (
              <p className="mt-1 text-sm">
                <a href={`/resume/${resume.token}`} target="_blank" className="text-brand-600 hover:text-brand-500">
                  <Mono>{`${process.env.APP_URL ?? ''}/resume/${resume.token}` || `/resume/${resume.token}`}</Mono>
                </a>
              </p>
            ) : (
              <p className="mt-1 text-sm text-ink-500">Only you can see this record until you make it shareable.</p>
            )}
          </div>
          <form action={setResumePublicAction}>
            <input type="hidden" name="public" value={resume.isPublic ? 'false' : 'true'} />
            <input type="hidden" name="redirectTo" value="/participant/resume" />
            <Button type="submit" variant={resume.isPublic ? 'secondary' : 'primary'}>
              {resume.isPublic ? 'Make private' : 'Make shareable'}
            </Button>
          </form>
        </div>
      </Card>

      <ResumeView data={resume} embedded showCredits={false} />
    </>
  )
}
