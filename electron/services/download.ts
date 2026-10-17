import { createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import { AppError } from '../../shared/errors'
import { pickChecksum, type Release } from '../core/catalog'
import { pathExists, sha256 } from '../platform/files'

const HEADERS = { 'User-Agent': 'EnvPilot' }
const REQUEST_TIMEOUT = 20_000
const STALL_TIMEOUT = 60_000

async function request(url: string): Promise<Response> {
  const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(REQUEST_TIMEOUT) }).catch(
    (error: Error) => {
      throw new AppError('download_failed', { url, message: error.message })
    },
  )
  if (!response.ok) throw new AppError('download_failed', { url, message: `HTTP ${response.status}` })
  return response
}

export const fetchJson = async <T>(url: string) => (await request(url)).json() as Promise<T>
export const fetchText = async (url: string) => (await request(url)).text()

async function expectedChecksum(release: Release): Promise<string | undefined> {
  if (release.sha256) return release.sha256.toLowerCase()
  if (!release.sha256Url) return undefined
  return pickChecksum(await fetchText(release.sha256Url), release.fileName)
}

export type ProgressListener = (received: number, total?: number) => void

/** Streams `url` to `file`, aborting if no data arrives for a minute. */
async function stream(url: string, file: string, onProgress: ProgressListener): Promise<void> {
  const controller = new AbortController()
  let stall = setTimeout(() => controller.abort(), STALL_TIMEOUT)
  const response = await fetch(url, { headers: HEADERS, signal: controller.signal }).catch((error: Error) => {
    throw new AppError('download_failed', { url, message: error.message })
  })
  if (!response.ok || !response.body) {
    clearTimeout(stall)
    throw new AppError('download_failed', { url, message: `HTTP ${response.status}` })
  }

  const total = Number(response.headers.get('content-length')) || undefined
  let received = 0
  const meter = new Transform({
    transform(chunk: Buffer, _encoding, done) {
      clearTimeout(stall)
      stall = setTimeout(() => controller.abort(), STALL_TIMEOUT)
      received += chunk.length
      onProgress(received, total)
      done(null, chunk)
    },
  })

  try {
    await pipeline(Readable.fromWeb(response.body as never), meter, createWriteStream(file))
  } catch (error) {
    throw new AppError('download_failed', { url, message: (error as Error).message })
  } finally {
    clearTimeout(stall)
  }
}

/**
 * Downloads a release into `dir` and verifies it against the publisher's
 * SHA-256 when one is published. A cached file is reused only if it verifies.
 */
export async function download(
  release: Release,
  dir: string,
  onProgress: ProgressListener,
  onVerify: () => void,
): Promise<string> {
  const file = path.join(dir, release.fileName)
  const expected = await expectedChecksum(release)
  await fs.mkdir(dir, { recursive: true })

  if (expected && (await pathExists(file)) && (await sha256(file)) === expected) return file

  const partial = `${file}.partial`
  await stream(release.url, partial, onProgress)

  if (expected) {
    onVerify()
    const actual = await sha256(partial)
    if (actual !== expected) {
      await fs.rm(partial, { force: true })
      throw new AppError('checksum_mismatch', { file: release.fileName })
    }
  }

  await fs.rename(partial, file)
  return file
}
