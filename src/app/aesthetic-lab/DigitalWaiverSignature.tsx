'use client'

import { Download, PenLine, ShieldCheck, X } from 'lucide-react'
import { useState } from 'react'
import { signWaiverAction } from '@/app/actions'
import { organizationFileDownloadUrl } from '@/lib/storage/organization-file-url'
import styles from './prototype.module.css'

type DigitalWaiverSignatureProps = {
  taskId: string
  waiver: {
    id: string
    title: string
    version: number
    body: string
    hasDocument: boolean
    documentName: string | null
  }
  redirectTo: string
  defaultSigningName: string
  organizationName: string
}

/**
 * A deliberately explicit signature interaction. It is separate from the
 * reservation form so participants review the version they are signing and
 * receive a durable receipt before a capacity-limited reservation is made.
 */
export function DigitalWaiverSignature({ taskId, waiver, redirectTo, defaultSigningName, organizationName }: DigitalWaiverSignatureProps) {
  const [open, setOpen] = useState(false)

  return <>
    <button type="button" className={styles.onboardingSignWaiverButton} onClick={() => setOpen(true)} aria-haspopup="dialog">
      <PenLine size={15} /> Review &amp; sign
    </button>
    {open ? <div className={styles.issuerCalendarModalBackdrop} role="presentation" onMouseDown={() => setOpen(false)}>
      <section className={`${styles.issuerCalendarModal} ${styles.waiverSignatureModal}`} role="dialog" aria-modal="true" aria-labelledby={`sign-waiver-${waiver.id}`} onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.issuerCalendarModalHeading}>
          <div>
            <p className={styles.eyebrow}>Electronic signature</p>
            <h2 id={`sign-waiver-${waiver.id}`}>Sign {waiver.title}</h2>
            <p>Review this waiver, then provide a typed signature to complete this requirement for the organization.</p>
          </div>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>

        <div className={styles.waiverSignatureDocument}>
          <div><ShieldCheck size={16} /><span>Waiver version {waiver.version}</span></div>
          {waiver.body ? <p>{waiver.body}</p> : <p>This waiver is provided as a source file. Download and review it before signing.</p>}
          {waiver.hasDocument ? <a href={organizationFileDownloadUrl('waiver', waiver.id, taskId)} target="_blank" rel="noreferrer"><Download size={14} /> Download {waiver.documentName || 'source file'}</a> : null}
        </div>

        <form action={signWaiverAction} className={`${styles.issuerCalendarForm} ${styles.waiverSignatureForm}`} onSubmit={() => setOpen(false)}>
          <input type="hidden" name="taskId" value={taskId} />
          <input type="hidden" name="waiverVersionId" value={waiver.id} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <label>
            Typed signature
            <input name="signerName" required minLength={2} maxLength={160} autoComplete="name" defaultValue={defaultSigningName} />
            <small>This private signing name is shared with {organizationName} only. Your public username is not used here.</small>
          </label>
          <label className={styles.waiverSignatureConsent}>
            <input type="checkbox" name="electronicConsent" value="yes" required />
            <span>I have reviewed this waiver and intend my typed name to serve as my electronic signature for this version.</span>
          </label>
          <div className={styles.issuerCalendarFormActions}>
            <button type="button" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit"><PenLine size={15} /> Sign waiver</button>
          </div>
        </form>
      </section>
    </div> : null}
  </>
}
