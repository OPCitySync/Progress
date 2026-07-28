'use client'

import { Moon, Sun } from 'lucide-react'
import { useWorkspaceTheme } from '@/components/WorkspaceChrome'

/** A compact control that keeps the workspace color preference in one place. */
export function ThemeToggle() {
  const { theme, toggleTheme } = useWorkspaceTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      className="skeuo-theme-toggle"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  )
}
