export const RUNTIME_KEYS = ['java', 'node', 'python', 'go', 'rust', 'php'] as const
export type RuntimeKey = (typeof RUNTIME_KEYS)[number]

export const JAVA_VENDORS = ['temurin', 'microsoft', 'oracle'] as const
export type JavaVendor = (typeof JAVA_VENDORS)[number]

export type Scope = 'user' | 'machine'
export type Locale = 'zh-CN' | 'en-US'
export type Theme = 'system' | 'light' | 'dark'

/** One raw value from the registry Environment key, exactly as stored. */
export interface EnvVar {
  scope: Scope
  name: string
  value: string
  kind: 'String' | 'ExpandString'
}

export interface Settings {
  storageRoot: string
  locale: Locale
  theme: Theme
  keepDownloads: boolean
}

// ---------- runtimes ----------

export interface InstalledVersion {
  id: string
  version: string
  vendor?: JavaVendor
  installDir: string
  installedAt: string
}

/** Where a command actually resolves when a new terminal starts. */
export interface CommandResolution {
  command: string
  /** First match in effective PATH order (machine before user), if any. */
  winner?: PathHit
  /** Matches that come before EnvPilot's own entry and therefore hide it. */
  shadowing: PathHit[]
  /** True when the winner is EnvPilot's own junction. */
  managed: boolean
  detectedVersion?: string
}

export interface PathHit {
  scope: Scope
  /** The PATH entry as stored, e.g. `%JAVA_HOME%\bin`. */
  entry: string
  /** The executable it points to after expansion. */
  file: string
  /** Inside the Windows folder; EnvPilot will not offer to remove it. */
  essential: boolean
}

export interface RuntimeStatus {
  key: RuntimeKey
  versions: InstalledVersion[]
  activeId?: string
  linkPath: string
  resolution: CommandResolution
}

export interface CatalogEntry {
  version: string
  channel: string
  vendor?: JavaVendor
}

export interface InstallRequest {
  runtime: RuntimeKey
  version: string
  vendor?: JavaVendor
}

export interface InstallProgress {
  runtime: RuntimeKey
  phase: 'download' | 'verify' | 'extract' | 'configure'
  received?: number
  total?: number
}

// ---------- PATH health ----------

export type PathIssueKind = 'empty' | 'duplicate' | 'missing' | 'quoted' | 'unverifiable'

export interface PathIssue {
  id: string
  scope: Scope
  index: number
  entry: string
  kind: PathIssueKind
  /** Whether the fix is safe enough to be pre-selected. */
  recommended: boolean
}

export interface EnvironmentReport {
  variables: EnvVar[]
  issues: PathIssue[]
}

// ---------- snapshots ----------

export interface SnapshotInfo {
  id: string
  createdAt: string
  reason: string
  variableCount: number
}

export interface EnvChange {
  scope: Scope
  name: string
  before?: string
  after?: string
}

export interface LogEntry {
  at: string
  level: 'info' | 'error'
  action: string
  detail?: string
}
