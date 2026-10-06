'use client'

import { useState } from 'react'
import {
  ArrowLeft, ArrowUpRight, Bookmark, BriefcaseBusiness, CalendarDays,
  CheckCircle2, ChevronDown, ChevronRight, Clock3, Globe2, Heart, Leaf,
  MapPin, MessageCircle, MessageSquareText, Newspaper, Plus, Search,
  Share2, Sparkles, Users,
} from 'lucide-react'
import styles from './IssuerHomeConcept.module.css'

const organizationName = 'Berkeley Neighbors'

const posts = [
  {
    id: 'harvest', organization: 'Berkeley Community Garden', initials: 'BC',
    tone: 'green', location: 'South Berkeley', time: '42 min ago',
    body: 'The fall harvest is in. Thanks to 18 neighbors, fresh produce is headed to three community fridges this afternoon.',
    art: true, reactions: 38, comments: 7,
  },
  {
    id: 'welcome', organization: 'Berkeley Neighbors', initials: 'BN',
    tone: 'gold', location: 'Central Berkeley', time: '2 hr ago',
    body: 'A warm welcome to Maya, Daniel, and Ren. They completed orientation this week and are joining our neighborhood food access team.',
    reactions: 24, comments: 4,
  },
  {
    id: 'library', organization: 'Berkeley Public Library', initials: 'BL',
    tone: 'blue', location: 'Downtown Berkeley', time: 'Yesterday',
    body: 'Our fall repair café is looking for patient fixers, curious learners, and neighbors who can welcome guests. No expert experience required.',
    opportunity: 'Community Repair Café · October 17', reactions: 51, comments: 12,
  },
] as const

const quickLinks = [
  { icon: CalendarDays, label: 'Schedule Activity', detail: '2 this week' },
  { icon: Users, label: 'Volunteer Roster', detail: '42 people' },
  { icon: BriefcaseBusiness, label: 'Volunteer Programs', detail: '3 active' },
] as const

function ProfileMark({ small = false }: { small?: boolean }) {
  return <span className={`${styles.profileMark} ${small ? styles.smallMark : ''}`}>BN</span>
}

function FeedPost({ post, liked, onLike }: {
  post: (typeof posts)[number]
  liked: boolean
  onLike: () => void
}) {
  return (
    <article className={styles.feedPost}>
      <header className={styles.postHeader}>
        <span className={`${styles.postAvatar} ${styles[post.tone]}`}>{post.initials}</span>
        <div>
          <h2>{post.organization}</h2>
          <p><MapPin size={11} /> {post.location}<span>·</span>{post.time}</p>
        </div>
        <button type="button" aria-label={`More from ${post.organization}`}>•••</button>
      </header>
      <p className={styles.postBody}>{post.body}</p>
      {'art' in post && post.art ? (
        <div className={styles.harvestArt} aria-label="Illustration of produce gathered for community fridges">
          <span className={styles.artSun} />
          <span className={styles.artHill} />
          <span className={styles.artCrate}><Leaf size={34} /></span>
          <strong>Neighbors grew this.</strong>
        </div>
      ) : null}
      {'opportunity' in post && post.opportunity ? (
        <button type="button" className={styles.opportunityLink}>
          <span><CalendarDays size={15} /></span>
          <span><small>OPEN VOLUNTEER ACTIVITY</small><strong>{post.opportunity}</strong></span>
          <ChevronRight size={15} />
        </button>
      ) : null}
      <div className={styles.postSummary}>
        <span>{post.reactions + (liked ? 1 : 0)} neighbors appreciate this</span>
        <span>{post.comments} comments</span>
      </div>
      <footer className={styles.postActions}>
        <button type="button" className={liked ? styles.liked : ''} onClick={onLike}><Heart size={15} fill={liked ? 'currentColor' : 'none'} /> Appreciate</button>
        <button type="button"><MessageCircle size={15} /> Comment</button>
        <button type="button"><Share2 size={15} /> Share</button>
        <button type="button" aria-label="Bookmark"><Bookmark size={15} /></button>
      </footer>
    </article>
  )
}

function PublicProfile({ onBack }: { onBack: () => void }) {
  return (
    <div className={styles.publicProfile}>
      <div className={styles.profileModeBar}>
        <button type="button" onClick={onBack}><ArrowLeft size={14} /> Back to MyCity Feed</button>
        <span><Globe2 size={13} /> PUBLIC VIEW</span>
      </div>

      <section className={styles.publicHero}>
        <div className={styles.publicPattern}><span /><span /><span /></div>
        <div className={styles.publicIdentity}>
          <ProfileMark />
          <div>
            <p>COMMUNITY ORGANIZATION</p>
            <h1>{organizationName}</h1>
            <span><MapPin size={13} /> Berkeley, California</span>
          </div>
          <button type="button"><Heart size={14} /> Follow</button>
        </div>
      </section>

      <section className={styles.profileStatement}>
        <p>Neighbors making everyday life a little better, together.</p>
        <div>
          <span><strong>42</strong> active volunteers</span>
          <span><strong>316</strong> contributions</span>
          <span><strong>3</strong> active programs</span>
        </div>
      </section>

      <section className={styles.profileSection}>
        <header><span>OUR WORK</span><h2>Rooted in the neighborhood.</h2></header>
        <p>Berkeley Neighbors connects people who want to help with practical work that keeps our community cared for. We organize recurring food access, friendly visits for older neighbors, and seasonal neighborhood projects.</p>
        <div className={styles.causeList}><span>Food access</span><span>Neighbor support</span><span>Community resilience</span></div>
      </section>

      <section className={styles.impactFeature}>
        <div><Sparkles size={18} /><span><small>THIS MONTH</small><strong>486 grocery deliveries</strong><p>made possible by volunteers across five Berkeley neighborhoods.</p></span></div>
        <button type="button">See our impact <ArrowUpRight size={14} /></button>
      </section>

      <section className={styles.profileSection}>
        <header className={styles.sectionHeadingRow}>
          <div><span>GET INVOLVED</span><h2>Ways to contribute</h2></div>
          <button type="button">View all opportunities</button>
        </header>
        <div className={styles.opportunityGrid}>
          <article><span className={styles.opportunityIcon}><Users size={16} /></span><small>VOLUNTEER ROLE</small><h3>Neighborhood Food Team</h3><p>Help coordinate weekly packing and delivery.</p><button type="button">Learn more <ChevronRight size={13} /></button></article>
          <article><span className={styles.opportunityIcon}><CalendarDays size={16} /></span><small>ONE-TIME ACTIVITY</small><h3>Fall Pantry Reset</h3><p>Saturday, October 17 · 10:00 AM</p><button type="button">View activity <ChevronRight size={13} /></button></article>
        </div>
      </section>

      <section className={styles.profileSection}>
        <header><span>VOLUNTEER PROGRAMS</span><h2>Work with a clear purpose.</h2></header>
        <div className={styles.programRows}>
          <button type="button"><span>01</span><div><strong>Neighborhood Food Access</strong><small>Reliable groceries and delivery support for local households.</small></div><ChevronRight size={15} /></button>
          <button type="button"><span>02</span><div><strong>Connected Neighbors</strong><small>Friendly visits and practical support for older residents.</small></div><ChevronRight size={15} /></button>
        </div>
      </section>

      <footer className={styles.profileFooter}>
        <ProfileMark small />
        <div><strong>Have a question?</strong><span>Meet the people behind Berkeley Neighbors.</span></div>
        <button type="button">Contact Organization</button>
      </footer>
    </div>
  )
}

export default function IssuerHomeOperatingBrief() {
  const [view, setView] = useState<'feed' | 'profile'>('feed')
  const [filter, setFilter] = useState('All')
  const [liked, setLiked] = useState<string[]>([])
  const toggleLike = (id: string) => setLiked(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])

  return (
    <main className={styles.page}>
      <header className={styles.appHeader}>
        <div className={styles.appHeaderInner}>
          <div className={styles.brandLockup}>
            <img src="/brand/mycity-logo-gold-blue-on-white.svg" alt="mycity" />
            <span />
            <div><small>COORDINATION STUDIO</small><b>Organization Home Concept</b></div>
          </div>
          <nav className={styles.topNav} aria-label="Organization sections">
            <button type="button" className={styles.activeTopNav}>Home</button>
            <button type="button">Workspace</button><button type="button">Volunteers</button><button type="button">Public Profile</button>
          </nav>
          <div className={styles.headerContext}>
            <button type="button" className={styles.messageButton}><MessageSquareText size={15} /> Messages <span>3</span></button>
            <button type="button" className={styles.profileButton} aria-label={`${organizationName} profile`}><span>BN</span><ChevronDown size={14} /></button>
          </div>
        </div>
      </header>

      <div className={styles.feedChrome}>
        <div className={styles.feedTitle}>
          <div><Newspaper size={16} /><span><small>ORGANIZATION HOME</small><strong>{view === 'feed' ? 'MyCity Feed' : 'Public Profile'}</strong></span></div>
          <button type="button"><Plus size={14} /> Share an Update</button>
        </div>
      </div>

      <div className={styles.shell}>
        <div className={styles.threeColumnLayout}>
          <aside className={styles.leftRail}>
            <section className={styles.organizationCard}>
              <div className={styles.organizationCover}><span /><Leaf size={28} /></div>
              <div className={styles.organizationIdentity}>
                <ProfileMark />
                <h2>{organizationName}</h2>
                <span><MapPin size={11} /> Berkeley</span>
                <p>Neighbors making everyday life a little better, together.</p>
              </div>
              <button type="button" className={`${styles.publicProfileButton} ${view === 'profile' ? styles.profileButtonActive : ''}`} onClick={() => setView(view === 'profile' ? 'feed' : 'profile')}>
                {view === 'profile'
                  ? <><Newspaper size={15} /><span><strong>Return to Feed</strong><small>See what’s happening in your city</small></span></>
                  : <><Globe2 size={15} /><span><strong>View Public Profile</strong><small>See what your community sees</small></span></>}
                <ChevronRight size={15} />
              </button>
              <div className={styles.organizationLinks}>
                {quickLinks.map(item => { const Icon = item.icon; return <button type="button" key={item.label}><Icon size={14} /><span>{item.label}</span><small>{item.detail}</small></button> })}
              </div>
            </section>
          </aside>

          <section className={styles.centerColumn} aria-live="polite">
            {view === 'profile' ? <PublicProfile onBack={() => setView('feed')} /> : (
              <>
                <div className={styles.trendingBar}>
                  <div className={styles.feedFilters}>{['All', 'News', 'Organizations', 'Trending'].map(item => <button type="button" key={item} className={filter === item ? styles.activeFilter : ''} onClick={() => setFilter(item)}>{item}</button>)}</div>
                  <label><Search size={14} /><input aria-label="Search MyCity Feed" placeholder="Search MyCity" /></label>
                  <button type="button"><Bookmark size={14} /> Bookmarks</button>
                </div>
                <section className={styles.feedWelcome}>
                  <div><span><Sparkles size={12} /> YOUR CITY, IN MOTION</span><h1>Good work travels further when people can see it.</h1><p>Updates from organizations, neighbors, and local institutions across Berkeley.</p></div>
                  <span className={styles.feedWelcomeGraphic}><i /><i /><i /></span>
                </section>
                <div className={styles.composer}><ProfileMark small /><button type="button">Share an update with your city…</button><button type="button"><Plus size={14} /> Post</button></div>
                {posts.map(post => <FeedPost key={post.id} post={post} liked={liked.includes(post.id)} onLike={() => toggleLike(post.id)} />)}
              </>
            )}
          </section>

          <aside className={styles.rightRail}>
            <section className={styles.railCard}>
              <header><span>QUICK ACTIONS</span><h2>Move work forward</h2></header>
              <div className={styles.quickActionGrid}>
                <button type="button"><Plus size={13} /><span>Schedule Activity</span></button>
                <button type="button"><Plus size={13} /><span>Create a Role</span></button>
                <button type="button"><Plus size={13} /><span>Invite Volunteers</span></button>
                <button type="button"><Users size={13} /><span>Staff</span></button>
              </div>
            </section>

            <section className={styles.railCard}>
              <header><span>YOUR ORGANIZATION</span><h2>Today at a glance</h2></header>
              <div className={styles.todayRows}>
                <button type="button"><span className={styles.goldDot} /><div><strong>2 items need attention</strong><small>Applications and staffing</small></div><ChevronRight size={14} /></button>
                <button type="button"><CalendarDays size={15} /><div><strong>3 activities this week</strong><small>Next: Pantry packing, 9:00 AM</small></div><ChevronRight size={14} /></button>
                <button type="button"><Users size={15} /><div><strong>4 new volunteers</strong><small>Continue onboarding</small></div><ChevronRight size={14} /></button>
              </div>
            </section>

            <section className={styles.railCard}>
              <header><span>CITY PULSE</span><h2>People making it happen.</h2></header>
              <div className={styles.pulseRows}><p><i className={styles.greenDot} /> Organizations sharing<strong>28</strong></p><p><i className={styles.goldDot} /> Neighbors volunteering<strong>1,248</strong></p><p><i className={styles.blueDot} /> Open opportunities<strong>46</strong></p></div>
              <button type="button" className={styles.railTextButton}>Explore the City Network <ArrowUpRight size={13} /></button>
            </section>

            <section className={`${styles.railCard} ${styles.upcomingCard}`}>
              <header className={styles.calendarCardHeader}><div><span>COMING UP</span><h2>Your calendar</h2></div><button type="button"><CalendarDays size={12} /> Open Calendar</button></header>
              <div><span><strong>08</strong><small>OCT</small></span><p><strong>Garden Restoration</strong><small><Clock3 size={11} /> 10:00 AM · 6 volunteers</small></p></div>
              <div><span><strong>11</strong><small>OCT</small></span><p><strong>Senior Delivery Route</strong><small><Clock3 size={11} /> 11:00 AM · 4 volunteers</small></p></div>
              <button type="button" className={styles.railTextButton}>View full schedule <ChevronRight size={13} /></button>
            </section>

            <p className={styles.cityNote}><CheckCircle2 size={13} /> You’re viewing the same city context your volunteers see.</p>
          </aside>
        </div>
      </div>
    </main>
  )
}
