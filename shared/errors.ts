/**
 * Errors cross the IPC boundary as a code plus parameters, so the renderer
 * can phrase them in the user's language.
 */
export type ErrorCode =
  | 'busy'
  | 'cancelled'
  | 'checksum_mismatch'
  | 'download_failed'
  | 'elevation_declined'
  | 'install_failed'
  | 'invalid_input'
  | 'not_found'
  | 'runtime_in_use'
  | 'storage_locked'
  | 'unknown'

export type ErrorParams = Record<string, string | number>

export interface ErrorPayload {
  code: ErrorCode
  params: ErrorParams
}

export class AppError extends Error {
  readonly code: ErrorCode
  readonly params: ErrorParams

  constructor(code: ErrorCode, params: ErrorParams = {}) {
    super(`${code}${Object.keys(params).length ? ` ${JSON.stringify(params)}` : ''}`)
    this.name = 'AppError'
    this.code = code
    this.params = params
  }
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: ErrorPayload }
