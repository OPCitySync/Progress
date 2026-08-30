import Link from 'next/link'
import { Building2, KeyRound, ShieldCheck, UserPlus } from 'lucide-react'
import { acceptOrganizationInviteAction } from '@/app/actions'
import { getSession } from '@/lib/auth/session'
import { validateActiveSession } from '@/lib/services/identity-access'
import { getOrganizationInvitePreview } from '@/lib/services/identity-access'
import styles from '../prototype.module.css'

export const dynamic = 'force-dynamic'

function invitePath(code: string) {
  return `/aesthetic-lab/invite?code=${encodeURIComponent(code)}`
}

export default async function AestheticOrganizationInvitePage({
  searchParams,
}: {
  searchParams: { code?: string; error?: string }
}) {
  const code = searchParams.code?.trim() ?? ''
  const preview = await getOrganizationInvitePreview(code)
  const rawSession = await getSession()
  const session = rawSession ? await validateActiveSession(rawSession) : null

  return (
    <main className={styles.app}>
      <div className={styles.organizationInviteShell}>
        <Link href="/aesthetic-lab" className={styles.organizationInviteBrand} aria-label="City/Sync home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/citysync-wordmark-dark.svg" alt="City/Sync" />
        </Link>
        <section className={styles.organizationInviteCard}>
          {!preview.ok ? (
            <>
              <span className={styles.organizationInviteIcon}><KeyRound size={25} /></span>
              <p className={styles.eyebrow}>Organization invitation</p>
              <h1>This invitation is unavailable.</h1>
              <p>The link may have expired, been revoked, or already been used. Ask the organization owner to send a new one.</p>
              <Link href="/aesthetic-lab" className={styles.organizationInviteSecondary}>Return to City/Sync</Link>
            </>
          ) : session ? (
            <>
              <span className={styles.organizationInviteIcon}><ShieldCheck size={25} /></span>
              <p className={styles.eyebrow}>Organization invitation</p>
              <h1>Join {preview.organizationName}</h1>
              <p>You will receive the <b>{preview.roleName}</b> role in this organization’s current City Network.</p>
              <div className={styles.organizationInviteFacts}>
                <span><Building2 size={14} /> {preview.organizationType === 'issuer' ? 'Volunteer organization' : 'Redeemer organization'}</span>
                <span><KeyRound size={14} /> One use · expires {new Date(preview.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
              {searchParams.error ? <p className={styles.organizationInviteError}>{searchParams.error}</p> : null}
              <form action={acceptOrganizationInviteAction} className={styles.organizationInviteActions}>
                <input type="hidden" name="code" value={code} />
                <button type="submit">Join as {preview.roleName}</button>
                <Link href="/aesthetic-lab" className={styles.organizationInviteSecondary}>Not now</Link>
              </form>
              <small>Your personal profile and Civic Participant identity remain separate from this organization role.</small>
            </>
          ) : (
            <>
              <span className={styles.organizationInviteIcon}><UserPlus size={25} /></span>
              <p className={styles.eyebrow}>Organization invitation</p>
              <h1>{preview.organizationName} invited you to join</h1>
              <p>Accept the <b>{preview.roleName}</b> role with your own City/Sync account. Your organization access will be separate from your personal Civic Participant account.</p>
              <div className={styles.organizationInviteFacts}>
                <span><ShieldCheck size={14} /> {preview.roleName}</span>
                <span><KeyRound size={14} /> One use · expires {new Date(preview.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
              {searchParams.error ? <p className={styles.organizationInviteError}>{searchParams.error}</p> : null}
              <div className={styles.organizationInviteActions}>
                <Link href={`/login?next=${encodeURIComponent(invitePath(code))}`} className={styles.organizationInvitePrimary}>Sign in and join</Link>
                <Link href={`/signup?type=participant&organizationInvite=${encodeURIComponent(code)}`} className={styles.organizationInviteSecondary}>Create an account and join</Link>
              </div>
              <small>Creating an account accepts this one-use invitation and opens the organization workspace with the role assigned by its owner.</small>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
