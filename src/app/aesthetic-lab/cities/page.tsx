import Link from 'next/link'
import { MapPinned, Plus, CheckCircle2 } from 'lucide-react'
import { requireSession } from '@/lib/auth/session'
import { joinCityNetworkAction, switchCityAction } from '@/app/actions'
import { getAvailableCities } from '@/lib/services/city-networks'
import { getLabWorkspace } from '../lab-workspace'
import { LabHeader } from '../LabHeader'
import { LabNotice } from '../LabNotice'
import styles from '../prototype.module.css'

export const dynamic = 'force-dynamic'

export default async function LabCitiesPage({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const session = await requireSession()
  const { city, cities, contexts } = await getLabWorkspace(session)
  const available = await getAvailableCities()
  const joined = new Set(cities.map((network) => network.id))
  const isIssuer = session.role === 'issuer'

  return <main className={styles.app}>
    <LabHeader activeSection={isIssuer ? 'issuer-overview' : 'feed'} workspace={isIssuer ? 'issuer' : 'participant'} session={session} city={city} cities={cities} contexts={contexts} />
    <section className={styles.detailLayout}>
      <aside className={styles.leftRail}><section className={styles.cityCard}><div className={styles.cityName}><MapPinned size={18} /><span>My Cities</span></div><p>Your active city determines the local opportunities, organizations, and records you see.</p><Link href={isIssuer ? '/aesthetic-lab/issuer' : '/aesthetic-lab'}>Return to workspace</Link></section></aside>
      <section className={styles.primaryColumn}>
        <div className={styles.pageIntro}><p className={styles.eyebrow}>City networks</p><h1>Your local contexts.</h1><p>{isIssuer ? 'Organizations operate only in cities where they are onboarded.' : 'You can add a City/Sync network, then complete local onboarding before claiming regular opportunities.'}</p></div>
        <LabNotice ok={searchParams.ok} error={searchParams.error} />
        <section className={`${styles.labPanel} ${styles.labStack}`}>
          <div><p className={styles.eyebrow}>Available networks</p><h2>Choose where you are participating.</h2></div>
          <div className={styles.labChoiceList}>{available.map((network) => {
            const member = joined.has(network.id)
            const active = network.id === city?.id
            const participation = cities.find((item) => item.id === network.id)?.participation
            return <article className={styles.labChoice} key={network.id}><div><p><strong>{network.name}</strong> {active ? <CheckCircle2 size={15} /> : null}</p><small>{network.description || 'A City/Sync local network.'}{participation ? ` · ${participation.status === 'active' ? 'City Member' : 'New Participant'}` : ''}</small></div>{member ? <form action={switchCityAction}><input type="hidden" name="cityId" value={network.id} /><input type="hidden" name="redirectTo" value="/aesthetic-lab/cities" /><button className={`${styles.labButton} ${active ? styles.labButtonSecondary : ''}`} type="submit" disabled={active}>{active ? 'Current city' : 'Switch city'}</button></form> : !isIssuer ? <form action={joinCityNetworkAction}><input type="hidden" name="cityId" value={network.id} /><input type="hidden" name="redirectTo" value="/aesthetic-lab/cities" /><button className={styles.labButton} type="submit"><Plus size={15} /> Add city</button></form> : <span>Organization access required</span>}</article>
          })}</div>
        </section>
      </section>
    </section>
  </main>
}
