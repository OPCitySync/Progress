import Link from 'next/link'
import {
  BadgeCheck,
  ShieldCheck,
} from 'lucide-react'
import styles from '../prototype.module.css'
import { IssuerQuickActions } from './IssuerQuickActions'

export function IssuerLabSidebar({
  organizationName = 'Issuer organization',
  organizationId,
  cityName,
}: {
  organizationName?: string
  organizationId?: string
  cityName?: string
}) {
  return (
    <aside className={styles.leftRail}>
      <section className={styles.issuerIdentityCard}>
        <div className={styles.issuerCover}><span>EB</span><i /><i /><i /></div>
        <div className={styles.issuerIdentityBody}>
          <p className={styles.eyebrow}>Issuer organization</p>
          <h1>{organizationName} <BadgeCheck size={17} /></h1>
          <p>{cityName ? `Issuer Organization · ${cityName}` : 'Issuer Organization'}</p>
          <div className={styles.issuerIdentityLinks}>
            <Link href="/aesthetic-lab/issuer/feed">MyCity Feed</Link>
            <Link href="/aesthetic-lab/issuer/manage">Manage Organization</Link>
          </div>
        </div>
      </section>

      <IssuerQuickActions organizationId={organizationId ?? organizationName} />

      <section className={styles.issuerTrustCard}>
        <ShieldCheck size={19} />
        <div><b>Verified organization</b><span>Your current waiver and public profile are complete.</span></div>
      </section>
    </aside>
  )
}
