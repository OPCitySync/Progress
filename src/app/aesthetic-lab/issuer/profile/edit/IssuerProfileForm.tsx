'use client'

import Link from 'next/link'
import { useRef } from 'react'
import { saveProfileAction } from '@/app/actions'
import type { OrgProfile } from '@/lib/services/profile'
import styles from '../../../prototype.module.css'

export function IssuerProfileForm({ profile, tasks }: { profile: OrgProfile; tasks: { id: string; title: string }[] }) {
  const payload = useRef<HTMLInputElement>(null)
  return <form action={saveProfileAction} className={styles.labForm} onSubmit={(event) => {
    const data = new FormData(event.currentTarget)
    if (payload.current) payload.current.value = JSON.stringify({
      tagline: data.get('tagline') ?? '', mission: data.get('mission') ?? '', logoUrl: data.get('logoUrl') ?? '', coverUrl: data.get('coverUrl') ?? '', website: data.get('website') ?? '', contactEmail: data.get('contactEmail') ?? '', phone: data.get('phone') ?? '', location: data.get('location') ?? '', onboardingTaskId: data.get('onboardingTaskId') ?? '', causes: String(data.get('causes') ?? '').split(',').map((cause) => cause.trim()).filter(Boolean), socials: {},
    })
  }}>
    <input type="hidden" name="payload" ref={payload} />
    <input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer/profile" />
    <label>Tagline<input name="tagline" defaultValue={profile.tagline} placeholder="A short description of your work" /></label>
    <label>Mission<textarea name="mission" defaultValue={profile.mission} placeholder="Tell prospective volunteers why this work matters." /></label>
    <div className={styles.labFormGrid}><label>Location<input name="location" defaultValue={profile.location} placeholder="Primary location" /></label><label>Causes<input name="causes" defaultValue={profile.causes.join(', ')} placeholder="Food security, environment, …" /></label></div>
    <div className={styles.labFormGrid}><label>Contact email<input type="email" name="contactEmail" defaultValue={profile.contactEmail} /></label><label>Phone<input name="phone" defaultValue={profile.phone} /></label></div>
    <div className={styles.labFormGrid}><label>Website<input type="url" name="website" defaultValue={profile.website} placeholder="https://…" /></label><label>Logo URL<input name="logoUrl" defaultValue={profile.logoUrl} placeholder="https://…" /></label></div>
    <label>Featured onboarding task<select name="onboardingTaskId" defaultValue={profile.onboardingTaskId ?? ''}><option value="">No featured onboarding task</option>{tasks.map((task) => <option value={task.id} key={task.id}>{task.title}</option>)}</select></label>
    <label><span><input type="checkbox" name="published" value="true" defaultChecked={profile.published} /> Publish this profile for the community</span></label>
    <div className={styles.labFormActions}><Link className={`${styles.labLinkButton} ${styles.labLinkButtonSecondary}`} href="/aesthetic-lab/issuer/profile">Cancel</Link><button className={styles.labButton} type="submit">Save public profile</button></div>
  </form>
}
