import Link from 'next/link'
import { ContactRound, History, FileText } from 'lucide-react'
import styles from '../prototype.module.css'

export function PassportTabs({ active }: { active: 'profile' | 'history' | 'resume' }) {
  return <nav className={styles.coordinationTabs} aria-label="Volunteer Passport">
    {[
      { id: 'profile', label: 'Profile', href: '/aesthetic-lab/passport', icon: ContactRound },
      { id: 'history', label: 'History', href: '/aesthetic-lab/passport?tab=history', icon: History },
      { id: 'resume', label: 'Resume', href: '/aesthetic-lab/passport?tab=resume', icon: FileText },
    ].map(({ id, label, href, icon: Icon }) => <Link key={id} href={href} aria-current={active === id ? 'page' : undefined}><Icon size={16} />{label}</Link>)}
  </nav>
}
