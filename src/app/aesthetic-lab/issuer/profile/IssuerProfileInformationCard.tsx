'use client'

import { useState } from 'react'
import { Check, Edit3, X } from 'lucide-react'
import { saveProfileAction } from '@/app/actions'
import type { OrgProfile } from '@/lib/services/profile'
import styles from '../../prototype.module.css'

type EditableField = 'mission' | 'causes' | 'location' | 'contactEmail' | 'phone' | 'website'

type EditableValues = {
  mission: string
  causes: string
  location: string
  contactEmail: string
  phone: string
  website: string
}

const FIELD_ROWS: Array<{
  key: EditableField
  label: string
  empty: string
  type?: 'email' | 'tel' | 'url'
  multiline?: boolean
}> = [
  { key: 'mission', label: 'Mission', empty: 'Add a mission statement.', multiline: true },
  { key: 'causes', label: 'Cause Areas', empty: 'Add cause areas.' },
  { key: 'location', label: 'Location', empty: 'Add a primary location.' },
  { key: 'contactEmail', label: 'Email', empty: 'Add a public email address.', type: 'email' },
  { key: 'phone', label: 'Phone', empty: 'Add a public phone number.', type: 'tel' },
  { key: 'website', label: 'Website', empty: 'Add your organization website.', type: 'url' },
]

export function IssuerProfileInformationCard({ profile }: { profile: OrgProfile }) {
  const initialValues: EditableValues = {
    mission: profile.mission,
    causes: profile.causes.join(', '),
    location: profile.location,
    contactEmail: profile.contactEmail,
    phone: profile.phone,
    website: profile.website,
  }
  const [values, setValues] = useState<EditableValues>(initialValues)
  const [editing, setEditing] = useState<EditableField | null>(null)

  const payload = JSON.stringify({
    tagline: profile.tagline,
    mission: values.mission,
    logoUrl: profile.logoUrl,
    coverUrl: profile.coverUrl,
    website: values.website,
    contactEmail: values.contactEmail,
    phone: values.phone,
    location: values.location,
    bannerStyle: profile.bannerStyle,
    bannerPalette: profile.bannerPalette,
    onboardingTaskId: profile.onboardingTaskId ?? '',
    causes: values.causes.split(',').map((cause) => cause.trim()).filter(Boolean),
    socials: profile.socials,
  })

  const cancelEdit = (field: EditableField) => {
    setValues((current) => ({ ...current, [field]: initialValues[field] }))
    setEditing(null)
  }

  return (
    <section className={styles.profileEditCard}>
      <div className={styles.issuerPanelHeading}>
        <div><p className={styles.eyebrow}>Organization Information</p><h2>Information your team maintains</h2></div>
      </div>
      <form
        action={saveProfileAction}
        className={styles.profileFieldList}
        onSubmit={() => setEditing(null)}
      >
        <input type="hidden" name="payload" value={payload} />
        <input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer/profile" />
        {FIELD_ROWS.map((field) => {
          const isEditing = editing === field.key
          return (
            <article key={field.key}>
              <span>{field.label}</span>
              {isEditing ? (
                field.multiline ? (
                  <textarea
                    aria-label={field.label}
                    className={styles.profileInlineField}
                    rows={3}
                    value={values[field.key]}
                    onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                    autoFocus
                  />
                ) : (
                  <input
                    aria-label={field.label}
                    className={styles.profileInlineField}
                    type={field.type ?? 'text'}
                    value={values[field.key]}
                    onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                    autoFocus
                  />
                )
              ) : <p>{values[field.key] || field.empty}</p>}
              <div className={styles.profileInlineActions}>
                {isEditing ? (
                  <>
                    <button type="button" onClick={() => cancelEdit(field.key)} aria-label={`Cancel editing ${field.label}`} title="Cancel"><X size={14} /></button>
                    <button type="submit" aria-label={`Save ${field.label}`} title="Save"><Check size={14} /></button>
                  </>
                ) : (
                  <button type="button" onClick={() => setEditing(field.key)} aria-label={`Edit ${field.label}`} title={`Edit ${field.label}`}><Edit3 size={15} /></button>
                )}
              </div>
            </article>
          )
        })}
      </form>
    </section>
  )
}
