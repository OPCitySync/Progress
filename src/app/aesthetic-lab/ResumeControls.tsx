'use client'

import { useState } from 'react'
import { Copy, Download, Eye, EyeOff } from 'lucide-react'
import { setResumePublicAction } from '@/app/actions'
import styles from './prototype.module.css'

export function ResumeControls({
  token,
  isPublic,
  redirectTo = '/aesthetic-lab/history',
}: {
  token: string | null
  isPublic: boolean
  redirectTo?: string
}) {
  const [copied, setCopied] = useState(false)
  const publicUrl = token && typeof window !== 'undefined' ? `${window.location.origin}/aesthetic-lab/resume/${token}` : ''
  const copy = async () => {
    if (!publicUrl) return
    await navigator.clipboard.writeText(publicUrl).catch(() => undefined)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }
  return <div className={styles.resumeActions}>
    <form action={setResumePublicAction}><input type="hidden" name="public" value={isPublic ? 'false' : 'true'} /><input type="hidden" name="redirectTo" value={redirectTo} /><button type="submit">{isPublic ? <EyeOff size={16} /> : <Eye size={16} />}{isPublic ? 'Make private' : 'Make shareable'}</button></form>
    {isPublic && token ? <button type="button" onClick={copy}><Copy size={16} /> {copied ? 'Link copied' : 'Copy link'}</button> : null}
    <button type="button" onClick={() => window.print()}><Download size={16} /> Print / export</button>
  </div>
}
