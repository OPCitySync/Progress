'use client'

import { Send } from 'lucide-react'
import { createPostAction } from '@/app/actions'
import styles from '../prototype.module.css'

export function IssuerFeedComposer({ organizationName }: { organizationName: string }) {
  return <form action={createPostAction} className={`${styles.composer} ${styles.issuerFeedComposer}`}>
    <input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer/feed" />
    <span className={styles.orgAvatar}>{organizationName.slice(0, 2).toUpperCase() || 'CS'}</span>
    <label><textarea aria-label="Post an update to MyCity" name="body" required maxLength={1000} rows={3} placeholder="Share an update with your city — new opportunities, milestones, or a thank-you…" /></label>
    <div><small>Visible to everyone in this City Network.</small><button type="submit"><Send size={15} /> Post to MyCity</button></div>
  </form>
}
