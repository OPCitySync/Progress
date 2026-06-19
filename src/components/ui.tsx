import { clsx } from 'clsx'
import type { ReactNode } from 'react'

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('rounded-2xl border border-ink-200 bg-white p-6 shadow-card', className)}>
      {children}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-ink-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-ink-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-400">{hint}</p> : null}
    </Card>
  )
}

const badgeTones: Record<string, string> = {
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  gold: 'bg-gold-50 text-gold-700 border-gold-200',
  blue: 'bg-brand-50 text-brand-700 border-brand-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  gray: 'bg-ink-100 text-ink-600 border-ink-200',
}

export function Badge({ tone = 'gray', children }: { tone?: keyof typeof badgeTones; children: ReactNode }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        badgeTones[tone],
      )}
    >
      {children}
    </span>
  )
}

export function statusBadge(status: string) {
  const tone =
    status === 'verified' || status === 'approved' || status === 'finalized' || status === 'open'
      ? 'green'
      : status === 'submitted' || status === 'pending'
        ? 'gold'
        : status === 'claimed'
          ? 'blue'
          : status === 'rejected' || status === 'suspended' || status === 'cancelled'
            ? 'red'
            : 'gray'
  return <Badge tone={tone as 'green'}>{status}</Badge>
}

export function Button({
  children,
  variant = 'primary',
  className,
  ...props
}: {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  className?: string
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50',
        variant === 'primary' && 'bg-brand-700 text-white hover:bg-brand-600',
        variant === 'secondary' && 'border border-ink-300 bg-white text-ink-700 hover:bg-ink-50',
        variant === 'danger' && 'border border-red-200 bg-white text-red-600 hover:bg-red-50',
        variant === 'ghost' && 'text-ink-500 hover:text-ink-800',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        'w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200',
        props.className,
      )}
    />
  )
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={clsx(
        'w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200',
        props.className,
      )}
    />
  )
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink-700">
      {children}
    </label>
  )
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-300 bg-ink-50 px-6 py-10 text-center">
      <p className="text-sm font-semibold text-ink-600">{title}</p>
      {body ? <p className="mt-1 text-sm text-ink-400">{body}</p> : null}
    </div>
  )
}

export function Flash({ searchParams }: { searchParams?: { error?: string; ok?: string } }) {
  if (!searchParams) return null
  if (searchParams.error) {
    return (
      <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {searchParams.error}
      </div>
    )
  }
  if (searchParams.ok) {
    return (
      <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        {searchParams.ok}
      </div>
    )
  }
  return null
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <code className={clsx('break-all font-mono text-xs text-ink-500', className)}>{children}</code>
}
