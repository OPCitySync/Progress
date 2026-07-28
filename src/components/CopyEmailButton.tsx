'use client'

import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

/** Compact copy control that does not trigger the surrounding volunteer accordion. */
export function CopyEmailButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false)

  async function copyEmail(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()

    try {
      await navigator.clipboard.writeText(email)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={copyEmail}
      title={copied ? 'Email copied' : 'Copy email'}
      aria-label={copied ? `Copied ${email}` : `Copy ${email}`}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-ink-200 text-ink-500 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-200"
    >
      {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
    </button>
  )
}
