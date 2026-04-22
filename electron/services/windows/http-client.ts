import { createWriteStream, existsSync, statSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'

import type { DownloadProgress } from '../../../shared/contracts'

export type ProgressCallback = (progress: DownloadProgress) => void

function emitProgress(onProgress: ProgressCallback | undefined, progress: DownloadProgress): void {
  onProgress?.(progress)
}

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'EnvPilot/0.1.0',
    },
  })

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`)
  }

  return (await response.json()) as T
}

export async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'EnvPilot/0.1.0',
    },
  })

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`)
  }

  return response.text()
}

export async function downloadFile(
  url: string,
  destination: string,
  onProgress?: ProgressCallback,
): Promise<string> {
  if (existsSync(destination)) {
    const existingFileSize = statSync(destination).size

    if (existingFileSize > 0) {
      emitProgress(onProgress, {
        bytesReceived: existingFileSize,
        contentLength: existingFileSize,
        detail: 'Using cached package',
        label: 'Package ready',
        percentage: 100,
        stage: 'completed',
        url,
      })

      return destination
    }
  }

  const tempFilePath = `${destination}.part`
  const existingPartSize = existsSync(tempFilePath) ? statSync(tempFilePath).size : 0

  await fs.mkdir(path.dirname(destination), { recursive: true })
  emitProgress(onProgress, {
    bytesReceived: 0,
    contentLength: 0,
    detail: 'Connecting to official source',
    label: 'Preparing download',
    percentage: 0,
    stage: 'preparing',
    url,
  })

  const response = await fetch(url, {
    headers: {
      ...(existingPartSize > 0 ? { Range: `bytes=${existingPartSize}-` } : {}),
      'User-Agent': 'EnvPilot/0.1.0',
    },
  })

  if (!(response.ok || response.status === 206) || !response.body) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`)
  }

  const resumeSupported = response.status === 206 && existingPartSize > 0
  const initialBytes = resumeSupported ? existingPartSize : 0
  const contentLength = Number(response.headers.get('content-length') ?? 0)
  const totalBytes = initialBytes + contentLength
  let receivedBytes = initialBytes

  const fileStream = createWriteStream(tempFilePath, { flags: resumeSupported ? 'a' : 'w' })
  const readable = Readable.fromWeb(response.body as globalThis.ReadableStream)

  if (totalBytes > 0) {
    emitProgress(onProgress, {
      bytesReceived: initialBytes,
      contentLength: totalBytes,
      detail: resumeSupported ? 'Resuming download' : 'Downloading official package',
      label: 'Downloading',
      percentage: Math.round((initialBytes / totalBytes) * 100),
      stage: 'downloading',
      url,
    })
  }

  await new Promise<void>((resolve, reject) => {
    readable.on('data', (chunk: Buffer) => {
      receivedBytes += chunk.length

      if (totalBytes > 0) {
        emitProgress(onProgress, {
          bytesReceived: receivedBytes,
          contentLength: totalBytes,
          detail: resumeSupported ? 'Resuming download' : 'Downloading official package',
          label: 'Downloading',
          percentage: Math.round((receivedBytes / totalBytes) * 100),
          stage: 'downloading',
          url,
        })
      }
    })

    readable.pipe(fileStream)
    readable.on('error', reject)
    fileStream.on('error', reject)
    fileStream.on('finish', resolve)
  })

  await fs.rename(tempFilePath, destination)

  const finalSize = statSync(destination).size
  emitProgress(onProgress, {
    bytesReceived: finalSize,
    contentLength: finalSize,
    detail: 'Package download finished',
    label: 'Package ready',
    percentage: 100,
    stage: 'completed',
    url,
  })

  return destination
}
