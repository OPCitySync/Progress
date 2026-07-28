import { switchIdentityAction } from '@/app/actions'
import { homeFor, type Session } from '@/lib/auth/session'
import type { ActorContext } from '@/lib/services/identity-access'

/** One compact, reversible switch between a person's two active contexts. */
export function IdentitySwitcher({ session, contexts }: { session: Session; contexts: ActorContext[] }) {
  const current = contexts.find((context) => context.identityId === session.activeIdentityId)
  const participant = contexts.find((context) => context.kind === 'participant')
  const organization = contexts.find((context) => context.kind === 'authority')
  const target = current?.kind === 'participant' ? organization : participant
  if (!target) return null
  const targetName = target.kind === 'participant' ? session.name : target.label

  return (
    <form action={switchIdentityAction} className="mt-4 px-2">
      <input type="hidden" name="identityId" value={target.identityId} />
      <input type="hidden" name="redirectTo" value={homeFor(target.role)} />
      <button
        type="submit"
        className="flex w-full items-center gap-2 rounded-xl border border-white/12 bg-white/8 px-3 py-2.5 text-left transition-colors hover:bg-white/14"
      >
        <span className="shrink-0 text-xs font-semibold text-white/50">Switch to →</span>
        <span className="min-w-0 truncate text-sm font-semibold text-white/90">{targetName}</span>
      </button>
    </form>
  )
}
