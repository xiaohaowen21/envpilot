import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

import type { OperationLogEntry, OperationResult } from '../../../shared/contracts'
import { getStoragePaths } from './env-manager'

async function getLogFilePath(): Promise<string> {
  const { rootDir } = await getStoragePaths()

  return path.join(rootDir, 'logs', 'operations.log')
}

export async function appendOperationLog(entry: OperationLogEntry): Promise<void> {
  const filePath = await getLogFilePath()
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.appendFile(filePath, `${JSON.stringify(entry)}\n`, 'utf8')
}

export async function readRecentOperationLogs(limit = 20): Promise<OperationLogEntry[]> {
  const filePath = await getLogFilePath()

  if (!existsSync(filePath)) {
    return []
  }

  const content = await fs.readFile(filePath, 'utf8')

  return content
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as OperationLogEntry)
    .slice(-limit)
    .reverse()
}

export async function clearOperationLogs(): Promise<OperationResult> {
  const filePath = await getLogFilePath()

  if (existsSync(filePath)) {
    await fs.writeFile(filePath, '', 'utf8')
  }

  return {
    message: '日志已清除。',
    ok: true,
  }
}
