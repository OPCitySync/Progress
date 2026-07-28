import Link from 'next/link'

export type OrganizationSettingsTab = 'profile' | 'permissions' | 'activity' | 'locations'

const tabs: { key: OrganizationSettingsTab; label: string }[] = [
  { key: 'profile', label: 'Profile' },
  { key: 'permissions', label: 'Permissions' },
  { key: 'activity', label: 'Activity' },
  { key: 'locations', label: 'Locations' },
]

/** Settings uses the same fixed, header-level tab treatment as the organization overview. */
export function OrganizationSettingsTabs({ activeTab }: { activeTab: OrganizationSettingsTab }) {
  return (
    <div className="border-t border-ink-100">
      <nav aria-label="Organization settings" className="flex flex-nowrap gap-1 overflow-x-auto px-5 md:px-8">
        {tabs.map((tab) => {
          const active = tab.key === activeTab
          return (
            <Link
              key={tab.key}
              href={tab.key === 'profile' ? '/settings' : `/settings?tab=${tab.key}`}
              className={
                active
                  ? 'skeuo-tab skeuo-tab-active shrink-0 px-3 py-3 text-sm font-semibold text-brand-800'
                  : 'skeuo-tab shrink-0 px-3 py-3 text-sm font-semibold text-ink-500 hover:text-ink-800'
              }
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
