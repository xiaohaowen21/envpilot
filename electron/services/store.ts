import fs from 'node:fs/promises'
import path from 'node:path'

import { app } from 'electron'
import { z } from 'zod'

import { RUNTIME_KEYS, type InstalledVersion, type LogEntry, type RuntimeKey, type Settings } from '../../shared/types'

/**
 * Everything EnvPilot persists. Settings, snapshots and the activity log live
 * in the app data folder; installed runtimes live under the storage root,
 * which defaults to %LOCALAPPDATA%\EnvPilot because toolchains should not roam.
 */

const dataDir = () => app.getPath('userData')
const settingsFile = () => path.join(dataDir(), 'settings.json')
const logFile = () => path.join(dataDir(), 'activity.jsonl')
export const snapshotsDir = () => path.join(dataDir(), 'snapshots')

async function readJson<T>(file: string, schema: z.ZodType<T>, fallback: T): Promise<T> {
  try {
    return schema.parse(JSON.parse(await fs.readFile(file, 'utf8')))
  } catch {
    return fallback
  }
}

export async function writeJson(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const temp = `${file}.tmp`
  await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await fs.rename(temp, file)
}

// ---------- settings ----------

const settingsSchema = z.object({
  storageRoot: z.string().min(3),
  locale: z.enum(['zh-CN', 'en-US']),
  theme: z.enum(['system', 'light', 'dark']),
  keepDownloads: z.boolean(),
})

function defaultSettings(): Settings {
  const localAppData = process.env.LOCALAPPDATA ?? path.join(app.getPath('home'), 'AppData', 'Local')
  return {
    storageRoot: path.join(localAppData, 'EnvPilot'),
    locale: app.getLocale().startsWith('zh') ? 'zh-CN' : 'en-US',
    theme: 'system',
    keepDownloads: false,
  }
}

export async function loadSettings(): Promise<Settings> {
  const fallback = defaultSettings()
  const stored = await readJson(settingsFile(), settingsSchema.partial(), {})
  return { ...fallback, ...stored }
}

export async function saveSettings(settings: Settings): Promise<Settings> {
  await writeJson(settingsFile(), settingsSchema.parse(settings))
  return settings
}

export async function storagePaths() {
  const root = (await loadSettings()).storageRoot
  return {
    root,
    runtimes: path.join(root, 'runtimes'),
    links: path.join(root, 'links'),
    downloads: path.join(root, 'downloads'),
    state: path.join(root, 'state.json'),
  }
}

// ---------- installed runtimes ----------

const versionSchema = z.object({
  id: z.string(),
  version: z.string(),
  vendor: z.enum(['temurin', 'microsoft', 'oracle']).optional(),
  installDir: z.string(),
  installedAt: z.string(),
})

const stateSchema = z.object({
  versions: z.partialRecord(z.enum(RUNTIME_KEYS), z.array(versionSchema)).default({}),
})

export type InstalledState = Record<RuntimeKey, InstalledVersion[]>

export async function readInstalled(): Promise<InstalledState> {
  const { state } = await storagePaths()
  const { versions } = await readJson(state, stateSchema, { versions: {} })
  return Object.fromEntries(RUNTIME_KEYS.map((key) => [key, versions[key] ?? []])) as InstalledState
}

export async function writeInstalled(installed: InstalledState): Promise<void> {
  const { state } = await storagePaths()
  await writeJson(state, { versions: installed })
}

// ---------- activity log ----------

const LOG_LIMIT = 200

export async function log(action: string, detail?: string, level: LogEntry['level'] = 'info'): Promise<void> {
  const entry: LogEntry = { at: new Date().toISOString(), level, action, detail }
  await fs.mkdir(dataDir(), { recursive: true })
  await fs.appendFile(logFile(), `${JSON.stringify(entry)}\n`, 'utf8')
}

export async function readLog(): Promise<LogEntry[]> {
  const text = await fs.readFile(logFile(), 'utf8').catch(() => '')
  const lines = text.split('\n').filter(Boolean)
  if (lines.length > LOG_LIMIT * 2) {
    await fs.writeFile(logFile(), `${lines.slice(-LOG_LIMIT).join('\n')}\n`, 'utf8')
  }
  return lines
    .slice(-LOG_LIMIT)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as LogEntry]
      } catch {
        return []
      }
    })
    .reverse()
}
