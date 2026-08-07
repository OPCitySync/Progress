import { Heart } from 'lucide-react'
import { clsx } from 'clsx'
import { requireSession } from '@/lib/auth/session'
import { getFeed } from '@/lib/services/feed'
import { getCityImpact } from '@/lib/services/leaderboard'
import { getActiveCity } from '@/lib/services/city-networks'
import { createPostAction, toggleHeartAction } from '@/app/actions'
import { Card, PageHeader, EmptyState, Flash, Textarea, Button, Badge } from '@/components/ui'
import { fmtDateTime } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function FeedPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string }
}) {
  const session = await requireSession()
  const city = await getActiveCity(session)
  const [feed, impact] = await Promise.all([
    getFeed(session.sub),
    getCityImpact(city?.id),
  ])
  const canPost = (session.role === 'issuer' || session.role === 'redeemer') && session.orgId

  return (
    <>
      <PageHeader
        title="MyCity Feed"
        subtitle="Updates from the organizations powering your city’s civic economy."
      />
      <Flash searchParams={searchParams} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {canPost ? (
            <Card className="mb-6">
              <form action={createPostAction} className="space-y-3">
                <input type="hidden" name="redirectTo" value="/feed" />
                <Textarea
                  name="body"
                  rows={3}
                  required
                  maxLength={1000}
                  placeholder="Share an update with your city — new opportunities, milestones, thank-yous…"
                />
                <div className="flex justify-end">
                  <Button type="submit">Post to MyCity</Button>
                </div>
              </form>
            </Card>
          ) : null}

          {feed.length === 0 ? (
            <EmptyState
              title="Nothing here yet"
              body="Issuer and redeemer organizations post city updates here."
            />
          ) : (
            <div className="space-y-4">
              {feed.map(({ post, org, hearts, heartedByMe }) => (
            <Card key={post.id}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                    {org.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{org.name}</p>
                    <p className="text-xs text-ink-400">{fmtDateTime(post.createdAt)}</p>
                  </div>
                </div>
                <Badge tone={org.type === 'issuer' ? 'blue' : 'gold'}>{org.type}</Badge>
              </div>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-700">{post.body}</p>
              <div className="mt-4 flex items-center gap-2 border-t border-ink-100 pt-3">
                {session.role === 'participant' ? (
                  <form action={toggleHeartAction}>
                    <input type="hidden" name="postId" value={post.id} />
                    <input type="hidden" name="redirectTo" value="/feed" />
                    <button
                      className={clsx(
                        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                        heartedByMe
                          ? 'bg-red-50 text-red-600'
                          : 'text-ink-400 hover:bg-ink-50 hover:text-red-500',
                      )}
                    >
                      <Heart size={16} fill={heartedByMe ? 'currentColor' : 'none'} />
                      {hearts}
                    </button>
                  </form>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-ink-400">
                    <Heart size={16} />
                    {hearts}
                  </span>
                )}
              </div>
            </Card>
              ))}
            </div>
          )}
        </div>

        <aside>
          <Card>
            <p className="text-sm font-semibold text-ink-800">Community impact</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {[
                ['Volunteers', impact.volunteers],
                ['Contributions', impact.contributions],
                ['Volunteer hours', impact.hours],
                ['Organizations', impact.organizations],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-ink-50 p-3">
                  <p className="text-xs text-ink-400">{label}</p>
                  <p className="mt-0.5 text-xl font-semibold text-ink-900">{value}</p>
                </div>
              ))}
            </div>
          </Card>
        </aside>
      </div>
    </>
  )
}
