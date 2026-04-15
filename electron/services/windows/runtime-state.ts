import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

import type {
  InstalledManagedRuntime,
  JavaVendor,
  ManagedRuntimeKey,
} from '../../../shared/contracts'
import { getStoragePaths } from './env-manager'

export interface RuntimeStateRecord extends InstalledManagedRuntime {
  sourceUrl?: string
}

interface RuntimeStateFile {
  runtimes: Record<ManagedRuntimeKey, RuntimeStateRecord[]>
}

const EMPTY_STATE: RuntimeStateFile = {
  runtimes: {
    go: [],
    java: [],
    node: [],
    php: [],
    python: [],
    rust: [],
  },
}

async function getStateFilePath(): Promise<string> {
  const { rootDir } = await getStoragePaths()

  return path.join(rootDir, 'state', 'runtime-state.json')
}

function buildRuntimeRecordId(runtime: ManagedRuntimeKey, record: Partial<RuntimeStateRecord>): string {
  return [
    runtime,
    record.vendor ?? 'default',
    record.version ?? 'unknown',
    record.installDir ?? 'no-dir',
  ].join('::')
}

function inferJavaVendorFromSource(sourceUrl?: string): JavaVendor | undefined {
  if (!sourceUrl) {
    return undefined
  }

  if (sourceUrl.includes('adoptium') || sourceUrl.includes('temurin')) {
    return 'temurin'
  }

  if (sourceUrl.includes('aka.ms') || sourceUrl.includes('microsoft')) {
    return 'microsoft'
  }

  if (sourceUrl.includes('oracle.com')) {
    return 'oracle'
  }

  return undefined
}

function inferJavaVendorFromImplementor(implementor?: string): JavaVendor | undefined {
  const normalized = implementor?.toLowerCase()

  if (!normalized) {
    return undefined
  }

  if (normalized.includes('adoptium') || normalized.includes('temurin')) {
    return 'temurin'
  }

  if (normalized.includes('microsoft')) {
    return 'microsoft'
  }

  if (normalized.includes('oracle')) {
    return 'oracle'
  }

  return undefined
}

function parseReleaseFile(content: string): Record<string, string> {
  return content.split(/\r?\n/).reduce<Record<string, string>>((accumulator, line) => {
    const match = line.match(/^([A-Z_]+)="?(.*?)"?$/)

    if (match) {
      accumulator[match[1]] = match[2]
    }

    return accumulator
  }, {})
}

async function normalizeRuntimeRecord(
  runtime: ManagedRuntimeKey,
  record: Partial<RuntimeStateRecord>,
): Promise<RuntimeStateRecord | null> {
  if (!record.installDir || !record.version || !record.addedAt) {
    return null
  }

  const normalized: RuntimeStateRecord = {
    addedAt: record.addedAt,
    entryPoint: record.entryPoint ?? '',
    id: record.id ?? buildRuntimeRecordId(runtime, record),
    installDir: record.installDir,
    isActive: Boolean(record.isActive),
    linkTarget: record.linkTarget,
    sourceUrl: record.sourceUrl,
    vendor: record.vendor,
    version: record.version,
  }

  if (runtime === 'java') {
    const releaseFile = path.join(record.installDir, 'release')

    if (existsSync(releaseFile)) {
      const parsed = parseReleaseFile(await fs.readFile(releaseFile, 'utf8'))
      normalized.vendor =
        normalized.vendor ??
        inferJavaVendorFromImplementor(parsed.IMPLEMENTOR) ??
        inferJavaVendorFromSource(record.sourceUrl)
      normalized.version =
        parsed.FULL_VERSION ||
        parsed.JAVA_RUNTIME_VERSION ||
        parsed.JAVA_VERSION ||
        normalized.version
    } else {
      normalized.vendor = normalized.vendor ?? inferJavaVendorFromSource(record.sourceUrl)
    }
  }

  normalized.linkTarget =
    normalized.linkTarget ??
    (runtime === 'rust' ? path.join(normalized.installDir, 'cargo', 'bin') : normalized.installDir)

  normalized.id = buildRuntimeRecordId(runtime, normalized)

  return normalized
}

async function normalizeStateFile(parsed: Partial<RuntimeStateFile>): Promise<RuntimeStateFile> {
  const runtimes = Object.keys(EMPTY_STATE.runtimes) as ManagedRuntimeKey[]
  const normalizedEntries = await Promise.all(
    runtimes.map(async (runtime) => {
      const records = parsed.runtimes?.[runtime] ?? []
      const normalized = (
        await Promise.all(records.map((record) => normalizeRuntimeRecord(runtime, record)))
      ).filter((record): record is RuntimeStateRecord => record !== null)

      return [runtime, normalized] as const
    }),
  )

  return {
    runtimes: Object.fromEntries(normalizedEntries) as RuntimeStateFile['runtimes'],
  }
}

export async function readRuntimeState(): Promise<RuntimeStateFile> {
  const filePath = await getStateFilePath()

  if (!existsSync(filePath)) {
    return structuredClone(EMPTY_STATE)
  }

  const content = await fs.readFile(filePath, 'utf8')
  const parsed = JSON.parse(content) as Partial<RuntimeStateFile>

  return normalizeStateFile(parsed)
}

export async function writeRuntimeState(state: RuntimeStateFile): Promise<void> {
  const filePath = await getStateFilePath()
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

export async function upsertInstalledRuntime(
  runtime: ManagedRuntimeKey,
  record: RuntimeStateRecord,
): Promise<RuntimeStateFile> {
  const state = await readRuntimeState()
  const filtered = state.runtimes[runtime]
    .filter((item) => item.id !== record.id)
    .map((item) => ({
      ...item,
      isActive: false,
    }))

  state.runtimes[runtime] = [...filtered, record].sort((left, right) =>
    right.version.localeCompare(left.version, undefined, { numeric: true }),
  )

  await writeRuntimeState(state)

  return state
}

export async function setActiveRuntimeVersion(
  runtime: ManagedRuntimeKey,
  runtimeId: string,
): Promise<RuntimeStateFile> {
  const state = await readRuntimeState()
  let matched = false

  state.runtimes[runtime] = state.runtimes[runtime].map((item) => {
    const isActive = item.id === runtimeId

    if (isActive) {
      matched = true
    }

    return {
      ...item,
      isActive,
    }
  })

  if (!matched) {
    throw new Error(`No managed ${runtime} version matched the selected record.`)
  }

  await writeRuntimeState(state)

  return state
}

export async function removeInstalledRuntime(
  runtime: ManagedRuntimeKey,
  runtimeId: string,
): Promise<RuntimeStateFile> {
  const state = await readRuntimeState()
  state.runtimes[runtime] = state.runtimes[runtime].filter((item) => item.id !== runtimeId)

  if (!state.runtimes[runtime].some((item) => item.isActive) && state.runtimes[runtime][0]) {
    state.runtimes[runtime][0] = {
      ...state.runtimes[runtime][0],
      isActive: true,
    }
  }

  await writeRuntimeState(state)

  return state
}
