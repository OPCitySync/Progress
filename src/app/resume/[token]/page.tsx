import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { cache } from 'react'
import { Building2, CalendarDays, Check, ShieldCheck } from 'lucide-react'
import { notFound } from 'next/navigation'
import { fmtDate } from '@/lib/format'
import type { ResumeContribution } from '@/lib/services/resume'
import { getResumeByToken } from '@/lib/services/resume'
import styles from './PublicResume.module.css'

export const dynamic = 'force-dynamic'
const getPublicResume = cache(getResumeByToken)

function contributionDate(contribution: ResumeContribution) {
  if (contribution.when) return fmtDate(contribution.when)
  if (contribution.whenLabel) return contribution.whenLabel
  return fmtDate(contribution.verifiedAt)
}

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const data = await getPublicResume(params.token)
  if (!data) return { title: 'Résumé not found · MyCity' }
  return {
    title: `${data.name} · Volunteer résumé · MyCity`,
    description: `${data.totals.contributions} verified volunteer contributions and ${data.totals.hours} recorded service hours.`,
  }
}

export default async function PublicResumePage({ params }: { params: { token: string } }) {
  const data = await getPublicResume(params.token)
  if (!data) notFound()

  return (
    <div className={styles.shell}>
      <header className={styles.appHeader}>
        <div className={styles.studioBar}><span aria-hidden="true" /> Coordination Studio</div>
        <div className={styles.headerMain}>
          <Link href="/" aria-label="MyCity home" className={styles.logoLink}>
            <Image src="/brand/mycity-logo-gold-blue-on-white.svg" alt="mycity" width={150} height={52} priority />
          </Link>
          <span className={styles.publicLabel}>Public Volunteer Résumé</span>
        </div>
      </header>

      <main className={styles.page}>
        <article className={styles.resume}>
          <header className={styles.hero}>
            <div>
              <span className={styles.eyebrow}>MyCity · Volunteer Résumé</span>
              <h1>{data.name}</h1>
              <p>Volunteer since {fmtDate(data.joinedAt)}</p>
            </div>
            <span className={styles.verified}><ShieldCheck size={16} aria-hidden="true" /> Verified experience</span>
          </header>

          <section className={styles.totals} aria-label="Volunteer résumé totals">
            <div><strong>{data.totals.contributions}</strong><span>Contributions</span></div>
            <div><strong>{data.totals.hours}</strong><span>Volunteer hours</span></div>
            <div><strong>{data.totals.organizations}</strong><span>Organizations</span></div>
          </section>

          <section className={styles.experience}>
            <header className={styles.sectionHeader}>
              <div><span className={styles.eyebrow}>Organization verified</span><h2>Volunteer Experience</h2></div>
              <span className={styles.count}>{data.totals.contributions} {data.totals.contributions === 1 ? 'record' : 'records'}</span>
            </header>
            {data.contributions.length ? (
              <div className={styles.entries}>
                {data.contributions.map((contribution) => (
                  <article className={styles.entry} key={contribution.claimId}>
                    <span className={styles.entryIcon} aria-hidden="true"><Check size={16} /></span>
                    <div className={styles.entryCopy}>
                      <h3>{contribution.opportunity}</h3>
                      <p>
                        <span><Building2 size={13} aria-hidden="true" />
                          {contribution.orgSlug ? <Link href={`/orgs/${contribution.orgSlug}`}>{contribution.org}</Link> : contribution.org}
                        </span>
                        <span><CalendarDays size={13} aria-hidden="true" /> {contributionDate(contribution)}</span>
                      </p>
                    </div>
                    <span className={styles.hours}>{contribution.hours != null ? `${contribution.hours} hours` : 'Verified contribution'}</span>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.empty}><h3>No verified contributions yet</h3><p>Completed and verified work will appear here.</p></div>
            )}
          </section>

          <aside className={styles.verification}>
            <ShieldCheck size={21} aria-hidden="true" />
            <div><strong>Organization verified</strong><p>Every contribution shown here was confirmed by the volunteer organization that issued the record.</p></div>
          </aside>

          <footer>Shared by the volunteer through MyCity. This page contains only the verified experience they chose to make public.</footer>
        </article>
      </main>
    </div>
  )
}
