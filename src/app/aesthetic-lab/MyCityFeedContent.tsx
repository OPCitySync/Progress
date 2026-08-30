'use client'

import { useMemo, useState, type ReactNode } from 'react'

import {
  ArrowUpRight,
  Bookmark,
  Building2,
  CheckCircle2,
  Heart,
  ListFilter,
  Newspaper,
  Plus,
  TrendingUp,
} from 'lucide-react'
import { PostActions } from './PostActions'
import styles from './prototype.module.css'

export type LabFeedPost = {
  id: string
  body: string
  imageUrl: string | null
  createdAt: number
  organization: string
  organizationType: string
  hearts: number
  heartedByMe: boolean
  savedByMe: boolean
}

export type LabCommitment = {
  id: string
  title: string
  organization: string
  startsAt: number | null
  location: string
  isOnboarding: boolean
}

function relativeTime(timestamp: number) {
  const minutes = Math.max(1, Math.round((Date.now() - timestamp) / 60_000))
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function FeedPostCard({ post, redirectTo }: { post: LabFeedPost; redirectTo: string }) {
  const initials = post.organization.split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase()
  return (
    <article id={`post-${post.id}`} className={`${styles.storyCard} ${styles.compactStory}`}>
      <div className={styles.storyHeader}>
        <div className={styles.orgAvatar}>{initials || 'CS'}</div>
        <div><h2>{post.organization} <CheckCircle2 size={15} /></h2><p>{post.organizationType === 'issuer' ? 'Community organization' : post.organizationType} · {relativeTime(post.createdAt)}</p></div>
      </div>
      <p className={styles.storyText}>{post.body}</p>
      {post.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.feedPostImage} src={post.imageUrl} alt={`Image shared by ${post.organization}`} />
      ) : null}
      <div className={styles.storyFooter}><span><Heart size={17} fill="currentColor" /> {post.hearts}</span><span>Posted to MyCity</span></div>
      <PostActions postId={post.id} initialLiked={post.heartedByMe} initialSaved={post.savedByMe} redirectTo={redirectTo} />
    </article>
  )
}


export function MyCityFeedContent({
  posts,
  commitments,
  redirectTo = '/aesthetic-lab',
  composer,
}: {
  posts: LabFeedPost[]
  commitments: LabCommitment[]
  redirectTo?: string
  composer?: ReactNode
}) {
  const [filter, setFilter] = useState<'all' | 'news' | 'organizations' | 'trending'>('all')
  const [showBookmarked, setShowBookmarked] = useState(false)
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const selectFilter = (nextFilter: 'all' | 'news' | 'organizations' | 'trending') => {
    setShowBookmarked(false)
    setFilter(nextFilter)
  }
  const visiblePosts = useMemo(() => {
    if (showBookmarked) return posts.filter((post) => post.savedByMe)
    if (filter === 'news') return []
    if (filter === 'trending') return [...posts].sort((a, b) => b.hearts - a.hearts)
    if (filter === 'organizations') return posts.filter((post) => post.organizationType === 'issuer')
    return posts
  }, [filter, posts, showBookmarked])
  const emptyCopy = showBookmarked
    ? 'Bookmark city updates to keep them here for your organization.'
    : filter === 'news'
    ? 'No local news sources are connected to this City Network yet.'
    : filter === 'organizations'
      ? 'Updates from local organizations will appear here.'
      : 'There are no city updates to rank yet.'

  return (
    <>
      <section className={styles.feedFilters} aria-label="MyCity Feed filters">
        <div>
          <button type="button" className={!showBookmarked && filter === 'all' ? styles.feedFilterActive : undefined} onClick={() => selectFilter('all')} aria-pressed={!showBookmarked && filter === 'all'}><ListFilter size={16} /> All</button>
          <button type="button" className={!showBookmarked && filter === 'news' ? styles.feedFilterActive : undefined} onClick={() => selectFilter('news')} aria-pressed={!showBookmarked && filter === 'news'}><Newspaper size={16} /> News</button>
          <button type="button" className={!showBookmarked && filter === 'organizations' ? styles.feedFilterActive : undefined} onClick={() => selectFilter('organizations')} aria-pressed={!showBookmarked && filter === 'organizations'}><Building2 size={16} /> Organizations</button>
          <button type="button" className={!showBookmarked && filter === 'trending' ? styles.feedFilterActive : undefined} onClick={() => selectFilter('trending')} aria-pressed={!showBookmarked && filter === 'trending'}><TrendingUp size={16} /> Trending</button>
        </div>
        {composer ? <div className={styles.feedFilterActions}>
          <button
            type="button"
            className={`${styles.feedSavedButton} ${showBookmarked ? styles.feedSavedButtonActive : ''}`}
            onClick={() => setShowBookmarked((showing) => !showing)}
            aria-label={showBookmarked ? 'Show all MyCity posts' : 'Show bookmarked posts'}
            aria-pressed={showBookmarked}
            title={showBookmarked ? 'Show all MyCity posts' : 'Bookmarked posts'}
          >
            <Bookmark size={16} fill={showBookmarked ? 'currentColor' : 'none'} />
          </button>
          <button type="button" className={styles.feedPostButton} onClick={() => setIsComposerOpen((open) => !open)} aria-expanded={isComposerOpen}><Plus size={15} /> Post</button>
        </div> : null}
      </section>
      {composer ? <div className={styles.issuerFeedComposerPanel} data-open={isComposerOpen ? 'true' : 'false'}><div onSubmitCapture={() => {
        setIsComposerOpen(false)
        setShowBookmarked(false)
        setFilter('all')
      }}>{composer}</div></div> : null}
      {showBookmarked ? <div className={styles.feedSavedHeading}><Bookmark size={15} fill="currentColor" /><span>Bookmarked posts</span><small>{visiblePosts.length}</small></div> : null}
      {visiblePosts.length === 0 ? (
        <section className={styles.calendarEmpty}>
          <Building2 size={20} />
          <div>
            <b>{showBookmarked ? 'No bookmarks yet.' : 'No updates yet.'}</b>
            <p>{emptyCopy}</p>
          </div>
        </section>
      ) : (
        visiblePosts.map((post) => <FeedPostCard key={post.id} post={post} redirectTo={redirectTo} />)
      )}
    </>
  )
}
