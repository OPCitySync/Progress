'use client'

import { useMemo, useState } from 'react'
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Heart,
  Newspaper,
  TrendingUp,
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

type FeedView = 'news' | 'organizations' | 'trending' | 'calendar'

const views = [
  { key: 'news', label: 'News', description: 'Local news', icon: Newspaper },
  { key: 'organizations', label: 'Organizations', description: 'Organization posts', icon: Building2 },
  { key: 'trending', label: 'Trending', description: 'Most liked posts', icon: TrendingUp },
  { key: 'calendar', label: 'My Calendar', description: 'Your city calendar', icon: CalendarDays },
] as const

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

function MyCalendar({ commitments }: { commitments: LabCommitment[] }) {
  const week = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - date.getDay() + offset)
    return date
  })
  const commitmentsByDay = new Map<number, LabCommitment[]>()
  for (const commitment of commitments) {
    if (!commitment.startsAt) continue
    const date = new Date(commitment.startsAt)
    const key = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    commitmentsByDay.set(key, [...(commitmentsByDay.get(key) ?? []), commitment])
  }

  return (
    <section className={styles.calendarView} aria-label="My Calendar">
      <div className={styles.calendarHeader}><div><p className={styles.eyebrow}>My Calendar</p><h2>This week</h2></div></div>
      <p className={styles.calendarNote}>Your active commitments appear here. More city events are available in Opportunities.</p>
      <div className={styles.weekGrid}>
        {week.map((day) => {
          const key = day.getTime()
          const items = commitmentsByDay.get(key) ?? []
          return <div className={day.toDateString() === new Date().toDateString() ? styles.currentDay : undefined} key={key}><span>{day.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}</span><strong>{day.getDate()}</strong>{items.map((item) => <a href="/aesthetic-lab/opportunities" className={item.isOnboarding ? styles.onboarding : styles.service} key={item.id}><small>{item.startsAt ? new Date(item.startsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}</small>{item.title}</a>)}</div>
        })}
      </div>
      <div className={styles.calendarLegend}><span><i className={styles.service} /> Your commitment</span><span><i className={styles.onboarding} /> Onboarding</span></div>
      {commitments.length === 0 ? <section className={styles.calendarEmpty}><CalendarDays size={20} /><div><b>Your calendar is open.</b><p>Add an opportunity when you&apos;re ready to show up.</p></div></section> : null}
    </section>
  )
}

export function MyCityFeedContent({ posts, commitments }: { posts: LabFeedPost[]; commitments: LabCommitment[] }) {
  const [view, setView] = useState<FeedView>('news')
  const activeView = views.find((item) => item.key === view)!
  const visiblePosts = useMemo(() => view === 'trending' ? [...posts].sort((a, b) => b.hearts - a.hearts) : posts, [posts, view])

  return (
    <>
      <section className={styles.feedFilters} aria-label="MyCity Feed filters">
        <p className={styles.eyebrow}>Filters</p>
        <div role="tablist" aria-label="MyCity Feed views">
          {views.map((item) => {
            const Icon = item.icon
            const isActive = item.key === view
            return <button key={item.key} type="button" role="tab" aria-selected={isActive} className={isActive ? styles.feedFilterActive : undefined} onClick={() => setView(item.key)}><Icon size={16} /> {item.label}</button>
          })}
        </div>
      </section>

      {view === 'calendar' ? <MyCalendar commitments={commitments} /> : <>
        <div className={styles.feedTitle}><p className={styles.eyebrow}>{activeView.description}</p><span>Most relevant</span></div>
        {view === 'news' ? (
          <section className={styles.calendarEmpty}><Newspaper size={20} /><div><b>Local news is coming to MyCity.</b><p>We&apos;ll add licensed feeds from participating local news sources as those partnerships are established.</p></div></section>
        ) : visiblePosts.length === 0 ? (
          <section className={styles.calendarEmpty}><Building2 size={20} /><div><b>No organization updates yet.</b><p>Updates from approved organizations in your city will appear here.</p></div></section>
        ) : visiblePosts.map((post) => <FeedPostCard key={post.id} post={post} />)}
      </>}
    </>
  )
}
