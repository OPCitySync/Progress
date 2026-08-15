'use client'

import { useState } from 'react'
import { Bookmark, Heart, Link2 } from 'lucide-react'
import { toggleHeartAction } from '@/app/actions'
import styles from './prototype.module.css'

export function PostActions({
  isOpportunity = false,
  postId,
  initialLiked = false,
  redirectTo = '/aesthetic-lab',
}: {
  isOpportunity?: boolean
  postId?: string
  initialLiked?: boolean
  redirectTo?: string
}) {
  const [isSaved, setIsSaved] = useState(false)
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
      <button type="button" className={isSaved ? styles.actionSelected : undefined} onClick={() => setIsSaved((saved) => !saved)}>
        <Bookmark size={18} fill={isSaved ? 'currentColor' : 'none'} /> {isSaved ? 'Saved' : saveLabel}
      </button>
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
