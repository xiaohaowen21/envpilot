export type RuntimeKey =
  | 'java'
  | 'python'
  | 'node'
  | 'go'
  | 'rust'
  | 'php'
  | 'cpp'

export type ManagedRuntimeKey = 'java' | 'python' | 'node' | 'go' | 'rust' | 'php'
export type SystemToolKey = 'wsl' | 'virtual-machine-platform' | 'hyper-v' | 'docker'
export type JavaVendor = 'temurin' | 'oracle' | 'microsoft'

export type RuntimeStatus = 'ready' | 'missing' | 'warning'
export type VariableScope = 'user' | 'machine'
export type PathIssueType = 'duplicate' | 'missing' | 'empty' | 'quoted'
export type ManagedRuntimeStatus = 'ready' | 'not_installed'
export type SystemToolStatus = 'installed' | 'not_installed' | 'partial'
export type RuntimeInstallerType = 'archive' | 'executable'

export interface SystemSummary {
  platform: string
  release: string
  architecture: string
  isAdmin: boolean
  hasNetwork: boolean
  shell: string
}

export interface RuntimeSummary {
  key: RuntimeKey
  label: string
  command: string
  recommendedVersion: string
  detected: boolean
  status: RuntimeStatus
  version?: string
  notes?: string
}

export interface EnvVariableEntry {
  name: string
  value: string
  scope: VariableScope
  source: 'registry'
}

export interface PathIssue {
  id: string
  scope: VariableScope
  type: PathIssueType
  entry: string
  normalizedEntry: string
  variable: 'Path'
}

export interface CleanupOperation {
  type: PathIssueType
  scope: VariableScope
  target: string
  reason: string
}

export interface CleanupPreview {
  generatedAt: string
  removableCount: number
  fixableCount: number
  operations: CleanupOperation[]
}

export interface BackupRecord {
  filePath: string
  createdAt: string
  scopeCount: number
}

export interface BackupResult {
  ok: boolean
  message: string
  record?: BackupRecord
}

export interface OperationResult {
  ok: boolean
  message: string
}

export interface OperationLogEntry {
  createdAt: string
  level: 'info' | 'error'
  message: string
}

export interface InstalledProgram {
  canUninstall: boolean
  displayName: string
  displayVersion?: string
  id: string
  installLocation?: string
  publisher?: string
  quietUninstallCommand?: string
  runtimeKey: RuntimeKey
  scope: VariableScope
  source: 'registry'
  uninstallCommand?: string
}

export interface RuntimeCatalogOption {
  channel: string
  downloadUrl: string
  label: string
  version: string
  installerType?: RuntimeInstallerType
  vendor?: JavaVendor
}

export interface InstalledManagedRuntime {
  id: string
  addedAt: string
  entryPoint: string
  installDir: string
  isActive: boolean
  linkTarget?: string
  vendor?: JavaVendor
  version: string
}

export interface JavaVendorSupport {
  key: JavaVendor
  label: string
  supportedVersions: string[]
}

export interface ManagedRuntimeInstallOptions {
  cleanupArchiveDefault: boolean
  javaVendors?: JavaVendorSupport[]
}

export interface ManagedRuntimeSummary {
  availableVersions: RuntimeCatalogOption[]
  description: string
  installOptions?: ManagedRuntimeInstallOptions
  installedVersions: InstalledManagedRuntime[]
  key: ManagedRuntimeKey
  label: string
  latestAvailable?: RuntimeCatalogOption
  sharedEntryPoint: string
  status: ManagedRuntimeStatus
}

export interface SystemToolSummary {
  category: 'container' | 'virtualization'
  description: string
  key: SystemToolKey
  label: string
  notes?: string
  status: SystemToolStatus
  version?: string
}

export interface DashboardData {
  productName: string
  generatedAt: string
  rootDir: string
  backupsDir: string
  system: SystemSummary
  runtimes: RuntimeSummary[]
  managedRuntimes: ManagedRuntimeSummary[]
  systemTools: SystemToolSummary[]
  installedPrograms: InstalledProgram[]
  operationLogs: OperationLogEntry[]
  variables: EnvVariableEntry[]
  pathIssues: PathIssue[]
  backupHistory: BackupRecord[]
}

export interface InstallRuntimeOptions {
  cleanupArchive?: boolean
  javaVendor?: JavaVendor
  version?: string
}

export interface DownloadProgress {
  bytesReceived: number
  contentLength: number
  percentage: number
  url: string
  detail?: string
  label?: string
  stage?:
    | 'preparing'
    | 'downloading'
    | 'extracting'
    | 'installing'
    | 'configuring'
    | 'finalizing'
    | 'completed'
}

export interface AppConfig {
  downloadCleanupEnabled: boolean
  language: 'zh-CN' | 'en-US'
  proxyEnabled: boolean
  proxyPassword?: string
  proxyPort?: number
  proxyServer?: string
  proxyUsername?: string
  storageRoot: string
  theme: 'light' | 'dark' | 'system'
}

export interface DiagnosticResult {
  category: string
  items: DiagnosticItem[]
}

export interface DiagnosticItem {
  message: string
  severity: 'info' | 'warning' | 'error'
  suggestion?: string
}

export interface ElectronApi {
  getDashboard: () => Promise<DashboardData>
  createBackup: () => Promise<BackupResult>
  previewCleanup: () => Promise<CleanupPreview>
  installRuntime: (
    runtime: ManagedRuntimeKey,
    options?: InstallRuntimeOptions,
  ) => Promise<OperationResult>
  switchRuntime: (runtime: ManagedRuntimeKey, runtimeId: string) => Promise<OperationResult>
  uninstallRuntime: (runtime: ManagedRuntimeKey, runtimeId: string) => Promise<OperationResult>
  uninstallProgram: (programId: string) => Promise<OperationResult>
  applyCleanup: () => Promise<OperationResult>
  installSystemTool: (tool: SystemToolKey) => Promise<OperationResult>
  uninstallSystemTool: (tool: SystemToolKey) => Promise<OperationResult>
  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => () => void
  getConfig: () => Promise<AppConfig>
  saveConfig: (config: Partial<AppConfig>) => Promise<OperationResult>
  getOperationLogs: (limit?: number) => Promise<OperationLogEntry[]>
  clearOperationLogs: () => Promise<OperationResult>
  getBackups: () => Promise<BackupRecord[]>
  deleteBackup: (filePath: string) => Promise<OperationResult>
  restoreBackup: (filePath: string) => Promise<OperationResult>
  runDiagnostics: () => Promise<DiagnosticResult[]>
  showNotification: (title: string, body: string) => void
  exportConfig: () => Promise<string>
  importConfig: (data: string) => Promise<OperationResult>
}
