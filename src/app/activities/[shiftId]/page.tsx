import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  Check,
  Clock3,
  ExternalLink,
  FileText,
  MapPin,
  ShieldCheck,
  UsersRound,
} from 'lucide-react'
import { claimShiftAction, signUpAction, signWaiverAction } from '@/app/actions'
import { Logo } from '@/components/brand/Logo'
import { getSession } from '@/lib/auth/session'
import { credentialLabel } from '@/lib/credentials'
import { organizationFileUrl } from '@/lib/storage/organization-file-url'
import { getPublicActivity, type PublicActivityAvailability } from '@/lib/services/public-activities'
import type { ClaimGate } from '@/lib/services/opportunities'
import styles from './public-activity.module.css'

export const dynamic = 'force-dynamic'

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function dateParts(startsAt: number | null, endsAt: number | null, label: string) {
  if (!startsAt) return { date: label || 'Date to be announced', time: 'Time to be announced' }
  const date = new Date(startsAt).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
  const start = new Date(startsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const end = endsAt
    ? new Date(endsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : null
  return { date, time: end ? `${start}–${end}` : start }
}

function availabilityCopy(state: PublicActivityAvailability, spotsLeft: number) {
  if (state === 'open') return { label: `${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} open`, title: 'Join this activity' }
  if (state === 'full') return { label: 'Activity full', title: 'This activity is full' }
  if (state === 'started') return { label: 'In progress', title: 'This activity has started' }
  if (state === 'ended') return { label: 'Activity ended', title: 'This activity has ended' }
  return { label: 'Sign-ups closed', title: 'Sign-ups are closed' }
}

function gateMessage(gate: ClaimGate | null) {
  if (!gate || gate.ok) return ''
  if (gate.reason === 'waiver_required') return 'Complete every required waiver below before confirming your spot.'
  if (gate.reason === 'credentials_required') {
    return `This activity requires ${gate.missing.map(credentialLabel).join(', ')}. Ask the organization to verify these qualifications.`
  }
  return gate.error
}

export async function generateMetadata({ params }: { params: { shiftId: string } }): Promise<Metadata> {
  const activity = await getPublicActivity(params.shiftId)
  if (!activity) return { title: 'Activity unavailable · MyCity' }
  const description = activity.task.description || `Volunteer with ${activity.organization.name} in ${activity.city.name}.`
  const image = activity.profile?.coverUrl || activity.profile?.logoUrl || undefined
  return {
    title: `${activity.task.title} · ${activity.organization.name} · MyCity`,
    description,
    alternates: { canonical: `/activities/${activity.shift.id}` },
    openGraph: {
      title: activity.task.title,
      description,
      type: 'website',
      images: image ? [{ url: image }] : undefined,
    },
  }
}

export default async function PublicActivityPage({
  params,
  searchParams,
}: {
  params: { shiftId: string }
  searchParams: { ok?: string; error?: string }
}) {
  const session = await getSession()
  const activity = await getPublicActivity(params.shiftId, session?.role === 'participant' ? session.sub : undefined)
  if (!activity) notFound()

  const { shift, task, organization, profile, city, program } = activity
  const when = dateParts(shift.startsAt, shift.endsAt, shift.label)
  const availability = availabilityCopy(activity.availability, activity.spotsLeft)
  const pagePath = `/activities/${shift.id}`
  const gateCopy = gateMessage(activity.claimGate)
  const unsignedWaivers = activity.waivers.filter((waiver) => !activity.signedWaiverIds.has(waiver.id))
  const canSubmit = activity.availability === 'open' && activity.claimGate?.ok === true && unsignedWaivers.length === 0
  const isParticipant = session?.role === 'participant'

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <div className="flex items-center gap-4">
            <Logo variant="on-white" size={34} />
            <span className={styles.topbarContext}>Public volunteer activity</span>
          </div>
          <nav className={styles.topbarActions} aria-label="Public activity navigation">
            <Link className={styles.topbarLink} href={organization.slug ? `/orgs/${organization.slug}` : '/orgs'}>
              <Building2 size={15} /> {organization.name}
            </Link>
            {session ? (
              <Link className={styles.primaryButton} href={session.role === 'participant' ? '/mycity#/volunteer/work' : '/mycity#/coordinator/home'}>
                Open MyCity <ArrowRight size={15} />
              </Link>
            ) : (
              <Link className={styles.primaryButton} href={`/login?next=${encodeURIComponent(pagePath)}`}>
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>{program?.name || 'Open volunteer activity'} · {city.name}</p>
            <h1>{task.title}</h1>
            {task.description ? <p className={styles.heroDescription}>{task.description}</p> : null}
            <Link className={styles.heroOrganization} href={organization.slug ? `/orgs/${organization.slug}` : '/orgs'}>
              {profile?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={styles.orgLogo} src={profile.logoUrl} alt="" />
              ) : <span className={styles.orgMark}>{initials(organization.name)}</span>}
              <span>Hosted by {organization.name}</span>
              <ExternalLink size={14} />
            </Link>
          </div>
        </section>

        <section className={styles.statusStrip} aria-label="Activity details">
          <div className={styles.fact}><CalendarDays /><div><span>Date</span><strong>{when.date}</strong></div></div>
          <div className={styles.fact}><Clock3 /><div><span>Time</span><strong>{when.time}</strong></div></div>
          <div className={styles.fact}><MapPin /><div><span>Location</span><strong>{task.location || 'Location to be announced'}</strong></div></div>
          <div className={styles.fact}><UsersRound /><div><span>Availability</span><strong>{availability.label}</strong></div></div>
        </section>

        <div className={styles.layout}>
          <div className={styles.contentColumn}>
            <section className={styles.card}>
              <header className={styles.cardHeader}><h2>What you’ll do</h2><span>{organization.name}</span></header>
              <div className={styles.cardBody}>
                <p className={styles.bodyCopy}>{task.description || 'The organization will share final activity details with confirmed volunteers.'}</p>
              </div>
            </section>

            {(task.beforeSession || task.bringItems || activity.waivers.length > 0) ? (
              <section className={styles.card}>
                <header className={styles.cardHeader}><h2>Come prepared</h2><span>What to know before you arrive</span></header>
                <div className={styles.cardBody}>
                  <div className={styles.prepGrid}>
                    {task.beforeSession ? <div className={styles.prepItem}><span className={styles.prepIcon}><BadgeCheck /></span><h3>Before the activity</h3><p>{task.beforeSession}</p></div> : null}
                    {task.bringItems ? <div className={styles.prepItem}><span className={styles.prepIcon}><FileText /></span><h3>What to bring</h3><p>{task.bringItems}</p></div> : null}
                    {activity.waivers.length ? <div className={styles.prepItem}><span className={styles.prepIcon}><ShieldCheck /></span><h3>Liability waiver</h3><p>{activity.waivers.length === 1 ? 'One digital waiver must be reviewed and signed before a spot can be confirmed.' : `${activity.waivers.length} digital waivers must be reviewed and signed before a spot can be confirmed.`}</p></div> : null}
                  </div>
                </div>
              </section>
            ) : null}

            <section className={styles.card}>
              <header className={styles.cardHeader}><h2>How public sign-up works</h2><span>A clear path to a confirmed spot</span></header>
              <div className={styles.cardBody}>
                <div className={styles.steps}>
                  <div className={styles.step}><span className={styles.stepNumber}>1</span><div><h3>Use your personal MyCity account</h3><p>Create an account here or sign in. Your contact details stay private from the public page.</p></div></div>
                  <div className={styles.step}><span className={styles.stepNumber}>2</span><div><h3>Complete the activity requirements</h3><p>Review any assigned waiver or qualification requirement before taking a place.</p></div></div>
                  <div className={styles.step}><span className={styles.stepNumber}>3</span><div><h3>Confirm your spot</h3><p>Your commitment appears in My Volunteering and the organization receives the updated roster.</p></div></div>
                </div>
              </div>
            </section>
          </div>

          <aside className={styles.joinCard} id="join" aria-label="Activity sign-up">
            <header className={styles.joinHeader}>
              <div className={styles.joinHeaderRow}>
                <h2>{availability.title}</h2>
                <span className={`${styles.availability} ${activity.availability === 'open' ? '' : styles.availabilityClosed}`}>{availability.label}</span>
              </div>
              <p>{activity.availability === 'open' ? 'Complete the steps below to reserve one place.' : 'This shared page remains available for reference.'}</p>
            </header>
            <div className={styles.joinBody}>
              {searchParams.ok ? <div className={styles.notice}>{searchParams.ok}</div> : null}
              {searchParams.error ? <div className={`${styles.notice} ${styles.errorNotice}`}>{searchParams.error}</div> : null}

              {activity.hasActiveClaim ? (
                <div className={styles.confirmed}>
                  <span className={styles.confirmedIcon}><Check /></span>
                  <h3>Your spot is confirmed</h3>
                  <p>This activity is now part of your My Volunteering schedule.</p>
                  <Link className={styles.secondaryButton} href="/mycity#/volunteer/schedule">View My Volunteering <ArrowRight size={14} /></Link>
                </div>
              ) : activity.availability !== 'open' ? (
                <><h3>No new sign-ups are available</h3><p>Visit the organization profile to find another way to participate.</p>{organization.slug ? <Link className={`${styles.secondaryButton} mt-4 w-full`} href={`/orgs/${organization.slug}`}>View {organization.name}</Link> : null}</>
              ) : !session ? (
                <>
                  <h3>Create your Civic Participant account</h3>
                  <p>You’ll return to this activity after account creation to complete any waiver and confirm your spot.</p>
                  <form action={signUpAction} className={styles.accountForm}>
                    <input type="hidden" name="kind" value="participant" />
                    <input type="hidden" name="cityId" value={city.id} />
                    <input type="hidden" name="next" value={pagePath} />
                    <input type="hidden" name="redirectTo" value={pagePath} />
                    <label>Full name<input name="name" required autoComplete="name" /></label>
                    <label>Email<input name="email" type="email" required autoComplete="email" /></label>
                    <label>Password<input name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
                    <button className={styles.primaryButton} type="submit">Create account and continue <ArrowRight size={15} /></button>
                  </form>
                  <p className={styles.signInPrompt}>Already use MyCity? <Link href={`/login?next=${encodeURIComponent(pagePath)}`}>Sign in to continue</Link></p>
                </>
              ) : !isParticipant ? (
                <><h3>Open your personal profile</h3><p>Volunteer spots are attached to a Civic Participant profile. Switch from the organization workspace to your personal profile, then return to this page.</p><Link className={`${styles.secondaryButton} mt-4 w-full`} href="/mycity">Open MyCity</Link></>
              ) : (
                <>
                  <h3>Complete your sign-up</h3>
                  <p>Signed in as {session.name}. Review the requirements, then confirm your attendance.</p>

                  {activity.waivers.length ? <div className={styles.waiverList}>{activity.waivers.map((waiver) => {
                    const signed = activity.signedWaiverIds.has(waiver.id)
                    return <details className={styles.waiver} key={waiver.id} open={!signed}>
                      <summary><ShieldCheck /><span>{waiver.title}</span>{signed ? <em className={styles.signed}><Check size={13} /> Signed</em> : <em>Required</em>}</summary>
                      <div className={styles.waiverContent}>
                        <p>{waiver.body || 'This waiver is provided as a source document. Open the document and review it before signing.'}</p>
                        {waiver.documentUrl ? <a className={styles.documentLink} href={organizationFileUrl('waiver', waiver.id, task.id)} target="_blank" rel="noreferrer"><ExternalLink size={13} /> View {waiver.documentName || 'waiver document'}</a> : null}
                        {!signed ? <form action={signWaiverAction} className={styles.waiverForm}>
                          <input type="hidden" name="taskId" value={task.id} />
                          <input type="hidden" name="waiverVersionId" value={waiver.id} />
                          <input type="hidden" name="redirectTo" value={pagePath} />
                          <label>Typed signature<input type="text" name="signerName" required minLength={2} maxLength={160} autoComplete="name" defaultValue={session.name} /></label>
                          <label className={styles.consent}><input type="checkbox" name="electronicConsent" value="yes" required /><span>I reviewed this waiver and intend my typed name to serve as my electronic signature for this version.</span></label>
                          <button className={styles.secondaryButton} type="submit">Sign waiver</button>
                        </form> : null}
                      </div>
                    </details>
                  })}</div> : null}

                  {gateCopy && activity.claimGate?.ok === false && activity.claimGate.reason !== 'waiver_required' ? <div className={styles.blocked}>{gateCopy}</div> : null}
                  {unsignedWaivers.length ? <div className={styles.blocked}>Sign {unsignedWaivers.length === 1 ? 'the required waiver' : `all ${unsignedWaivers.length} required waivers`} to activate the confirmation button.</div> : null}

                  <form action={claimShiftAction} className={styles.claimForm}>
                    <input type="hidden" name="taskId" value={task.id} />
                    <input type="hidden" name="shiftId" value={shift.id} />
                    <input type="hidden" name="redirectTo" value={pagePath} />
                    <input type="hidden" name="successRedirectTo" value={pagePath} />
                    <input type="hidden" name="waiverCollectionMethod" value="digital" />
                    <label className={styles.commitment}><input type="checkbox" name="attendanceAcknowledgement" value="yes" required disabled={!canSubmit} /><span>I intend to attend. If my plans change, I will withdraw before the activity.</span></label>
                    <button className={styles.primaryButton} type="submit" disabled={!canSubmit}>Confirm my spot <ArrowRight size={15} /></button>
                  </form>
                </>
              )}
            </div>
          </aside>
        </div>
      </main>

      <footer className={styles.footer}>MyCity · Community coordination through service</footer>
    </div>
  )
}
