'use client'

import { Check, Clipboard, Code2, ExternalLink, Link2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import styles from '../../prototype.module.css'

type CopyTarget = 'link' | 'button' | 'embed'

function escapeAttribute(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function WebsiteSharingCard({ slug, organizationName }: { slug: string; organizationName: string }) {
  const [origin, setOrigin] = useState('')
  const [copied, setCopied] = useState<CopyTarget | null>(null)

  useEffect(() => setOrigin(window.location.origin), [])

  const snippets = useMemo(() => {
    const profileUrl = `${origin}/orgs/${slug}`
    const embedUrl = `${origin}/embed/organizations/${slug}`
    return {
      link: profileUrl,
      button: `<a href="${profileUrl}" target="_blank" rel="noopener noreferrer">Volunteer with us</a>`,
      embed: `<iframe src="${embedUrl}" title="Volunteer with ${escapeAttribute(organizationName)}" style="width:100%;min-height:900px;border:0;border-radius:16px" loading="lazy"></iframe>`,
    }
  }, [origin, organizationName, slug])

  async function copy(target: CopyTarget) {
    if (!origin) return
    await navigator.clipboard.writeText(snippets[target])
    setCopied(target)
    window.setTimeout(() => setCopied((current) => current === target ? null : current), 1800)
  }

  const copyButton = (target: CopyTarget, label: string) => (
    <button type="button" onClick={() => void copy(target)} disabled={!origin}>
      {copied === target ? <Check size={14} /> : <Clipboard size={14} />}
      {copied === target ? 'Copied' : label}
    </button>
  )

  return (
    <section className={styles.profileSharingCard}>
      <div className={styles.profileSharingHeading}>
        <div><p className={styles.eyebrow}>Website &amp; Sharing</p><h2>Use your profile wherever people find you.</h2></div>
        <a href={`/orgs/${slug}`} target="_blank" rel="noopener noreferrer">View Live Page <ExternalLink size={14} /></a>
      </div>
      <div className={styles.profileSharingOptions}>
        <article>
          <span><Link2 size={17} /></span>
          <div><b>Public Profile Link</b><p>Share the permanent City/Sync page in email, social posts, or your website navigation.</p></div>
          {copyButton('link', 'Copy Link')}
        </article>
        <article>
          <span><ExternalLink size={17} /></span>
          <div><b>Volunteer Button</b><p>Add a simple “Volunteer with us” link to your existing website.</p></div>
          {copyButton('button', 'Copy Button Code')}
        </article>
        <article>
          <span><Code2 size={17} /></span>
          <div><b>Full Profile Embed</b><p>Place the live profile on your website. Applications and opportunities update automatically.</p></div>
          {copyButton('embed', 'Copy Embed Code')}
        </article>
      </div>
    </section>
  )
}
