/**
 * Email port. Same ports-and-adapters shape as lib/protocol/anchor.ts and
 * lib/storage/storage.ts: swap the adapter via env, nothing else changes.
 *
 *   REMINDER_EMAIL_MODE=stub    -> log only (dev default; no email leaves the box)
 *   REMINDER_EMAIL_MODE=resend  -> send via Resend (needs RESEND_API_KEY, REMINDER_FROM)
 */
export interface EmailMessage {
  to: string
  subject: string
  text: string
}

export interface EmailAdapter {
  backend: string
  send(msg: EmailMessage): Promise<void>
}

class StubEmailAdapter implements EmailAdapter {
  backend = 'stub'
  async send(msg: EmailMessage) {
    console.log(`[email:stub] → ${msg.to} | ${msg.subject}`)
  }
}

class ResendEmailAdapter implements EmailAdapter {
  backend = 'resend'
  async send(msg: EmailMessage) {
    const key = process.env.RESEND_API_KEY
    if (!key) throw new Error('RESEND_API_KEY is not set.')
    const from = process.env.REMINDER_FROM ?? 'City/Sync <noreply@city-sync.org>'
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: msg.to, subject: msg.subject, text: msg.text }),
    })
    if (!res.ok) {
      throw new Error(`Resend error ${res.status}: ${await res.text()}`)
    }
  }
}

export function getEmailAdapter(): EmailAdapter {
  return process.env.REMINDER_EMAIL_MODE === 'resend' ? new ResendEmailAdapter() : new StubEmailAdapter()
}
