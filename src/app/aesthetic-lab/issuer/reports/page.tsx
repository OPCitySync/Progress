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
import { LabHeader } from '../../LabHeader'
import { IssuerLabSidebar } from '../IssuerLabSidebar'
import styles from '../../prototype.module.css'

const impactRows = [
  { label: 'Volunteer hours', value: '148', growth: '+18% from last month', width: 'seventy' },
  { label: 'Food boxes packed', value: '486', growth: '+12% from last month', width: 'ninety' },
  { label: 'Neighbors served', value: '312', growth: '+9% from last month', width: 'eighty' },
]

const activity = [
  { date: 'Today', title: 'Pantry packing crew scheduled', detail: '12 volunteer spots published for Saturday' },
  { date: 'Aug 10', title: '12 service records verified', detail: 'Hours added to individual participant histories' },
  { date: 'Aug 08', title: 'Monthly impact snapshot ready', detail: 'Downloadable record prepared for your reporting file' },
]

export default function IssuerReportsLabPage() {
  return (
    <main className={styles.app}>
      <LabHeader activeSection="issuer-reports" workspace="issuer" />
      <div className={styles.issuerLayout}>
        <IssuerLabSidebar active="reports" />

        <section className={styles.issuerMain} aria-label="Organization reports">
          <section className={styles.issuerPageHero}>
            <div><p className={styles.eyebrow}>Impact & reports</p><h1>Make your work easy to tell.</h1><p>City/Sync turns the volunteer work you have already coordinated into organized, exportable reporting context.</p></div>
            <button type="button" className={styles.issuerPrimaryAction}><Download size={17} /> Export report</button>
          </section>

          <section className={styles.reportPeriodCard}>
            <div><p className={styles.eyebrow}>Reporting period</p><h2>August 1–12, 2026</h2><span>Berkeley, California</span></div>
            <div className={styles.reportPeriodActions}><button type="button"><CalendarRange size={16} /> Change range</button><button type="button"><FileText size={16} /> Customize report</button></div>
          </section>

          <section className={styles.reportImpactCard}>
            <div className={styles.issuerPanelHeading}><div><p className={styles.eyebrow}>Verified activity</p><h2>Impact at a glance</h2></div><CheckCircle2 size={19} /></div>
            <div className={styles.reportImpactRows}>
              {impactRows.map((row) => <article key={row.label}><div><span>{row.label}</span><strong>{row.value}</strong></div><i><b className={styles[row.width]} /></i><small>{row.growth}</small></article>)}
            </div>
          </section>

          <section className={styles.reportStoryGrid}>
            <section className={styles.reportNarrativeCard}><span><HeartHandshake size={22} /></span><div><p className={styles.eyebrow}>Your report, in plain language</p><h2>23 volunteers coordinated 148 hours of food-access work this month.</h2><p>They packed and delivered 486 food boxes to 312 Berkeley neighbors—with each shift and completion retained as a verifiable operational record.</p></div><button type="button">Copy summary <ArrowUpRight size={14} /></button></section>
            <section className={styles.reportComplianceCard}><FileCheck2 size={21} /><p className={styles.eyebrow}>Reporting readiness</p><h2>Your record is up to date.</h2><ul><li>Opportunity history retained</li><li>Volunteer completions verified</li><li>Current waiver attached</li></ul><a href="#">Open reporting checklist <ArrowUpRight size={14} /></a></section>
          </section>

          <section className={styles.reportActivityCard}>
            <div className={styles.issuerPanelHeading}><div><p className={styles.eyebrow}>Activity log</p><h2>A clear record of what happened</h2></div><UsersRound size={18} /></div>
            <div className={styles.reportActivityList}>{activity.map((item) => <article key={item.title}><span>{item.date}</span><div><h3>{item.title}</h3><p>{item.detail}</p></div><ArrowUpRight size={16} /></article>)}</div>
          </section>
        </section>
      </div>
    </main>
  )
}
