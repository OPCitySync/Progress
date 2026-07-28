'use client'

import { useEffect, useId, useState } from 'react'
import { X } from 'lucide-react'
import { closeTaskAction, reopenTaskAction } from '@/app/actions'
import { Button } from '@/components/ui'

type OpportunityStatus = 'open' | 'closed'

/** Confirms lifecycle changes before an issuer changes a visible opportunity. */
export function IssuerOpportunityStatusControl({
  taskId,
  taskTitle,
  status,
}: {
  taskId: string
  taskTitle: string
  status: OpportunityStatus
}) {
  const [confirming, setConfirming] = useState(false)
  const titleId = useId()
  const descriptionId = useId()
  const isOpen = status === 'open'

  useEffect(() => {
    if (!confirming) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setConfirming(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [confirming])

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={isOpen ? 'text-xs font-medium text-ink-400 hover:text-red-600' : 'text-xs font-medium text-ink-400 hover:text-brand-600'}
      >
        {isOpen ? 'Close' : 'Activate'}
      </button>

      {confirming ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink-900/55 px-4 py-6" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="skeuo-card w-full max-w-md rounded-2xl p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p id={titleId} className="font-display text-xl font-semibold text-ink-900">
                  {isOpen ? 'Close opportunity?' : 'Reactivate opportunity?'}
                </p>
                <p className="mt-1 text-sm font-medium text-ink-700">{taskTitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                aria-label="Cancel status change"
                className="rounded-lg p-1 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
              >
                <X size={18} />
              </button>
            </div>

            <p id={descriptionId} className="mt-4 text-sm leading-relaxed text-ink-600">
              {isOpen
                ? 'This stops new volunteer sign-ups and closes every currently open shift. You can reactivate the opportunity later.'
                : 'This reopens the opportunity and its eligible future or undated shifts so volunteers can sign up again.'}
            </p>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
              <form action={isOpen ? closeTaskAction : reopenTaskAction}>
                <input type="hidden" name="taskId" value={taskId} />
                <input type="hidden" name="redirectTo" value="/issuer" />
                <Button type="submit" variant={isOpen ? 'danger' : 'primary'}>
                  {isOpen ? 'Close opportunity' : 'Reactivate opportunity'}
                </Button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
