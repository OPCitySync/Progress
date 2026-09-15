'use client'

import { useEffect } from 'react'

const variableNames = [
  '--program-palette-deep',
  '--program-palette-mid',
  '--program-palette-accent',
  '--program-palette-accent-deep',
] as const

export function IssuerPaletteRoot({ colors }: { colors: readonly [string, string, string, string] }) {
  const [deep, mid, accent, accentDeep] = colors

  useEffect(() => {
    const root = document.documentElement
    const values = [deep, mid, accent, accentDeep]
    const previous = variableNames.map((name) => root.style.getPropertyValue(name))

    variableNames.forEach((name, index) => root.style.setProperty(name, values[index]))

    return () => {
      variableNames.forEach((name, index) => {
        if (previous[index]) root.style.setProperty(name, previous[index])
        else root.style.removeProperty(name)
      })
    }
  }, [accent, accentDeep, deep, mid])

  return null
}
