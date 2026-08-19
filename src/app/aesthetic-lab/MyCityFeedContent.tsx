'use client'

import { useMemo, useState } from 'react'

import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Heart,
} from 'lucide-react'
import { PostActions } from './PostActions'
import styles from './prototype.module.css'

export type LabFeedPost = {
  id: string
  body: string
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

function FeedPostCard({ post }: { post: LabFeedPost }) {
  const initials = post.organization.split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase()
  return (
    <article className={`${styles.storyCard} ${styles.compactStory}`}>
      <div className={styles.storyHeader}>
        <div className={styles.orgAvatar}>{initials || 'CS'}</div>
        <div><h2>{post.organization} <CheckCircle2 size={15} /></h2><p>{post.organizationType === 'issuer' ? 'Community organization' : post.organizationType} · {relativeTime(post.createdAt)}</p></div>
      </div>
      <p className={styles.storyText}>{post.body}</p>
      <div className={styles.storyFooter}><span><Heart size={17} fill="currentColor" /> {post.hearts}</span><span>Posted to MyCity</span></div>
      <PostActions postId={post.id} initialLiked={post.heartedByMe} initialSaved={post.savedByMe} />
    </article>
  )
}


export function MyCityFeedContent({ posts, commitments }: { posts: LabFeedPost[]; commitments: LabCommitment[] }) {
  const [sortOrder, setSortOrder] = useState<'recent' | 'relevant'>('recent')
  const [isSortOpen, setIsSortOpen] = useState(false)
  const visiblePosts = useMemo(() => sortOrder === 'relevant' ? [...posts].sort((a, b) => b.hearts - a.hearts) : posts, [posts, sortOrder])

  return (
    <>
      <div className={styles.feedTitle} style={{ position: 'relative' }}>
        <p className={styles.eyebrow}>City Updates</p>
        <button 
          onClick={() => setIsSortOpen(!isSortOpen)} 
          style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border, #e2e8f0)', background: 'transparent', fontSize: '13px', color: 'var(--text-secondary, #64748b)', cursor: 'pointer', outline: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          {sortOrder === 'recent' ? 'Most recent' : 'Most relevant'} <ChevronDown size={14} />
        </button>
        {isSortOpen && (
          <div style={{ position: 'absolute', top: '100%', right: '0', marginTop: '4px', background: 'var(--card-bg, #fff)', border: '1px solid var(--border, #e2e8f0)', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, padding: '4px', minWidth: '140px', display: 'flex', flexDirection: 'column' }}>
            <button type="button" onClick={() => { setSortOrder('recent'); setIsSortOpen(false) }} style={{ padding: '6px 12px', textAlign: 'left', background: sortOrder === 'recent' ? 'var(--surface-sunken, #f1f5f9)' : 'transparent', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary)' }}>Most recent</button>
            <button type="button" onClick={() => { setSortOrder('relevant'); setIsSortOpen(false) }} style={{ padding: '6px 12px', textAlign: 'left', background: sortOrder === 'relevant' ? 'var(--surface-sunken, #f1f5f9)' : 'transparent', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary)' }}>Most relevant</button>
          </div>
        )}
      </div>
      {visiblePosts.length === 0 ? (
        <section className={styles.calendarEmpty}>
          <Building2 size={20} />
          <div>
            <b>No updates yet.</b>
            <p>Updates from your city will appear here.</p>
          </div>
        </section>
      ) : (
        visiblePosts.map((post) => <FeedPostCard key={post.id} post={post} />)
      )}
    </>
  )
}
