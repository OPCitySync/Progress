'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { ImagePlus, LoaderCircle, Send, X } from 'lucide-react'
import { createPostAction } from '@/app/actions'
import styles from '../prototype.module.css'

async function uploadPostImage(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch('/api/upload', { method: 'POST', body: formData })
  const payload = (await response.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!response.ok || !payload.url) throw new Error(payload.error || 'Image upload failed.')
  return payload.url
}

export function IssuerFeedComposer({ organizationName }: { organizationName: string }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [imageName, setImageName] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setUploadError('')
    setIsUploading(true)
    try {
      setImageUrl(await uploadPostImage(file))
      setImageName(file.name)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Image upload failed.')
    } finally {
      setIsUploading(false)
    }
  }

  return <form action={createPostAction} className={`${styles.composer} ${styles.issuerFeedComposer}`}>
    <input type="hidden" name="redirectTo" value="/aesthetic-lab/issuer/feed" />
    <input type="hidden" name="imageUrl" value={imageUrl} />
    <input ref={fileInput} className={styles.visuallyHidden} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleImageChange} />
    <span className={styles.orgAvatar}>{organizationName.slice(0, 2).toUpperCase() || 'CS'}</span>
    <label><textarea aria-label="Post an update to MyCity" name="body" required maxLength={1000} rows={3} placeholder="Share an update with your city — new opportunities, milestones, or a thank-you…" /></label>
    {imageUrl ? <div className={styles.issuerFeedImagePreview}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt={`Selected image: ${imageName || 'post attachment'}`} />
      <div><span>{imageName || 'Image attached'}</span><button className={styles.issuerFeedImageRemove} type="button" onClick={() => { setImageUrl(''); setImageName('') }}><X size={14} /> Remove</button></div>
    </div> : null}
    {uploadError ? <p className={styles.issuerFeedUploadError} role="alert">{uploadError}</p> : null}
    <div className={styles.issuerFeedComposerActions}>
      <div className={styles.issuerFeedComposerButtons}>
        <button className={styles.issuerFeedImageUpload} type="button" disabled={isUploading} onClick={() => fileInput.current?.click()}>
          {isUploading ? <LoaderCircle className={styles.composerSpinner} size={15} /> : <ImagePlus size={15} />}
          {isUploading ? 'Uploading…' : imageUrl ? 'Replace image' : 'Add image'}
        </button>
        <button type="submit" disabled={isUploading}><Send size={15} /> Post to MyCity</button>
      </div>
    </div>
  </form>
}
