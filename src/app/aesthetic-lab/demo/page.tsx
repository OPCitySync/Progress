import Link from 'next/link'
import {
  ArrowUpRight,
  Bookmark,
  Building2,
  CalendarDays,
  CheckCircle2,
  CloudSun,
  Compass,
  Heart,
  Home,
  MapPin,
  Newspaper,
  Sparkles,
  TrendingUp,
  UsersRound,
} from 'lucide-react'
import styles from '../prototype.module.css'

/**
 * Public, read-only visual preview. It intentionally uses illustrative data and
 * never loads a City/Sync account, city ledger, or organization record.
 */
export default function AestheticLabDemoPage() {
  const signInHref = '/login?next=%2Faesthetic-lab'

  return (
    <main className={styles.app}>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <Link href="/aesthetic-lab/demo" className={styles.brand} aria-label="City/Sync Aesthetics Lab demo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/citysync-wordmark-dark.svg" alt="City/Sync" />
          </Link>
          <nav className={styles.sectionNav} aria-label="Aesthetics Lab preview sections">
            <span className={styles.activeSection}><span className={styles.sectionNavActive}><Home size={18} /></span><span className={styles.currentSectionName}>Home</span></span>
            <a href="#preview"><Compass size={18} /><span>Opportunities</span></a>
            <a href="#preview"><Building2 size={18} /><span>Discover Organizations</span></a>
            <a href="#preview"><Bookmark size={18} /><span>Service History</span></a>
          </nav>
          <div className={styles.demoTopbarActions}>
            <span className={styles.demoPill}>Public design preview</span>
            <Link href={signInHref} className={styles.demoSignIn}>Open live workspace <ArrowUpRight size={14} /></Link>
          </div>
        </div>
      </header>

      <div className={styles.layout}>
        <aside className={styles.leftRail}>
          <section className={styles.cityCard}>
            <div className={styles.cityCardTop}><span className={styles.cityOverline}>Your city network</span><MapPin size={16} /></div>
            <div className={styles.cityName}><MapPin size={17} /><span>Berkeley, California</span></div>
            <p>A shared place to show up, help out, and see local progress.</p>
            <Link href={signInHref}>Explore the live city network <ArrowUpRight size={14} /></Link>
          </section>

          <section className={styles.impactCard}>
            <p className={styles.eyebrow}>Your impact</p>
            <div className={styles.impactGrid}>
              <div><strong>02</strong><span>Active shifts</span></div>
              <div><strong>18h</strong><span>Service record</span></div>
              <div><strong>04</strong><span>Organizations</span></div>
            </div>
            <Link href={signInHref}><Bookmark size={15} /> View service history</Link>
          </section>

          <section className={styles.quickLinks}>
            <Link href={signInHref}><CalendarDays size={17} /> My commitments</Link>
            <Link href={signInHref}><Building2 size={17} /> Discover organizations</Link>
            <Link href={signInHref}><Heart size={17} /> Saved opportunities</Link>
          </section>
        </aside>

        <section className={styles.feed} aria-label="MyCity Feed design preview" id="preview">
          <div className={styles.welcomeBand}>
            <div><p className={styles.eyebrow}>City/Sync Berkeley</p><h1>There are good things happening today.</h1></div>
          </div>

          <section className={styles.demoNotice}>
            <Sparkles size={18} /><span><b>Design preview</b> This page uses illustrative content only. Sign in to see live local opportunities and updates.</span>
          </section>

          <section className={styles.feedFilters} aria-label="Preview filters">
            <p className={styles.eyebrow}>Filters</p>
            <div><button type="button" className={styles.feedFilterActive}><Newspaper size={16} /> News</button><button type="button"><Building2 size={16} /> Organizations</button><button type="button"><TrendingUp size={16} /> Trending</button><button type="button"><CalendarDays size={16} /> My Calendar</button></div>
          </section>

          <div className={styles.feedTitle}><p className={styles.eyebrow}>Local news</p><span>Preview</span></div>

          <article className={`${styles.storyCard} ${styles.compactStory}`}>
            <div className={styles.storyHeader}><div className={styles.newsAvatar}>BN</div><div><h2>Berkeley Neighborhoods <CheckCircle2 size={15} /></h2><p>Local news partner · 2h ago</p></div></div>
            <p className={styles.storyText}>Neighborhood volunteers and organizations are preparing for a week of creek stewardship, tree care, and community gathering.</p>
            <div className={styles.storyFooter}><span><Heart size={17} /> 46</span><span>Posted to MyCity</span></div>
            <div className={styles.storyActions}><Link href={signInHref}><Bookmark size={17} /> Save</Link><Link href={signInHref}><ArrowUpRight size={17} /> Share</Link><Link href={signInHref}><Heart size={17} /> Like</Link></div>
          </article>

          <article className={styles.storyCard}>
            <div className={styles.storyHeader}><div className={styles.orgAvatar}>BC</div><div><h2>Berkeley Creekkeepers <CheckCircle2 size={15} /></h2><p>Community organization · 4h ago</p></div></div>
            <p className={styles.storyText}>Saturday&apos;s creek cleanup still has space for new volunteers. Tools, a short safety briefing, and a warm welcome are all provided.</p>
            <section className={styles.opportunityPreview}><div className={styles.actionIcon}><UsersRound size={19} /></div><div><p>Volunteer opportunity</p><h3>Creek cleanup · Saturday morning</h3><span>9:00 AM · Codornices Creek</span></div><Link href={signInHref}>View <ArrowUpRight size={15} /></Link></section>
            <div className={styles.storyFooter}><span><Heart size={17} /> 28</span><span>12 open spots</span></div>
            <div className={styles.storyActions}><Link href={signInHref}><Bookmark size={17} /> Save</Link><Link href={signInHref}><ArrowUpRight size={17} /> Share</Link><Link href={signInHref}><Heart size={17} /> Like</Link></div>
          </article>
        </section>

        <aside className={styles.rightRail}>
          <section className={styles.profileCard}>
            <div className={styles.profileCover}><i /><i /><i /></div>
            <div className={styles.profileBody}>
              <div className={styles.avatarLarge}>C</div>
              <div className={styles.profileTitle}><p className={styles.eyebrow}>Civic participant</p><h2>Your City/Sync profile</h2><p>Berkeley, California</p></div>
              <div className={styles.membershipStatus}><span><Sparkles size={15} /> City Member</span><p>Illustrative profile status for the public preview.</p><div><i /><i /><i /></div><Link href={signInHref}>Sign in to your profile <ArrowUpRight size={14} /></Link></div>
            </div>
          </section>

          <section className={styles.todayEventsCard}>
            <div className={styles.sectionHeading}><p className={styles.eyebrow}>Today&apos;s events</p><CalendarDays size={17} /></div>
            <div className={styles.todayEventList}>
              <Link href={signInHref}><span>10:00</span><div><b>Community garden tending</b><p>West Berkeley</p></div><ArrowUpRight size={14} /></Link>
              <Link href={signInHref}><span>14:00</span><div><b>Library welcome table</b><p>Central Library</p></div><ArrowUpRight size={14} /></Link>
              <Link href={signInHref}><span>17:30</span><div><b>Creek cleanup briefing</b><p>Codornices Creek</p></div><ArrowUpRight size={14} /></Link>
            </div>
            <Link className={styles.viewEventsLink} href={signInHref}>View live calendar <ArrowUpRight size={14} /></Link>
          </section>

          <section className={styles.cityPulse}>
            <div className={styles.sectionHeading}><p className={styles.eyebrow}>Berkeley pulse</p><span>Preview</span></div>
            <div className={styles.pulseItem}><i className={styles.sun} /><span><b>Active volunteers</b><small>156 people participating</small></span></div>
            <div className={styles.pulseItem}><i className={styles.blue} /><span><b>Contributions</b><small>482 verified locally</small></span></div>
            <div className={styles.pulseItem}><i className={styles.coral} /><span><b>Organizations</b><small>24 local partners</small></span></div>
          </section>
        </aside>
      </div>
    </main>
  )
}
