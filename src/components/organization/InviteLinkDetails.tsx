'use client'

import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'

export function InviteLinkDetails({ code, claimPath }: { code: string; claimPath?: string }) {
  const path = `${claimPath ?? '/invite'}?code=${encodeURIComponent(code)}`
  const [link, setLink] = useState(path)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setLink(`${window.location.origin}${path}`)
  }, [path])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="mt-3 flex items-center gap-2 rounded-xl border border-gold-300 bg-gold-50 px-3 py-2">
      <a href={path} className="min-w-0 flex-1 break-all font-mono text-xs font-semibold text-brand-700 hover:text-brand-600">{link}</a>
      <button type="button" aria-label="Copy invite link" onClick={copyLink} className="shrink-0 rounded-lg p-2 text-brand-700 transition-colors hover:bg-gold-100">
        {copied ? <Check size={17} /> : <Copy size={17} />}
      </button>
    </div>
  )
}
