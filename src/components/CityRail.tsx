'use client'

import Link from 'next/link'
import { GripVertical, MapPinned, PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react'
import { switchCityAction } from '@/app/actions'
import type { CityNetwork } from '@/lib/services/city-networks'

/** The narrow, persistent rail for selecting and adding city networks. */
export function CityRail({
  homeHref,
  cities,
  activeCityId,
  collapsed,
  onToggle,
}: {
  homeHref: string
  cities: CityNetwork[]
  activeCityId?: string
  collapsed: boolean
  onToggle: () => void
}) {
  return (
    <aside
      className={`skeuo-city-rail fixed inset-y-0 left-0 z-30 hidden flex-col items-center overflow-visible py-5 transition-[width,background,box-shadow] duration-300 ease-out md:flex ${
        collapsed ? 'w-0 !bg-none !bg-transparent !shadow-none' : 'w-[4.5rem]'
      }`}
    >
      <div aria-hidden={collapsed} className={`flex h-full flex-col items-center transition-all duration-200 ${collapsed ? 'pointer-events-none -translate-x-3 opacity-0' : 'translate-x-0 opacity-100'}`}>
        <div className="flex flex-col items-center gap-3">
          {cities.slice(0, 4).map((city) => {
            const active = city.id === activeCityId
            return (
              <form action={switchCityAction} key={city.id}>
                <input type="hidden" name="cityId" value={city.id} />
                <input type="hidden" name="redirectTo" value={homeHref} />
                <button
                  type="submit"
                  aria-label={`Switch to ${city.name}`}
                  title={city.name}
                  className={
                    active
                      ? 'flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-500 text-sm font-bold text-brand-900 shadow-lg shadow-black/20 transition-transform hover:scale-105'
                      : 'flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-sm font-bold text-white transition-colors hover:bg-white/20'
                  }
                >
                  <span>{city.name.slice(0, 1).toUpperCase()}</span>
                </button>
              </form>
            )
          })}
        </div>
        <div className="mt-5 h-px w-8 bg-white/10" />
        <Link
          href="/cities"
          aria-label="Add another city network"
          title="Add another city network"
          className="mt-5 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/75 transition-colors hover:bg-white/20 hover:text-white"
        >
          <Plus size={22} strokeWidth={2.25} />
        </Link>
        <Link
          href="/workspace/cities"
          aria-label="Discover city networks"
          title="Discover city networks"
          className="mt-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl text-white/45 transition-colors hover:bg-white/10 hover:text-white"
        >
          <MapPinned size={19} />
        </Link>
      </div>
      <button
        type="button"
        aria-label={collapsed ? 'Expand City Networks rail' : 'Collapse City Networks rail'}
        aria-pressed={!collapsed}
        title={collapsed ? 'Show City Networks' : 'Hide City Networks'}
        onClick={onToggle}
        className="skeuo-city-pull-tab group absolute left-[calc(100%-0.15rem)] top-1/2 flex h-16 w-4 -translate-y-1/2 items-center justify-center overflow-hidden rounded-r-xl text-brand-900 transition-[width,transform] duration-200 hover:w-8 hover:translate-x-0.5 focus:outline-none focus-visible:w-8 focus-visible:ring-2 focus-visible:ring-gold-300"
      >
        <span className="flex flex-col items-center gap-0.5">
          <GripVertical size={14} strokeWidth={2.2} className="opacity-55" />
          <span className="grid max-h-0 place-items-center overflow-hidden opacity-0 transition-[max-height,opacity] duration-150 group-hover:max-h-4 group-hover:opacity-100 group-focus-visible:max-h-4 group-focus-visible:opacity-100">
            {collapsed ? <PanelLeftOpen size={15} strokeWidth={2.2} /> : <PanelLeftClose size={15} strokeWidth={2.2} />}
          </span>
        </span>
      </button>
    </aside>
  )
}
