'use client'

import { useState } from 'react'
import { Bookmark, Heart, Link2 } from 'lucide-react'
import styles from './prototype.module.css'

export function PostActions({ isOpportunity, postId }: { isOpportunity: boolean; postId: string }) {
  const [isSaved, setIsSaved] = useState(false)
  const [isLiked, setIsLiked] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  const copyLink = async () => {
    const link = `https://city-sync.org/feed/${postId}`
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      // The prototype still communicates the one permitted sharing action.
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
      <button type="button" className={isLiked ? styles.actionSelected : undefined} onClick={() => setIsLiked((liked) => !liked)}>
        <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} /> {isLiked ? 'Liked' : 'Like'}
      </button>
    </div>
  )
}
