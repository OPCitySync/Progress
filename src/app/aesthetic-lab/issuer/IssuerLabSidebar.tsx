import Link from 'next/link'
import {
  BadgeCheck,
  CalendarDays,
  ClipboardList,
  FileBarChart2,
  Pencil,
  ShieldCheck,
  UsersRound,
} from 'lucide-react'
import styles from '../prototype.module.css'

type IssuerSidebarSection = 'overview' | 'catalog' | 'volunteers' | 'reports' | 'profile'

const navigation = [
  { key: 'overview', href: '/aesthetic-lab/issuer', label: 'Today’s workspace', icon: ClipboardList },
  { key: 'catalog', href: '/aesthetic-lab/issuer/catalog', label: 'Opportunity catalog', icon: CalendarDays },
  { key: 'volunteers', href: '/aesthetic-lab/issuer/volunteers', label: 'Volunteer roster', icon: UsersRound },
  { key: 'reports', href: '/aesthetic-lab/issuer/reports', label: 'Impact & reports', icon: FileBarChart2 },
] as const

export function IssuerLabSidebar({
  active,
  organizationName = 'Issuer organization',
  cityName,
}: {
  active: IssuerSidebarSection
  organizationName?: string
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
          <Link href="/aesthetic-lab/issuer/profile/edit"><Pencil size={14} /> Edit public profile</Link>
        </div>
      </section>

      <section className={styles.issuerSideNav}>
        <p className={styles.eyebrow}>Your organization</p>
        {navigation.map((item) => {
          const Icon = item.icon
          const selected = item.key === active
          return <Link className={selected ? styles.issuerSideActive : undefined} href={item.href} aria-current={selected ? 'page' : undefined} key={item.key}><Icon size={17} /> {item.label}</Link>
        })}
      </section>

      <section className={styles.issuerTrustCard}>
        <ShieldCheck size={19} />
        <div><b>Verified organization</b><span>Your current waiver and public profile are complete.</span></div>
      </section>
    </aside>
  )
}
