import { useCallback, useEffect, useState } from 'react'

import type { ApiArgs, ApiReturn, Bridge, Channel } from '../shared/api'
import type { ErrorPayload } from '../shared/errors'

declare global {
  interface Window {
    envPilot: Bridge
  }
}

export class ApiError extends Error {
  readonly payload: ErrorPayload

  constructor(payload: ErrorPayload) {
    super(payload.code)
    this.payload = payload
  }
}

export async function call<C extends Channel>(channel: C, ...args: ApiArgs<C>): Promise<ApiReturn<C>> {
  const result = await window.envPilot.invoke(channel, ...args)
  if (!result.ok) throw new ApiError(result.error)
  return result.data
}

export function toPayload(error: unknown): ErrorPayload {
  return error instanceof ApiError
    ? error.payload
    : { code: 'unknown', params: { message: error instanceof Error ? error.message : String(error) } }
}

export interface Query<T> {
  data?: T
  error?: ErrorPayload
  loading: boolean
  reload: () => Promise<void>
}

/** Loads data from the main process and keeps the last good value while reloading. */
export function useQuery<C extends Channel>(channel: C, ...args: ApiArgs<C>): Query<ApiReturn<C>> {
  const [state, setState] = useState<Omit<Query<ApiReturn<C>>, 'reload'>>({ loading: true })
  const key = JSON.stringify(args)

  const reload = useCallback(async () => {
    setState((previous) => ({ ...previous, loading: true }))
    try {
      const data = await call(channel, ...(JSON.parse(key) as ApiArgs<C>))
      setState({ data, loading: false })
    } catch (error) {
      setState((previous) => ({ data: previous.data, error: toPayload(error), loading: false }))
    }
  }, [channel, key])

  useEffect(() => {
    void reload()
  }, [reload])

  return { ...state, reload }
}
