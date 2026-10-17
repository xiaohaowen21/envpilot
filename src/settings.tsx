import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import type { Settings } from '../shared/types'
import { call } from './api'

interface SettingsContextValue {
  settings: Settings
  update: (patch: Partial<Settings>) => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: (settings: Settings) => ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    void call('settings:get').then(setSettings)
  }, [])

  useEffect(() => {
    if (!settings) return
    const root = document.documentElement
    root.lang = settings.locale
    const dark = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      root.dataset.theme = settings.theme === 'system' ? (dark.matches ? 'dark' : 'light') : settings.theme
    }
    apply()
    dark.addEventListener('change', apply)
    return () => dark.removeEventListener('change', apply)
  }, [settings])

  if (!settings) return null

  const update = async (patch: Partial<Settings>) => setSettings(await call('settings:update', patch))

  return <SettingsContext.Provider value={{ settings, update }}>{children(settings)}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext)
  if (!context) throw new Error('useSettings must be used inside SettingsProvider')
  return context
}
