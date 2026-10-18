/**
 * An in-memory stand-in for the Electron bridge, used only by `npm run dev:web`
 * so the interface can be developed and reviewed on any OS.
 */
import type { Api, ApiArgs, Bridge, Channel } from '../../shared/api'
import type { EnvVar, InstallProgress, LogEntry, RuntimeKey, RuntimeStatus, Settings, SnapshotInfo } from '../../shared/types'

const LINKS = 'C:\\Users\\dev\\AppData\\Local\\EnvPilot\\links'
const now = () => new Date().toISOString()

const settings: Settings = {
  storageRoot: 'C:\\Users\\dev\\AppData\\Local\\EnvPilot',
  locale: 'zh-CN',
  theme: 'system',
  keepDownloads: false,
}

const variables: EnvVar[] = [
  { scope: 'machine', name: 'Path', value: 'C:\\Program Files\\Common Files\\Oracle\\Java\\javapath;%SystemRoot%\\system32;%SystemRoot%;C:\\Program Files\\Git\\cmd;;C:\\OldTool\\bin', kind: 'ExpandString' },
  { scope: 'machine', name: 'ComSpec', value: '%SystemRoot%\\system32\\cmd.exe', kind: 'ExpandString' },
  { scope: 'machine', name: 'OS', value: 'Windows_NT', kind: 'String' },
  { scope: 'user', name: 'Path', value: `${LINKS}\\java\\bin;${LINKS}\\node;%USERPROFILE%\\AppData\\Local\\Microsoft\\WindowsApps;C:\\Program Files\\Git\\cmd;E:\\portable\\bin`, kind: 'ExpandString' },
  { scope: 'user', name: 'JAVA_HOME', value: `${LINKS}\\java`, kind: 'String' },
  { scope: 'user', name: 'TEMP', value: '%USERPROFILE%\\AppData\\Local\\Temp', kind: 'ExpandString' },
]

const runtimes: RuntimeStatus[] = (['java', 'node', 'python', 'go', 'rust', 'php'] as RuntimeKey[]).map((key) => ({
  key,
  versions: [],
  linkPath: `${LINKS}\\${key}`,
  resolution: { command: `${key === 'rust' ? 'rustc' : key}.exe`, shadowing: [], managed: false },
}))

const java = runtimes[0]
java.versions = [
  { id: 'temurin-21.0.5', version: '21.0.5', vendor: 'temurin', installDir: 'C:\\Users\\dev\\AppData\\Local\\EnvPilot\\runtimes\\java\\temurin-21.0.5', installedAt: now() },
  { id: 'temurin-17.0.13', version: '17.0.13', vendor: 'temurin', installDir: 'C:\\Users\\dev\\AppData\\Local\\EnvPilot\\runtimes\\java\\temurin-17.0.13', installedAt: now() },
]
java.activeId = 'temurin-21.0.5'
const oracle = { scope: 'machine' as const, entry: 'C:\\Program Files\\Common Files\\Oracle\\Java\\javapath', file: 'C:\\Program Files\\Common Files\\Oracle\\Java\\javapath\\java.exe', essential: false }
java.resolution = { command: 'java.exe', winner: oracle, shadowing: [oracle], managed: false, detectedVersion: '1.8.0_421' }

const node = runtimes[1]
node.versions = [{ id: '22.11.0', version: '22.11.0', installDir: 'C:\\Users\\dev\\AppData\\Local\\EnvPilot\\runtimes\\node\\22.11.0', installedAt: now() }]
node.activeId = '22.11.0'
node.resolution = { command: 'node.exe', winner: { scope: 'user', entry: `${LINKS}\\node`, file: `${LINKS}\\node\\node.exe`, essential: false }, shadowing: [], managed: true, detectedVersion: '22.11.0' }

const snapshots: SnapshotInfo[] = [{ id: 'a', createdAt: now(), reason: 'runtimes.environment', variableCount: variables.length }]
const log: LogEntry[] = [{ at: now(), level: 'info', action: 'runtime.install', detail: 'node 22.11.0' }]

const progressListeners = new Set<(progress: InstallProgress) => void>()
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const handlers: { [C in Channel]: (...args: Parameters<Api[C]>) => ReturnType<Api[C]> | Promise<ReturnType<Api[C]>> } = {
  'runtimes:list': () => structuredClone(runtimes),
  'runtimes:catalog': async (key, vendor) => {
    await sleep(400)
    if (key === 'java') return ['25', '21', '17', '11'].map((version) => ({ version, vendor, channel: 'LTS' }))
    return ['3.13.0', '3.12.7', '3.11.10'].map((version, index) => ({ version, channel: index ? 'Stable' : 'Latest' }))
  },
  'runtimes:install': async ({ runtime, version, vendor }) => {
    for (let received = 0; received <= 100; received += 10) {
      progressListeners.forEach((listener) => listener({ runtime, phase: 'download', received, total: 100 }))
      await sleep(120)
    }
    const entry = { id: version, version, vendor, installDir: `C:\\EnvPilot\\runtimes\\${runtime}\\${version}`, installedAt: now() }
    const target = runtimes.find((item) => item.key === runtime)!
    target.versions.push(entry)
    target.activeId = entry.id
    return entry
  },
  'runtimes:switch': (key, id) => {
    runtimes.find((item) => item.key === key)!.activeId = id
  },
  'runtimes:uninstall': (key, id) => {
    const target = runtimes.find((item) => item.key === key)!
    target.versions = target.versions.filter((version) => version.id !== id)
  },
  'env:report': () => ({
    variables,
    issues: [
      { id: '1', scope: 'machine', index: 4, entry: '', kind: 'empty', recommended: true },
      { id: '2', scope: 'machine', index: 5, entry: 'C:\\OldTool\\bin', kind: 'missing', recommended: true },
      { id: '3', scope: 'user', index: 3, entry: 'C:\\Program Files\\Git\\cmd', kind: 'duplicate', recommended: true },
      { id: '4', scope: 'user', index: 4, entry: 'E:\\portable\\bin', kind: 'unverifiable', recommended: false },
    ],
  }),
  'env:cleanup': () => [],
  'env:removePathEntry': () => {
    java.resolution = { ...java.resolution, shadowing: [], managed: true, detectedVersion: '21.0.5' }
    return []
  },
  'snapshots:list': () => snapshots,
  'snapshots:create': () => {
    const info = { id: String(Date.now()), createdAt: now(), reason: 'manual', variableCount: variables.length }
    snapshots.unshift(info)
    return info
  },
  'snapshots:diff': () => [
    { scope: 'user', name: 'Path', before: `${LINKS}\\java\\bin;C:\\Tools`, after: 'C:\\Tools' },
    { scope: 'user', name: 'JAVA_HOME', before: `${LINKS}\\java` },
  ],
  'snapshots:restore': () => [],
  'snapshots:delete': (id) => {
    snapshots.splice(snapshots.findIndex((item) => item.id === id), 1)
  },
  'logs:list': () => log,
  'settings:get': () => settings,
  'settings:update': (patch) => Object.assign(settings, patch),
  'settings:openStorage': () => undefined,
}

export function installDevBridge(): void {
  const bridge: Bridge = {
    invoke: async <C extends Channel>(channel: C, ...args: ApiArgs<C>) => {
      const handler = handlers[channel] as (...args: ApiArgs<C>) => ReturnType<Api[C]>
      return { ok: true as const, data: structuredClone(await handler(...args)) }
    },
    onInstallProgress: (listener) => {
      progressListeners.add(listener)
      return () => progressListeners.delete(listener)
    },
  }
  window.envPilot = bridge
}
