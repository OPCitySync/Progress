'use client'

import Link from 'next/link'
import { FilePlus2, FileText } from 'lucide-react'
import { useState } from 'react'
import styles from '../prototype.module.css'

type DocumentOption = {
  id: string
  title: string
  categoryLabel: string
  attached: boolean
}

export function OnboardingDocumentPicker({
  documents,
  createDocumentHref,
}: {
  documents: DocumentOption[]
  createDocumentHref: string
}) {
  const [isOpen, setIsOpen] = useState(false)

  return <div className={styles.onboardingDocumentPicker}>
    <Link href={createDocumentHref} className={styles.catalogWorkspaceAction} onClick={(event) => { event.preventDefault(); setIsOpen((open) => !open) }} aria-expanded={isOpen}>
      <FilePlus2 size={15} /> Add form or document
    </Link>
    {isOpen ? <div className={styles.onboardingDocumentPickerPopover}>
      <Link href={createDocumentHref}><FilePlus2 size={14} /> Create a new form or document</Link>
      <p>Include a document from your library</p>
      {documents.length ? <div>{documents.map((document) => document.attached
        ? <span key={document.id}><FileText size={14} /><span>{document.title}</span><small>Included</small></span>
        : <button type="submit" form={`onboarding-document-attach-${document.id}`} key={document.id}><FileText size={14} /><span>{document.title}</span><small>{document.categoryLabel}</small></button>)}</div> : <small className={styles.onboardingDocumentPickerEmpty}>No saved documents yet. Create one to include it here.</small>}
    </div> : null}
  </div>
}
