import Link from 'next/link'
import { Building2, CheckCircle2, Heart, Lightbulb, Sparkles } from 'lucide-react'
import { submitVolunteerReflectionAction } from '@/app/actions'
import { requireRole } from '@/lib/auth/session'
import { getVolunteerReflectionPrompt } from '@/lib/services/volunteer-reflections'
import { getLabWorkspace } from '../../lab-workspace'
import { LabHeader } from '../../LabHeader'
import { HistoryBackButton } from '../../HistoryBackButton'
import { LabNotice } from '../../LabNotice'
import styles from '../../prototype.module.css'

export const dynamic = 'force-dynamic'

function shiftDate(startsAt: number | null) {
  if (!startsAt) return 'your completed shift'
  return new Date(startsAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

export default async function VolunteerReflectionPage({
  params,
  searchParams,
}: {
  params: { claimId: string }
  searchParams: { shared?: string; error?: string }
}) {
  const session = await requireRole('participant')
  const { city, cities, contexts } = await getLabWorkspace(session)
  const prompt = await getVolunteerReflectionPrompt(params.claimId, session.sub)

  if (!prompt) {
    return <main className={styles.app}>
      <LabHeader activeSection="history" session={session} city={city} cities={cities} contexts={contexts} />
      <section className={styles.reflectionMissing}>
        <CheckCircle2 size={23} />
        <div><p className={styles.eyebrow}>Shift reflection</p><h1>This note is not available.</h1><p>Reflections are available privately after an organization verifies your completed participation.</p><Link href="/aesthetic-lab/history">View service history</Link></div>
      </section>
    </main>
  }

  const reflection = prompt.reflection
  const organizationName = prompt.organization.name
  const title = prompt.task.title

  return <main className={styles.app}>
    <LabHeader activeSection="history" session={session} city={city} cities={cities} contexts={contexts} />
    <section className={styles.reflectionPage}>
      <HistoryBackButton fallback="/aesthetic-lab/history" className={styles.reflectionBack} />

      {reflection ? <section className={styles.reflectionSharedCard}>
        <div className={styles.reflectionSharedMark}><CheckCircle2 size={28} /></div>
        <div><p className={styles.eyebrow}>Perspective shared</p><h1>Thank you for leaving a mark.</h1><p>Your note is now privately with {organizationName}. You helped make the next volunteer experience better for someone else.</p></div>
        <div className={styles.reflectionSharedDetails}>
          <p><Building2 size={15} /> {organizationName}</p>
          <p>{title} · {shiftDate(prompt.shift.startsAt)}</p>
        </div>
        <div className={styles.reflectionReadback}>
          {reflection.shiftNote ? <article><span><Heart size={16} /></span><div><p>Shift Notes</p><blockquote>{reflection.shiftNote}</blockquote></div></article> : null}
          {reflection.organizationIdea ? <article><span><Lightbulb size={16} /></span><div><p>Ideas for {organizationName}</p><blockquote>{reflection.organizationIdea}</blockquote></div></article> : null}
        </div>
        <Link className={styles.labLinkButton} href="/aesthetic-lab/history">Return to service history</Link>
      </section> : <section className={styles.reflectionCanvas}>
        <div className={styles.reflectionHeroArt} aria-hidden="true"><span /><span /><span /><Sparkles size={28} /></div>
        <div className={styles.reflectionIntro}>
          <p className={styles.eyebrow}>Your verified contribution</p>
          <h1>Your time shaped this shift.</h1>
          <p>You showed up for <b>{title}</b> with {organizationName}. The organization can see attendance, but only volunteers can describe what the day was really like.</p>
          <div><CheckCircle2 size={16} /><span>{shiftDate(prompt.shift.startsAt)} · Your service record is complete</span></div>
        </div>

        <LabNotice error={searchParams.error} />

        <form action={submitVolunteerReflectionAction} className={styles.reflectionForm}>
          <input type="hidden" name="claimId" value={prompt.claim.id} />
          <input type="hidden" name="redirectTo" value={`/aesthetic-lab/reflections/${prompt.claim.id}`} />
          <section className={styles.reflectionField}>
            <span><Heart size={18} /></span>
            <label htmlFor="shiftNote"><b>Shift Notes</b><small>What did the day feel like from where you were?</small></label>
            <textarea id="shiftNote" name="shiftNote" maxLength={1000} placeholder="Share anything you would like the organization to know about this shift…" />
          </section>
          <section className={styles.reflectionField}>
            <span><Lightbulb size={18} /></span>
            <label htmlFor="organizationIdea"><b>Ideas for {organizationName}</b><small>If you could improve one thing for the next team, what would it be?</small></label>
            <textarea id="organizationIdea" name="organizationIdea" maxLength={1000} placeholder="An idea, thought, or possibility for a future volunteer experience…" />
          </section>
          <p className={styles.reflectionPrivacy}>Every perspective helps an organization learn from the people who showed up. Your note is shared privately with {organizationName}; it is never public and does not affect your verified contribution.</p>
          <div className={styles.reflectionActions}><Link href="/aesthetic-lab/history">Not now</Link><button type="submit"><Sparkles size={16} /> Share your perspective</button></div>
        </form>
      </section>}
    </section>
  </main>
}
