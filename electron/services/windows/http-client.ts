import { createWriteStream, existsSync, statSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'

import type { DownloadProgress } from '../../../shared/contracts'

export type ProgressCallback = (progress: DownloadProgress) => void

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'EnvPilot/0.1.0',
    },
  })

  if (!response.ok) {
    throw new Error(`请求失败：${response.status} ${response.statusText}`)
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
    throw new Error(`请求失败：${response.status} ${response.statusText}`)
  }

  return response.text()
}

export async function downloadFile(
  url: string,
  destination: string,
  onProgress?: ProgressCallback,
): Promise<string> {
  const tempFilePath = `${destination}.part`
  const existingSize = existsSync(tempFilePath) ? statSync(tempFilePath).size : 0

  await fs.mkdir(path.dirname(destination), { recursive: true })

  const response = await fetch(url, {
    headers: {
      ...(existingSize > 0 ? { Range: `bytes=${existingSize}-` } : {}),
      'User-Agent': 'EnvPilot/0.1.0',
    },
  })

  if (!(response.ok || response.status === 206) || !response.body) {
    throw new Error(`下载失败：${response.status} ${response.statusText}`)
  }

  const contentLength = Number(response.headers.get('content-length') ?? 0)
  const totalBytes = existingSize + contentLength
  let receivedBytes = existingSize

  const append = response.status === 206 && existingSize > 0
  const fileStream = createWriteStream(tempFilePath, { flags: append ? 'a' : 'w' })
  const readable = Readable.fromWeb(response.body as globalThis.ReadableStream)

  if (onProgress && totalBytes > 0) {
    onProgress({
      bytesReceived: existingSize,
      contentLength: totalBytes,
      percentage: Math.round((existingSize / totalBytes) * 100),
      url,
    })
  }

  await new Promise<void>((resolve, reject) => {
    readable.on('data', (chunk: Buffer) => {
      receivedBytes += chunk.length

      if (onProgress && totalBytes > 0) {
        onProgress({
          bytesReceived: receivedBytes,
          contentLength: totalBytes,
          percentage: Math.round((receivedBytes / totalBytes) * 100),
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

  return destination
}
