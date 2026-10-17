import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'

import type { ErrorPayload } from '../shared/errors'
import type { Locale } from '../shared/types'
import { enUS } from './locales/en-US'
import { zhCN, type MessageKey } from './locales/zh-CN'

const messages: Record<Locale, Record<MessageKey, string>> = { 'zh-CN': zhCN, 'en-US': enUS }

type Params = Record<string, string | number>

interface I18n {
  locale: Locale
  t: (key: MessageKey, params?: Params) => string
  /** Looks up a key built at runtime, falling back to the key itself. */
  tx: (key: string, params?: Params) => string
  errorText: (error: ErrorPayload) => string
  formatTime: (iso: string) => string
}

const I18nContext = createContext<I18n | null>(null)

const fill = (template: string, params: Params = {}) =>
  template.replace(/\{(\w+)\}/g, (match, name: string) => String(params[name] ?? match))

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const tx = useCallback(
    (key: string, params?: Params) => fill(messages[locale][key as MessageKey] ?? key, params),
    [locale],
  )

  const value = useMemo<I18n>(() => {
    const time = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' })
    return {
      locale,
      t: tx,
      tx,
      errorText: (error) => tx(`errors.${error.code}`, error.params),
      formatTime: (iso) => time.format(new Date(iso)),
    }
  }, [locale, tx])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18n {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useI18n must be used inside I18nProvider')
  return context
}
