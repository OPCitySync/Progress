'use client'

import { useState } from 'react'
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Heart,
  MapPin,
  Newspaper,
  TrendingUp,
} from 'lucide-react'
import { PostActions } from './PostActions'
import styles from './prototype.module.css'

type FeedView = 'news' | 'organizations' | 'trending' | 'calendar'

const views = [
  { key: 'news', label: 'News', description: 'Local news', icon: Newspaper },
  { key: 'organizations', label: 'Organizations', description: 'Organization posts', icon: Building2 },
  { key: 'trending', label: 'Trending', description: 'Most liked posts', icon: TrendingUp },
  { key: 'calendar', label: 'My Calendar', description: 'Your city calendar', icon: CalendarDays },
] as const

function OrganizationOpportunityPost() {
  return (
    <article className={styles.storyCard}>
      <div className={styles.storyHeader}>
        <div className={styles.orgAvatar}>EB</div>
        <div><h2>East Bay Food Collective <CheckCircle2 size={15} /></h2><p>Community organization · 2h ago</p></div>
        <button type="button" aria-label="Story options">•••</button>
      </div>
      <p className={styles.storyText}>Our weekly neighborhood pantry is growing. We&apos;re looking for a few people to help prepare produce boxes this Saturday — no experience needed.</p>
      <div className={styles.storyPhoto}><div className={styles.sunDisc} /><div className={styles.hillOne} /><div className={styles.hillTwo} /><span>GOOD FOOD<br />FOR GOOD NEIGHBORS</span></div>
      <div className={styles.opportunityPreview}><div className={styles.previewDate}><span>SAT</span><strong>16</strong></div><div><b>Pantry packing crew</b><p>10:00 AM · Berkeley Food Hub</p></div><a href="#">View <ArrowUpRight size={14} /></a></div>
      <div className={styles.storyFooter}><span><Heart size={17} fill="currentColor" /> 24</span><span>Shared from an opportunity</span></div>
      <PostActions isOpportunity postId="pantry-packing-crew" />
    </article>
  )
}

function OrganizationUpdatePost() {
  return (
    <article className={`${styles.storyCard} ${styles.compactStory}`}>
      <div className={styles.storyHeader}>
        <div className={`${styles.orgAvatar} ${styles.blueAvatar}`}>BT</div>
        <div><h2>Berkeley Tool Library <CheckCircle2 size={15} /></h2><p>Community organization · Yesterday</p></div>
        <button type="button" aria-label="Story options">•••</button>
      </div>
      <p className={styles.storyText}>A small repair table can keep a surprising amount out of the landfill. Thank you to everyone who joined last night&apos;s Fix-It Clinic.</p>
      <div className={styles.storyFooter}><span><Heart size={17} fill="currentColor" /> 36</span><span>12 neighbors saved this</span></div>
      <PostActions isOpportunity={false} postId="tool-library-fix-it" />
    </article>
  )
}

function LocalNewsPost() {
  return (
    <article className={`${styles.storyCard} ${styles.newsStoryCard}`}>
      <div className={styles.storyHeader}>
        <div className={styles.newsAvatar}>BJ</div>
        <div><h2>Berkeley Journal <CheckCircle2 size={15} /></h2><p>Local news · 36m ago</p></div>
        <button type="button" aria-label="Story options">•••</button>
      </div>
      <div className={styles.newsStoryBody}>
        <p className={styles.storyText}>The North Berkeley farmers market is expanding its community table program this fall, connecting local growers with neighborhood mutual-aid groups.</p>
        <div className={styles.newsArt}><span>LOCAL<br />GOOD</span><i /><i /><i /></div>
      </div>
      <div className={styles.storyFooter}><span><Heart size={17} fill="currentColor" /> 48</span><span>Local news</span></div>
      <PostActions isOpportunity={false} postId="farmers-market-community-table" />
    </article>
  )
}

function NeighborPost() {
  return (
    <article className={`${styles.storyCard} ${styles.compactStory}`}>
      <div className={styles.storyHeader}>
        <span className={styles.neighborAvatar}>M</span>
        <div><h2>mari_in_berkeley</h2><p>Neighborhood note · 4h ago</p></div>
        <button type="button" aria-label="Story options">•••</button>
      </div>
      <p className={styles.storyText}>The little free pantry on Sacramento is freshly stocked this morning. Thank you to everyone who keeps it moving.</p>
      <div className={styles.storyFooter}><span><Heart size={17} fill="currentColor" /> 59</span><span>Most appreciated today</span></div>
      <PostActions isOpportunity={false} postId="sacramento-free-pantry" />
    </article>
  )
}

function MyCalendar() {
  const week = [
    { day: 'MON', date: '10', items: [] },
    { day: 'TUE', date: '11', items: [] },
    { day: 'WED', date: '12', items: [{ time: '5:30', title: 'Open studio night', kind: 'open' }] },
    { day: 'THU', date: '13', items: [{ time: '6:00', title: 'Onboarding session', kind: 'onboarding' }] },
    { day: 'FRI', date: '14', items: [] },
    { day: 'SAT', date: '15', items: [{ time: '10:00', title: 'Pantry packing', kind: 'service' }] },
    { day: 'SUN', date: '16', items: [] },
  ]

  return (
    <section className={styles.calendarView} aria-label="My Calendar">
      <div className={styles.calendarHeader}><div><p className={styles.eyebrow}>My Calendar</p><h2>August 10–16</h2></div><div><button type="button" aria-label="Previous week"><ChevronLeft size={16} /></button><button type="button" aria-label="Next week"><ChevronRight size={16} /></button></div></div>
      <p className={styles.calendarNote}>Your commitments appear here alongside public city events you may want to join.</p>
      <div className={styles.weekGrid}>
        {week.map((day) => <div className={day.date === '12' ? styles.currentDay : undefined} key={day.day}><span>{day.day}</span><strong>{day.date}</strong>{day.items.map((item) => <button type="button" className={styles[item.kind]} key={item.title}><small>{item.time}</small>{item.title}</button>)}</div>)}
      </div>
      <div className={styles.calendarLegend}><span><i className={styles.service} /> Your commitment</span><span><i className={styles.onboarding} /> Onboarding</span><span><i className={styles.open} /> City event</span></div>
      <section className={styles.calendarEmpty}><CalendarDays size={20} /><div><b>Your calendar is open.</b><p>Add an opportunity when you&apos;re ready to show up.</p></div></section>
    </section>
  )
}

export function MyCityFeedContent() {
  const [view, setView] = useState<FeedView>('news')
  const activeView = views.find((item) => item.key === view)!

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

      {view === 'calendar' ? <MyCalendar /> : <>
        <div className={styles.feedTitle}><p className={styles.eyebrow}>{activeView.description}</p><button type="button">Most relevant <ChevronDown size={15} /></button></div>
        {view === 'news' && <><LocalNewsPost /><OrganizationOpportunityPost /></>}
        {view === 'organizations' && <><OrganizationOpportunityPost /><OrganizationUpdatePost /></>}
        {view === 'trending' && <><NeighborPost /><OrganizationUpdatePost /></>}
      </>}
    </>
  )
}
