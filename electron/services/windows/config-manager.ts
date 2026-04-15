import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

import { app } from 'electron'

import type { AppConfig, OperationResult } from '../../../shared/contracts'

const DEFAULT_CONFIG: AppConfig = {
  downloadCleanupEnabled: true,
  language: 'zh-CN',
  proxyEnabled: false,
  storageRoot: existsSync('D:\\') ? 'D:\\EnvPilot' : '',
  theme: 'system',
}

function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'config.json')
}

export async function loadConfig(): Promise<AppConfig> {
  const configPath = getConfigPath()

  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG }
  }

  try {
    const content = await fs.readFile(configPath, 'utf8')
    const parsed = JSON.parse(content) as Partial<AppConfig>

    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      storageRoot: parsed.storageRoot || DEFAULT_CONFIG.storageRoot,
    }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export async function saveConfig(updates: Partial<AppConfig>): Promise<OperationResult> {
  const configPath = getConfigPath()
  const current = await loadConfig()
  const merged: AppConfig = {
    ...current,
    ...updates,
  }

  await fs.mkdir(path.dirname(configPath), { recursive: true })
  await fs.writeFile(configPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8')

  return {
    message: '配置已保存。',
    ok: true,
  }
}

export async function exportConfig(): Promise<string> {
  const config = await loadConfig()
  return JSON.stringify(config, null, 2)
}

export async function importConfig(data: string): Promise<OperationResult> {
  try {
    const parsed = JSON.parse(data) as Partial<AppConfig>

    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Invalid config format')
    }

    await saveConfig(parsed)

    return {
      message: '配置已导入。',
      ok: true,
    }
  } catch (error) {
    return {
      message: `导入失败: ${error instanceof Error ? error.message : String(error)}`,
      ok: false,
    }
  }
}

export function resolveStorageRoot(config: AppConfig): string {
  return config.storageRoot || (existsSync('D:\\') ? 'D:\\EnvPilot' : app.getPath('userData'))
}
