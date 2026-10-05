import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { CheckCircle2, FileText } from 'lucide-react'
import { organizationBannerPalette, type OrganizationBannerPalette } from '@/lib/profile/organization-appearance'
import { DocumentCreateButton } from './DocumentCreateButton'
import styles from '../prototype.module.css'

type DocumentUploadCardProps = {
  waiverCount: number
  documentCount: number
  tasks: Array<{ id: string; title: string }>
  programs: Array<{ id: string; name: string }>
  redirectTo?: string
  attached?: boolean
  bannerPalette?: OrganizationBannerPalette | string
  headerAction?: ReactNode
}

type ResourcePaletteVariables = CSSProperties & {
  '--resource-palette-deep': string
  '--resource-palette-mid': string
  '--resource-palette-accent': string
  '--resource-palette-accent-deep': string
}

export function DocumentUploadCard({
  waiverCount,
  documentCount,
  tasks,
  programs,
  redirectTo = '/aesthetic-lab/issuer/documents',
  attached = false,
  bannerPalette = 'citysync',
  headerAction,
}: DocumentUploadCardProps) {
  const palette = organizationBannerPalette(bannerPalette)
  const paletteVariables: ResourcePaletteVariables = {
    '--resource-palette-deep': palette.colors[0],
    '--resource-palette-mid': palette.colors[1],
    '--resource-palette-accent': palette.colors[2],
    '--resource-palette-accent-deep': palette.colors[3],
  }
  const resources = <div className={styles.workspaceSetupSteps}>
      <article className={waiverCount ? styles.workspaceSetupStepComplete : undefined}>
        <span>{waiverCount ? <CheckCircle2 size={18} /> : <FileText size={18} />}</span>
        <div>
          <p>Waivers</p>
          <h3>{waiverCount ? `${waiverCount} active waiver${waiverCount === 1 ? '' : 's'}` : 'Add a waiver'}</h3>
          <small>Keep liability acknowledgements separate from the rest of your organization documents.</small>
        </div>
        <Link className={styles.catalogWorkspaceAction} href="/aesthetic-lab/issuer/waiver">Add Waivers</Link>
      </article>
      <article>
        <span><FileText size={18} /></span>
        <div>
          <p>Additional Documents</p>
          <h3>{documentCount ? `${documentCount} document${documentCount === 1 ? '' : 's'} saved` : 'Add a document'}</h3>
          <small>Upload guides, safety information, checklists, and other reusable materials.</small>
        </div>
        <DocumentCreateButton tasks={tasks} programs={programs} redirectTo={redirectTo} />
      </article>
    </div>

  return <section aria-label="Organizational Resources" className={`${styles.workspaceSetupCard} ${styles.uploadDocumentsCard} ${attached ? `${styles.workspaceAttachedUploadDocuments} ${styles.paletteTreatmentCard}` : styles.organizationResourcesCard}`} style={attached ? undefined : paletteVariables}>
    {attached
      ? <div className={`${styles.workspaceSetupHeading} ${styles.paletteTreatmentHeader}`}><div><p className={styles.eyebrow}>Upload Documents</p></div></div>
      : <div className={styles.organizationResourcesHeading}><p className={styles.eyebrow}>Organizational Resources</p>{headerAction}</div>}
    {attached ? <div className={styles.paletteTreatmentBody}>{resources}</div> : <div className={styles.organizationResourcesBody}>{resources}</div>}
  </section>
}
