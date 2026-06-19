import { Badge } from '@/components/ui'

const MAP: Record<string, { tone: 'gray' | 'gold' | 'green' | 'blue' | 'red'; label: string }> = {
  draft: { tone: 'gray', label: 'Draft' },
  submitted: { tone: 'gold', label: 'In review' },
  approved: { tone: 'green', label: 'Approved' },
  needs_changes: { tone: 'blue', label: 'Needs changes' },
  rejected: { tone: 'red', label: 'Rejected' },
}

export function CatalogStatusBadge({ status }: { status: string }) {
  const m = MAP[status] ?? { tone: 'gray' as const, label: status }
  return <Badge tone={m.tone}>{m.label}</Badge>
}
