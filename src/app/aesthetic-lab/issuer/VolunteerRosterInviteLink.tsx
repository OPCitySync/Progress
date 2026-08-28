'use client'

import { Check, Copy, Link2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import styles from '../../prototype.module.css'

export function VolunteerRosterInviteLink({ code }: { code: string }) {
  const path = `/volunteer-invite?code=${encodeURIComponent(code)}`
  const [link, setLink] = useState(path)
  const [copied, setCopied] = useState(false)

  useEffect(() => setLink(`${window.location.origin}${path}`), [path])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className={styles.rosterInviteLink}>
      <span><Link2 size={15} /></span>
      <div><b>Volunteer invite link</b><small>One use · expires in 30 days</small><a href={path}>{link}</a></div>
      <button type="button" onClick={copyLink} aria-label="Copy volunteer invite link">{copied ? <Check size={15} /> : <Copy size={15} />}</button>
    </div>
  )
}
