'use client'

import { FileText, Search, ShieldCheck, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useId, useMemo, useState } from 'react'
import styles from '../prototype.module.css'

export type OnboardingDocumentOption = { id: string; title: string; categoryLabel: string }
export type OnboardingWaiverOption = { id: string; title: string }

type PackageSection = 'waivers' | 'documents'

export function OnboardingSessionPackageFields({
  documents,
  waivers,
  selectedDocumentIds,
  selectedWaiverIds,
  defaultSelectAllWaivers = true,
  pickerDescription = 'Select the waivers and materials participants should receive with this orientation.',
}: {
  documents: OnboardingDocumentOption[]
  waivers: OnboardingWaiverOption[]
  selectedDocumentIds?: string[]
  selectedWaiverIds?: string[]
  defaultSelectAllWaivers?: boolean
  pickerDescription?: string
}) {
  const headingId = useId()
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState<PackageSection>(waivers.length ? 'waivers' : 'documents')
  const [query, setQuery] = useState('')
  const [selectionSaved, setSelectionSaved] = useState(selectedDocumentIds !== undefined || selectedWaiverIds !== undefined)
  const [documentSelection, setDocumentSelection] = useState(() => (selectedDocumentIds ?? []).filter((id) => documents.some((document) => document.id === id)))
  const [waiverSelection, setWaiverSelection] = useState(() => (selectedWaiverIds ?? (defaultSelectAllWaivers ? waivers.map((waiver) => waiver.id) : [])).filter((id) => waivers.some((waiver) => waiver.id === id)))
  const [draftDocuments, setDraftDocuments] = useState(documentSelection)
  const [draftWaivers, setDraftWaivers] = useState(waiverSelection)

  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleWaivers = useMemo(
    () => waivers.filter((waiver) => !normalizedQuery || waiver.title.toLocaleLowerCase().includes(normalizedQuery)),
    [normalizedQuery, waivers],
  )
  const visibleDocuments = useMemo(
    () => documents.filter((document) => !normalizedQuery || `${document.title} ${document.categoryLabel}`.toLocaleLowerCase().includes(normalizedQuery)),
    [documents, normalizedQuery],
  )

  const showPicker = () => {
    setDraftDocuments(documentSelection)
    setDraftWaivers(waiverSelection)
    setQuery('')
    setSection(waivers.length ? 'waivers' : 'documents')
    setOpen(true)
  }
  const closePicker = () => setOpen(false)
  const saveSelection = () => {
    setDocumentSelection(draftDocuments)
    setWaiverSelection(draftWaivers)
    setSelectionSaved(true)
    setOpen(false)
  }
  const toggleDocument = (id: string) => setDraftDocuments((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])
  const toggleWaiver = (id: string) => setDraftWaivers((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])

  return <>
    <fieldset className={`${styles.documentAssignmentFieldset} ${styles.onboardingSessionPackage}`}>
      <legend>Session Package</legend>
      <input type="hidden" name="resourcePackage" value="true" />
      {waiverSelection.map((id) => <input key={`waiver-${id}`} type="hidden" name="waiverVersionIds" value={id} />)}
      {documentSelection.map((id) => <input key={`document-${id}`} type="hidden" name="documentIds" value={id} />)}
      <div className={styles.sessionPackageSummary}>
        <div data-selected={selectionSaved || undefined}><ShieldCheck size={17} aria-hidden="true"/><span><b>{selectionSaved ? waiverSelection.length : waivers.length}</b><small>{selectionSaved ? `${waiverSelection.length === 1 ? 'Waiver' : 'Waivers'} selected` : `${waivers.length === 1 ? 'Waiver' : 'Waivers'} available`}</small></span></div>
        <div data-selected={selectionSaved || undefined}><FileText size={17} aria-hidden="true"/><span><b>{selectionSaved ? documentSelection.length : documents.length}</b><small>{selectionSaved ? `${documentSelection.length === 1 ? 'Document' : 'Documents'} selected` : `${documents.length === 1 ? 'Document' : 'Documents'} available`}</small></span></div>
        <button type="button" className={styles.sessionPackageChooseButton} onClick={showPicker}>Choose Documents</button>
      </div>
    </fieldset>

    {open ? createPortal(<div className={`${styles.issuerCalendarModalBackdrop} ${styles.sessionPackagePickerBackdrop}`} role="presentation" onMouseDown={closePicker}>
      <section className={`${styles.issuerCalendarModal} ${styles.sessionPackagePickerModal}`} role="dialog" aria-modal="true" aria-labelledby={headingId} onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.issuerCalendarModalHeading}>
          <div><p className={styles.eyebrow}>Session Package</p><h2 id={headingId}>Choose Documents</h2><p>{pickerDescription}</p></div>
          <button type="button" aria-label="Close document selector" onClick={closePicker}><X size={18}/></button>
        </div>
        <div className={styles.sessionPackagePickerToolbar}>
          <label><Search size={15} aria-hidden="true"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the Document Library" aria-label="Search waivers and documents"/></label>
          <div role="tablist" aria-label="Document types">
            <button type="button" role="tab" aria-selected={section === 'waivers'} onClick={() => setSection('waivers')}>Waivers <span>{waivers.length}</span></button>
            <button type="button" role="tab" aria-selected={section === 'documents'} onClick={() => setSection('documents')}>Documents <span>{documents.length}</span></button>
          </div>
        </div>
        <div className={styles.sessionPackagePickerList} role="tabpanel" aria-label={section === 'waivers' ? 'Available waivers' : 'Available documents'}>
          {section === 'waivers' ? visibleWaivers.map((waiver) => <label key={waiver.id}>
            <input type="checkbox" checked={draftWaivers.includes(waiver.id)} onChange={() => toggleWaiver(waiver.id)}/>
            <span><ShieldCheck size={16} aria-hidden="true"/></span>
            <div><b>{waiver.title}</b><small>Waiver</small></div>
          </label>) : visibleDocuments.map((document) => <label key={document.id}>
            <input type="checkbox" checked={draftDocuments.includes(document.id)} onChange={() => toggleDocument(document.id)}/>
            <span><FileText size={16} aria-hidden="true"/></span>
            <div><b>{document.title}</b><small>{document.categoryLabel}</small></div>
          </label>)}
          {section === 'waivers' && !visibleWaivers.length ? <p>No waivers match your search.</p> : null}
          {section === 'documents' && !visibleDocuments.length ? <p>No documents match your search.</p> : null}
        </div>
        <div className={styles.sessionPackagePickerFooter}>
          <div className={styles.issuerCalendarFormActions}><button type="button" onClick={closePicker}>Cancel</button><button type="button" className={styles.sessionPackageSaveButton} onClick={saveSelection}>Save</button></div>
        </div>
      </section>
    </div>, document.body) : null}
  </>
}
