import { Input, Label } from '@/components/ui'
import type { OrganizationLocation } from '@/lib/services/organization-locations'

export function IssuerLocationField({
  id,
  locations,
  defaultValue,
  label = 'Default location',
  placeholder = 'e.g. Community Room, 123 Main St.',
  maxLength = 240,
}: {
  id: string
  locations: OrganizationLocation[]
  defaultValue?: string
  label?: string
  placeholder?: string
  maxLength?: number
}) {
  const listId = `${id}-saved-locations`
  const organizationDefault = locations.find((location) => location.isDefault)?.address ?? ''

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name="location"
        list={listId}
        defaultValue={defaultValue ?? organizationDefault}
        maxLength={maxLength}
        placeholder={placeholder}
      />
      <datalist id={listId}>
        {locations.map((location) => (
          <option key={location.id} value={location.address}>
            {location.isDefault ? 'Primary organization address' : 'Saved location'}
          </option>
        ))}
      </datalist>
      <p className="mt-1 text-xs text-ink-400">
        {locations.length > 0
          ? 'Choose a saved location or enter another one. New locations are saved for future opportunities.'
          : 'Enter an address or location. It will be saved for future opportunities.'}
      </p>
    </div>
  )
}
