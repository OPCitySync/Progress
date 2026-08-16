import Link from 'next/link'
import {
  ArrowUpRight,
  CalendarRange,
  CheckCircle2,
  Download,
  FileCheck2,
  FileText,
  HeartHandshake,
  UsersRound,
} from 'lucide-react'
import { eq } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { orgs } from '@/lib/db/schema'
import { listOrganizationActivity } from '@/lib/services/organization-activity'
import { orgReportSummary } from '@/lib/services/reports'
import { LabHeader } from '../../LabHeader'
import { getLabWorkspace } from '../../lab-workspace'
import { IssuerLabSidebar } from '../IssuerLabSidebar'
import styles from '../../prototype.module.css'

export const dynamic = 'force-dynamic'

function eventTitle(type: string) {
  return type.toLowerCase().split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

export default async function IssuerReportsLabPage() {
  const session = await requireRole('issuer')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const orgId = session.orgId!
  const [org, summary, activity] = await Promise.all([
    db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1).then((rows) => rows[0] ?? null),
    orgReportSummary(orgId),
    listOrganizationActivity(orgId),
  ])
  const current = new Date()
  const reportPeriod = `${current.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} · All time`
  const impactRows = [
    { label: 'Volunteer hours', value: summary.hours.toLocaleString(), growth: 'Verified time across completed shifts', width: 'seventy' },
    { label: 'Verified contributions', value: summary.verifiedCompletions.toLocaleString(), growth: 'Completed records retained', width: 'ninety' },
    { label: 'Volunteers served', value: summary.volunteers.toLocaleString(), growth: 'People with verified activity', width: 'eighty' },
  ]

  return (
    <main className={styles.app}>
      <LabHeader activeSection="issuer-reports" workspace="issuer" session={session} city={city} cities={cities} contexts={contexts} />
      <div className={styles.issuerLayout}>
        <IssuerLabSidebar active="reports" organizationName={org?.name} cityName={city?.name} />

        <section className={styles.issuerMain} aria-label="Organization reports">
          <section className={styles.issuerPageHero}>
            <div><p className={styles.eyebrow}>Impact &amp; reports</p><h1>Make your work easy to tell.</h1><p>City/Sync turns the volunteer work you have already coordinated into organized, exportable reporting context.</p></div>
            <a href="/api/reports?type=contributions" className={styles.issuerPrimaryAction}><Download size={17} /> Export report</a>
          </section>

          <section className={styles.reportPeriodCard}>
            <div><p className={styles.eyebrow}>Reporting period</p><h2>{reportPeriod}</h2><span>{city?.name ?? 'Your active city'}</span></div>
            <div className={styles.reportPeriodActions}><span><CalendarRange size={16} /> All retained activity</span><span><FileText size={16} /> CSV-ready report</span></div>
          </section>

          <section className={styles.reportImpactCard}>
            <div className={styles.issuerPanelHeading}><div><p className={styles.eyebrow}>Verified activity</p><h2>Impact at a glance</h2></div><CheckCircle2 size={19} /></div>
            <div className={styles.reportImpactRows}>
              {impactRows.map((row) => <article key={row.label}><div><span>{row.label}</span><strong>{row.value}</strong></div><i><b className={styles[row.width]} /></i><small>{row.growth}</small></article>)}
            </div>
          </section>

          <section className={styles.reportStoryGrid}>
            <section className={styles.reportNarrativeCard}><span><HeartHandshake size={22} /></span><div><p className={styles.eyebrow}>Your report, in plain language</p><h2>{summary.volunteers} volunteer{summary.volunteers === 1 ? '' : 's'} completed {summary.verifiedCompletions} verified contribution{summary.verifiedCompletions === 1 ? '' : 's'}.</h2><p>{summary.hours} documented service hour{summary.hours === 1 ? '' : 's'} are retained with the related shift and opportunity records.</p></div><a href="/api/reports?type=contributions">Download CSV <ArrowUpRight size={14} /></a></section>
            <section className={styles.reportComplianceCard}><FileCheck2 size={21} /><p className={styles.eyebrow}>Reporting readiness</p><h2>Your record is up to date.</h2><ul><li>Opportunity history retained</li><li>Volunteer completions verified</li><li>Organization activity logged</li></ul><a href="#activity">Review activity log <ArrowUpRight size={14} /></a></section>
          </section>

          <section className={styles.reportActivityCard} id="activity">
            <div className={styles.issuerPanelHeading}><div><p className={styles.eyebrow}>Activity log</p><h2>A clear record of what happened</h2></div><UsersRound size={18} /></div>
            <div className={styles.reportActivityList}>{activity.length === 0 ? <p className={styles.emptyCopy}>Actions taken for this organization will appear here.</p> : activity.slice(0, 6).map((item) => <article key={item.hash}><span>{new Date(item.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span><div><h3>{eventTitle(item.type)}</h3><p>Recorded by {item.actorName}</p></div><ArrowUpRight size={16} /></article>)}</div>
          </section>
        </section>
      </div>
    </main>
  )
}
