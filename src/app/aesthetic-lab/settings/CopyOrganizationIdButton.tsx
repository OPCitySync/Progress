'use client'

import { useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import styles from '../prototype.module.css'

export function CopyOrganizationIdButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const resetTimer = useRef<ReturnType<typeof setTimeout>>()

  async function copy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    clearTimeout(resetTimer.current)
    resetTimer.current = setTimeout(() => setCopied(false), 1800)
  }

  return <button
    type="button"
    className={styles.settingsOrganizationIdCopy}
    aria-label={copied ? 'Organization ID copied' : 'Copy organization ID'}
    title={copied ? 'Organization ID copied' : 'Copy organization ID'}
    onClick={copy}
  >
    <small>Organization ID</small>
    <code>{value}</code>
    {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
  </button>
}
