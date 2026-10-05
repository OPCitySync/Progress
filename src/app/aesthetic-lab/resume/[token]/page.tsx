import Link from 'next/link'
import { Award, Building2, CalendarDays, CheckCircle2 } from 'lucide-react'
import { getResumeByToken } from '@/lib/services/resume'
import styles from '../../prototype.module.css'

export const dynamic = 'force-dynamic'

export default async function PublicLabResumePage({ params }: { params: { token: string } }) {
  const resume = await getResumeByToken(params.token)
  if (!resume) return <main className={styles.app}><section className={styles.primaryColumn}><h1>Service record unavailable</h1><p>This service record is private or no longer available.</p><Link href="/">City/Sync</Link></section></main>
  return <main className={styles.app}><section className={styles.primaryColumn}><div className={styles.pageIntro}><p className={styles.eyebrow}>City/Sync service record</p><h1>{resume.name}</h1><p>{resume.totals.contributions} verified contribution{resume.totals.contributions === 1 ? '' : 's'} · {resume.totals.hours} service hour{resume.totals.hours === 1 ? '' : 's'} · {resume.totals.organizations} organization{resume.totals.organizations === 1 ? '' : 's'}</p></div><section className={`${styles.labPanel} ${styles.labStack}`}><div><Award size={21} /><h2>Verified service history</h2></div>{resume.contributions.length ? resume.contributions.map((entry) => <article className={styles.labChoice} key={`${entry.opportunity}-${entry.verifiedAt}`}><div><p><strong>{entry.opportunity}</strong></p><small><Building2 size={14} /> {entry.org} · <CalendarDays size={14} /> {entry.hours ? `${entry.hours} hours` : 'Verified contribution'}</small></div><CheckCircle2 size={18} /></article>) : <p className={styles.emptyCopy}>No verified contributions have been recorded.</p>}</section></section></main>
}
