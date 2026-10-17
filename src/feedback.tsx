import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

import { toPayload } from './api'
import { useI18n } from './i18n'

interface Toast {
  id: number
  text: string
  tone: 'success' | 'danger'
}

interface Feedback {
  notify: (text: string) => void
  fail: (error: unknown) => void
}

const FeedbackContext = createContext<Feedback | null>(null)
let nextId = 0

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { errorText } = useI18n()
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((text: string, tone: Toast['tone']) => {
    const id = ++nextId
    setToasts((current) => [...current, { id, text, tone }])
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), tone === 'danger' ? 8000 : 3500)
  }, [])

  const value = useMemo<Feedback>(
    () => ({
      notify: (text) => push(text, 'success'),
      fail: (error) => push(errorText(toPayload(error)), 'danger'),
    }),
    [push, errorText],
  )

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.tone}`}>
            {toast.text}
          </div>
        ))}
      </div>
    </FeedbackContext.Provider>
  )
}

export function useFeedback(): Feedback {
  const context = useContext(FeedbackContext)
  if (!context) throw new Error('useFeedback must be used inside FeedbackProvider')
  return context
}

/**
 * Runs an action, tracks whether it is in flight, and reports failures as a toast.
 * Resolves to true when the action succeeded.
 */
export function useAction() {
  const { fail } = useFeedback()
  const [pending, setPending] = useState<string | null>(null)

  const run = useCallback(
    async (key: string, action: () => Promise<unknown>) => {
      setPending(key)
      try {
        await action()
        return true
      } catch (error) {
        fail(error)
        return false
      } finally {
        setPending(null)
      }
    },
    [fail],
  )

  return { pending, run }
}
