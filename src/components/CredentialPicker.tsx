import { CREDENTIALS } from '@/lib/credentials'

/** Checkbox group of the credential catalog; submits as repeated `cred` fields. */
export function CredentialPicker({ selected = [] }: { selected?: string[] }) {
  return (
    <div className="space-y-2">
      {CREDENTIALS.map((c) => (
        <label key={c.key} className="flex items-start gap-2.5 text-sm text-ink-700">
          <input type="checkbox" name="cred" value={c.key} defaultChecked={selected.includes(c.key)} className="mt-0.5" />
          <span>
            <span className="font-medium">{c.label}</span>{' '}
            <span className="text-ink-400">— {c.description}</span>
          </span>
        </label>
      ))}
    </div>
  )
}
