export function fmtDate(ms: number | null | undefined): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function fmtDateTime(ms: number | null | undefined): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function shortHash(hash: string, chars = 10): string {
  if (hash.length <= chars * 2) return hash
  return `${hash.slice(0, chars)}…${hash.slice(-6)}`
}
