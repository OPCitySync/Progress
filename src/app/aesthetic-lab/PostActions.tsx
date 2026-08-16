'use client'

import { useState } from 'react'
import { Bookmark, Heart, Link2 } from 'lucide-react'
import { toggleHeartAction, toggleSavedItemAction } from '@/app/actions'
import styles from './prototype.module.css'

export function PostActions({
  isOpportunity = false,
  postId,
  initialLiked = false,
  initialSaved = false,
  redirectTo = '/aesthetic-lab',
}: {
  isOpportunity?: boolean
  postId?: string
  initialLiked?: boolean
  initialSaved?: boolean
  redirectTo?: string
}) {
  const [isCopied, setIsCopied] = useState(false)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
    } catch {
      // Copying is a convenience action only; the feed remains usable if it is blocked.
    }
    setIsCopied(true)
    window.setTimeout(() => setIsCopied(false), 1800)
  }

  const saveLabel = isOpportunity ? 'Save' : 'Bookmark'

  return (
    <div className={styles.storyActions}>
      {postId ? <form action={toggleSavedItemAction}><input type="hidden" name="kind" value="post" /><input type="hidden" name="itemId" value={postId} /><input type="hidden" name="redirectTo" value={redirectTo} /><button type="submit" className={initialSaved ? styles.actionSelected : undefined}><Bookmark size={18} fill={initialSaved ? 'currentColor' : 'none'} /> {initialSaved ? 'Saved' : saveLabel}</button></form> : null}
      <button type="button" onClick={copyLink}>
        <Link2 size={18} /> {isCopied ? 'Link copied' : 'Share'}
      </button>
      {postId ? (
        <form action={toggleHeartAction}>
          <input type="hidden" name="postId" value={postId} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <button type="submit" className={initialLiked ? styles.actionSelected : undefined}>
            <Heart size={18} fill={initialLiked ? 'currentColor' : 'none'} /> {initialLiked ? 'Liked' : 'Like'}
          </button>
        </form>
      ) : (
        <button type="button"><Heart size={18} /> Like</button>
      )}
    </div>
  )
}
