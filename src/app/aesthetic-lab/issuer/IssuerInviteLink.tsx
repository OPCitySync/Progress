'use client'

import { Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'
import styles from '../prototype.module.css'

export function IssuerInviteLink({ code }: { code: string }) {
  const path = `/invite?code=${encodeURIComponent(code)}`
  const [link, setLink] = useState(path)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setLink(`${window.location.origin}${path}`)
  }, [path])

  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className={styles.manageInviteLink}>
      <a href={path}>{link}</a>
      <button type="button" aria-label="Copy invite link" onClick={copyInviteLink}>
        {copied ? <Check size={15} /> : <Copy size={15} />}
      </button>
    </div>
  )
}
