import type { Result } from './errors'
import type {
  CatalogEntry,
  EnvChange,
  EnvironmentReport,
  InstallProgress,
  InstallRequest,
  InstalledVersion,
  JavaVendor,
  LogEntry,
  RuntimeKey,
  RuntimeStatus,
  Scope,
  Settings,
  SnapshotInfo,
} from './types'

/** Every request the renderer can make, keyed by IPC channel. */
export interface Api {
  'runtimes:list': () => RuntimeStatus[]
  'runtimes:catalog': (runtime: RuntimeKey, vendor?: JavaVendor) => CatalogEntry[]
  'runtimes:install': (request: InstallRequest) => InstalledVersion
  'runtimes:switch': (runtime: RuntimeKey, id: string) => void
  'runtimes:uninstall': (runtime: RuntimeKey, id: string) => void

  'env:report': () => EnvironmentReport
  'env:cleanup': (issueIds: string[]) => EnvChange[]
  'env:removePathEntry': (scope: Scope, entry: string) => EnvChange[]

  'snapshots:list': () => SnapshotInfo[]
  'snapshots:create': () => SnapshotInfo
  'snapshots:diff': (id: string) => EnvChange[]
  'snapshots:restore': (id: string) => EnvChange[]
  'snapshots:delete': (id: string) => void

  'logs:list': () => LogEntry[]

  'settings:get': () => Settings
  'settings:update': (patch: Partial<Settings>) => Settings
  'settings:openStorage': () => void
}

export type Channel = keyof Api
export type ApiArgs<C extends Channel> = Parameters<Api[C]>
export type ApiReturn<C extends Channel> = ReturnType<Api[C]>

export const CHANNELS = [
  'runtimes:list',
  'runtimes:catalog',
  'runtimes:install',
  'runtimes:switch',
  'runtimes:uninstall',
  'env:report',
  'env:cleanup',
  'env:removePathEntry',
  'snapshots:list',
  'snapshots:create',
  'snapshots:diff',
  'snapshots:restore',
  'snapshots:delete',
  'logs:list',
  'settings:get',
  'settings:update',
  'settings:openStorage',
] as const satisfies readonly Channel[]

// Fails to compile if a channel is added to Api but not to CHANNELS.
export const ALL_CHANNELS_LISTED: [Exclude<Channel, (typeof CHANNELS)[number]>] extends [never] ? true : never =
  true

export const PROGRESS_EVENT = 'install:progress'

/** What the preload script exposes on `window.envPilot`. */
export interface Bridge {
  invoke<C extends Channel>(channel: C, ...args: ApiArgs<C>): Promise<Result<ApiReturn<C>>>
  onInstallProgress(listener: (progress: InstallProgress) => void): () => void
}
