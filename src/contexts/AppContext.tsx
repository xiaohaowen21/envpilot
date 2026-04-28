import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import type {
  AppConfig,
  BackupResult,
  CleanupPreview,
  DashboardData,
  DiagnosticResult,
  DownloadProgress,
  InstalledManagedRuntime,
  InstallRuntimeOptions,
  JavaVendor,
  ManagedRuntimeKey,
  OperationResult,
  RuntimeKey,
  SystemToolKey,
  SystemToolSummary,
} from '../../shared/contracts'
import {
  getInitialLocale,
  getWorkspaceCards,
  type Locale,
  type WorkspaceId,
  uiCopy,
} from '../ui-copy'

export interface ConfirmDialogState {
  actionLabel: string
  confirmLabel: string
  description: string
  execute: () => Promise<void>
  targetLabel: string
  title: string
}

const runtimeLabelMap: Record<RuntimeKey, string> = {
  cpp: 'C / C++',
  go: 'Go',
  java: 'Java',
  node: 'Node.js',
  php: 'PHP',
  python: 'Python',
  rust: 'Rust',
}

export interface RuntimeInventoryItem {
  commandRuntime: DashboardData['runtimes'][number] | undefined
  label: string
  managedRuntime: DashboardData['managedRuntimes'][number] | undefined
  programs: DashboardData['installedPrograms']
  runtimeKey: RuntimeKey
}

export interface Binding {
  name: string
  value: string
}

interface AppContextValue {
  // Data
  dashboard: DashboardData | null
  config: AppConfig | null
  cleanupPreview: CleanupPreview | null
  backupResult: BackupResult | null
  operationResult: OperationResult | null
  confirmDialog: ConfirmDialogState | null
  diagnostics: DiagnosticResult[] | null
  downloadProgress: DownloadProgress | null

  // UI State
  locale: Locale
  loading: boolean
  working: string | null
  activeWorkspace: WorkspaceId
  javaVendor: JavaVendor
  cleanupArchive: boolean
  searchQuery: string

  // Computed
  copy: (typeof uiCopy)[Locale]
  workspaceCards: ReturnType<typeof getWorkspaceCards>
  activeWorkspaceCard: ReturnType<typeof getWorkspaceCards>[number]
  runtimeInventory: RuntimeInventoryItem[]
  filteredRuntimeInventory: RuntimeInventoryItem[]
  issueSummary: Array<[string, number]>
  javaSummary: DashboardData['managedRuntimes'][number] | undefined
  javaVendors: { key: JavaVendor; label: string; supportedVersions: string[] }[]
  selectedJavaVendor: { key: JavaVendor; label: string; supportedVersions: string[] } | undefined
  supportedJavaVersions: Set<string>
  progressTitle: string
  progressDetail: string
  hasProgressBar: boolean

  // Helpers
  formatDateTime: (value: string) => string
  getRuntimeBindings: (runtime: ManagedRuntimeKey, activeVersion?: InstalledManagedRuntime) => Binding[]

  // Setters
  setLocale: (locale: Locale) => void
  setActiveWorkspace: (id: WorkspaceId) => void
  setJavaVendor: (vendor: JavaVendor) => void
  setCleanupArchive: (value: boolean) => void
  setSearchQuery: (query: string) => void
  setConfig: (config: AppConfig) => void
  setConfirmDialog: (dialog: ConfirmDialogState | null) => void
  setDiagnostics: (diagnostics: DiagnosticResult[] | null) => void

  // Actions
  refreshDashboard: () => Promise<void>
  runOperation: (key: string, action: () => Promise<void>) => Promise<void>
  commitResult: (result: OperationResult) => void
  commitError: (error: unknown) => void
  handleCreateBackup: () => Promise<void>
  handlePreviewCleanup: () => Promise<void>
  handleApplyCleanup: () => Promise<void>
  handleInstallRuntime: (runtime: ManagedRuntimeKey, options?: InstallRuntimeOptions) => Promise<void>
  handleSwitchRuntime: (runtime: ManagedRuntimeKey, runtimeId: string) => Promise<void>
  handleUninstallRuntime: (runtime: ManagedRuntimeKey, runtimeId: string) => Promise<void>
  handleUninstallProgram: (programId: string) => Promise<void>
  handleInstallTool: (tool: SystemToolKey) => Promise<void>
  handleUninstallTool: (tool: SystemToolKey) => Promise<void>
  handleSaveConfig: (updates: Partial<AppConfig>) => Promise<void>
  handleConfirmAction: () => Promise<void>
  requestUninstallProgram: (programId: string, displayName: string) => void
  requestUninstallRuntime: (runtime: ManagedRuntimeKey, runtimeLabel: string, runtimeId: string, version: string) => void
  requestUninstallTool: (tool: SystemToolSummary) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function useAppContext(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useAppContext must be used within AppContextProvider')
  }
  return context
}

export function AppContextProvider({ children }: { children: ReactNode }) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [config, setConfigState] = useState<AppConfig | null>(null)
  const [cleanupPreview, setCleanupPreview] = useState<CleanupPreview | null>(null)
  const [backupResult, setBackupResult] = useState<BackupResult | null>(null)
  const [operationResult, setOperationResult] = useState<OperationResult | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[] | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null)
  const [locale, setLocale] = useState<Locale>(getInitialLocale)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState<string | null>(null)
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId>('overview')
  const [javaVendor, setJavaVendor] = useState<JavaVendor>('temurin')
  const [cleanupArchive, setCleanupArchive] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const copy = uiCopy[locale]

  // --- Data Loading ---
  const refreshDashboard = useCallback(async () => {
    const data = await window.envPilot.getDashboard()
    setDashboard(data)
  }, [])

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true)
      try {
        const [dashboardData, configData] = await Promise.all([
          window.envPilot.getDashboard(),
          window.envPilot.getConfig(),
        ])
        setDashboard(dashboardData)
        setConfigState(configData)
        setCleanupArchive(configData.downloadCleanupEnabled)
        setLocale(configData.language)
      } finally {
        setLoading(false)
      }
    }
    void loadDashboard()
  }, [])

  // --- Locale Persistence ---
  useEffect(() => {
    window.localStorage.setItem('envpilot-locale', locale)
    document.documentElement.lang = locale
  }, [locale])

  // --- Theme ---
  useEffect(() => {
    if (!config) return
    const theme = config.theme

    const applyTheme = () => {
      if (theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
      } else {
        document.documentElement.setAttribute('data-theme', theme)
      }
    }

    applyTheme()

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => applyTheme()
      mediaQuery.addEventListener('change', handler)
      return () => mediaQuery.removeEventListener('change', handler)
    }
  }, [config])

  // --- Download Progress ---
  useEffect(() => {
    const unsubscribe = window.envPilot.onDownloadProgress((progress) => {
      setDownloadProgress(progress)
    })
    return unsubscribe
  }, [])

  // --- Sync cleanupArchive from config ---
  useEffect(() => {
    if (!config) return
    setCleanupArchive(config.downloadCleanupEnabled)
  }, [config])

  // --- Helpers ---
  const formatDateTime = useCallback(
    (value: string) => new Date(value).toLocaleString(locale),
    [locale],
  )

  const commitResult = useCallback((result: OperationResult) => {
    setOperationResult(result)
  }, [])

  const commitError = useCallback((error: unknown) => {
    setOperationResult({
      message: error instanceof Error ? error.message : String(error),
      ok: false,
    })
  }, [])

  const runOperation = useCallback(
    async (key: string, action: () => Promise<void>) => {
      setWorking(key)
      setDownloadProgress(null)
      try {
        await action()
      } catch (error) {
        commitError(error)
      } finally {
        setWorking(null)
        setDownloadProgress(null)
      }
    },
    [commitError],
  )

  // --- Handlers ---
  const handleCreateBackup = useCallback(async () => {
    await runOperation('backup', async () => {
      const result = await window.envPilot.createBackup()
      setBackupResult(result)
      await refreshDashboard()
    })
  }, [runOperation, refreshDashboard])

  const handlePreviewCleanup = useCallback(async () => {
    await runOperation('preview', async () => {
      const result = await window.envPilot.previewCleanup()
      setCleanupPreview(result)
    })
  }, [runOperation])

  const handleApplyCleanup = useCallback(async () => {
    await runOperation('cleanup-apply', async () => {
      const result = await window.envPilot.applyCleanup()
      commitResult(result)
      setCleanupPreview(await window.envPilot.previewCleanup())
      await refreshDashboard()
    })
  }, [runOperation, commitResult, refreshDashboard])

  const handleInstallRuntime = useCallback(
    async (runtime: ManagedRuntimeKey, options?: InstallRuntimeOptions) => {
      const workKey = `install-${runtime}-${options?.version ?? 'latest'}-${options?.javaVendor ?? 'default'}`
      await runOperation(workKey, async () => {
        const result = await window.envPilot.installRuntime(runtime, options)
        commitResult(result)
        await refreshDashboard()
      })
    },
    [runOperation, commitResult, refreshDashboard],
  )

  const handleSwitchRuntime = useCallback(
    async (runtime: ManagedRuntimeKey, runtimeId: string) => {
      await runOperation(`switch-${runtime}-${runtimeId}`, async () => {
        const result = await window.envPilot.switchRuntime(runtime, runtimeId)
        commitResult(result)
        await refreshDashboard()
      })
    },
    [runOperation, commitResult, refreshDashboard],
  )

  const handleUninstallRuntime = useCallback(
    async (runtime: ManagedRuntimeKey, runtimeId: string) => {
      await runOperation(`uninstall-${runtime}-${runtimeId}`, async () => {
        const result = await window.envPilot.uninstallRuntime(runtime, runtimeId)
        commitResult(result)
        await refreshDashboard()
      })
    },
    [runOperation, commitResult, refreshDashboard],
  )

  const handleUninstallProgram = useCallback(
    async (programId: string) => {
      await runOperation(`program-uninstall-${programId}`, async () => {
        const result = await window.envPilot.uninstallProgram(programId)
        commitResult(result)
        await refreshDashboard()
      })
    },
    [runOperation, commitResult, refreshDashboard],
  )

  const handleInstallTool = useCallback(
    async (tool: SystemToolKey) => {
      await runOperation(`tool-install-${tool}`, async () => {
        const result = await window.envPilot.installSystemTool(tool)
        commitResult(result)
        await refreshDashboard()
      })
    },
    [runOperation, commitResult, refreshDashboard],
  )

  const handleUninstallTool = useCallback(
    async (tool: SystemToolKey) => {
      await runOperation(`tool-uninstall-${tool}`, async () => {
        const result = await window.envPilot.uninstallSystemTool(tool)
        commitResult(result)
        await refreshDashboard()
      })
    },
    [runOperation, commitResult, refreshDashboard],
  )

  const handleSaveConfig = useCallback(
    async (updates: Partial<AppConfig>) => {
      await runOperation('save-config', async () => {
        const result = await window.envPilot.saveConfig(updates)
        commitResult(result)
        const newConfig = await window.envPilot.getConfig()
        setConfigState(newConfig)
        if (updates.language) {
          setLocale(updates.language)
        }
        await refreshDashboard()
      })
    },
    [runOperation, commitResult, refreshDashboard],
  )

  const handleConfirmAction = useCallback(async () => {
    if (!confirmDialog) return
    const action = confirmDialog.execute
    setConfirmDialog(null)
    await action()
  }, [confirmDialog])

  // --- Confirm Dialog Builders ---
  const requestUninstallProgram = useCallback(
    (programId: string, displayName: string) => {
      setConfirmDialog({
        actionLabel: copy.confirm.uninstallProgram.actionLabel,
        confirmLabel: copy.confirm.uninstallProgram.confirmLabel,
        description: copy.confirm.uninstallProgram.description,
        execute: () => handleUninstallProgram(programId),
        targetLabel: displayName,
        title: copy.confirm.uninstallProgram.title,
      })
    },
    [copy, handleUninstallProgram],
  )

  const requestUninstallRuntime = useCallback(
    (runtime: ManagedRuntimeKey, runtimeLabel: string, runtimeId: string, version: string) => {
      setConfirmDialog({
        actionLabel: copy.confirm.uninstallRuntime.actionLabel,
        confirmLabel: copy.confirm.uninstallRuntime.confirmLabel,
        description: copy.confirm.uninstallRuntime.description,
        execute: () => handleUninstallRuntime(runtime, runtimeId),
        targetLabel: `${runtimeLabel} ${version}`,
        title: copy.confirm.uninstallRuntime.title,
      })
    },
    [copy, handleUninstallRuntime],
  )

  const requestUninstallTool = useCallback(
    (tool: SystemToolSummary) => {
      if (tool.key === 'docker') {
        setConfirmDialog({
          actionLabel: copy.confirm.uninstallDocker.actionLabel,
          confirmLabel: copy.confirm.uninstallDocker.confirmLabel,
          description: copy.confirm.uninstallDocker.description,
          execute: () => handleUninstallTool(tool.key),
          targetLabel: tool.label,
          title: copy.confirm.uninstallDocker.title,
        })
        return
      }

      setConfirmDialog({
        actionLabel: copy.confirm.disableFeature.actionLabel,
        confirmLabel: copy.confirm.disableFeature.confirmLabel,
        description: copy.confirm.disableFeature.description,
        execute: () => handleUninstallTool(tool.key),
        targetLabel: tool.label,
        title: copy.confirm.disableFeature.title,
      })
    },
    [copy, handleUninstallTool],
  )

  // --- Computed Values ---
  const issueSummary = useMemo(() => {
    if (!dashboard) return []
    return Object.entries(
      dashboard.pathIssues.reduce<Record<string, number>>((accumulator, issue) => {
        accumulator[issue.type] = (accumulator[issue.type] ?? 0) + 1
        return accumulator
      }, {}),
    )
  }, [dashboard])

  const runtimeInventory = useMemo(() => {
    if (!dashboard) return []
    const managedMap = new Map(dashboard.managedRuntimes.map((item) => [item.key, item]))
    const commandMap = new Map(dashboard.runtimes.map((item) => [item.key, item]))
    const runtimeKeys: RuntimeKey[] = ['java', 'python', 'node', 'go', 'rust', 'php', 'cpp']
    return runtimeKeys
      .map((runtimeKey) => ({
        commandRuntime: commandMap.get(runtimeKey),
        label: runtimeLabelMap[runtimeKey],
        managedRuntime: runtimeKey === 'cpp' ? undefined : managedMap.get(runtimeKey as ManagedRuntimeKey),
        programs: dashboard.installedPrograms.filter((item) => item.runtimeKey === runtimeKey),
        runtimeKey,
      }))
      .filter(
        (item) =>
          item.programs.length > 0 ||
          item.commandRuntime?.detected ||
          Boolean(item.managedRuntime),
      )
  }, [dashboard])

  const filteredRuntimeInventory = useMemo(() => {
    if (!searchQuery) return runtimeInventory
    const query = searchQuery.toLowerCase()
    return runtimeInventory.filter((item) =>
      item.label.toLowerCase().includes(query) ||
      item.runtimeKey.toLowerCase().includes(query) ||
      item.programs.some((p) => p.displayName.toLowerCase().includes(query)),
    )
  }, [runtimeInventory, searchQuery])

  const workspaceCards = useMemo(() => {
    if (!dashboard) return []
    return getWorkspaceCards(dashboard, locale)
  }, [dashboard, locale])

  const activeWorkspaceCard =
    workspaceCards.find((item) => item.id === activeWorkspace) ?? workspaceCards[0]

  const javaSummary = dashboard?.managedRuntimes.find((runtime) => runtime.key === 'java')
  const _installOpts = javaSummary?.installOptions
  const javaVendors: { key: JavaVendor; label: string; supportedVersions: string[] }[] =
    (_installOpts && 'javaVendors' in _installOpts && Array.isArray(_installOpts.javaVendors)
      ? (_installOpts.javaVendors as unknown as { key: JavaVendor; label: string; supportedVersions: string[] }[])
      : [])
  const selectedJavaVendor = javaVendors.find((vendor) => vendor.key === javaVendor) ?? (javaVendors[0] ?? undefined)
  const supportedJavaVersions = new Set(selectedJavaVendor?.supportedVersions ?? [])

  const progressTitle =
    downloadProgress?.label ?? copy.progress.workingTitle
  const progressDetail =
    downloadProgress?.detail ?? copy.progress.workingDetail
  const hasProgressBar = Boolean(downloadProgress && downloadProgress.contentLength > 0)

  // Sync javaVendor with available vendors
  useEffect(() => {
    if (!selectedJavaVendor && javaVendors[0]) {
      setJavaVendor(javaVendors[0].key)
    }
  }, [javaVendors, selectedJavaVendor])

  // --- getRuntimeBindings ---
  const getRuntimeBindings = useCallback(
    (runtime: ManagedRuntimeKey, activeVersion?: InstalledManagedRuntime): Binding[] => {
      if (!dashboard || !activeVersion) return []

      const root = dashboard.rootDir

      if (runtime === 'java') {
        const linkRoot = `${root}\\links\\java`
        return [
          { name: 'JAVA_HOME', value: linkRoot },
          { name: 'JDK_HOME', value: linkRoot },
          { name: 'PATH', value: `${linkRoot}\\bin` },
        ]
      }

      if (runtime === 'node') {
        const linkRoot = `${root}\\links\\nodejs`
        return [
          { name: 'NODE_HOME', value: linkRoot },
          { name: 'PATH', value: linkRoot },
        ]
      }

      if (runtime === 'python') {
        const linkRoot = `${root}\\links\\python`
        return [
          { name: 'PYTHON_HOME', value: linkRoot },
          { name: 'PATH', value: linkRoot },
          { name: 'PATH', value: `${linkRoot}\\Scripts` },
        ]
      }

      if (runtime === 'go') {
        const linkRoot = `${root}\\links\\go`
        return [
          { name: 'GOROOT', value: linkRoot },
          { name: 'PATH', value: `${linkRoot}\\bin` },
        ]
      }

      if (runtime === 'php') {
        const linkRoot = `${root}\\links\\php`
        return [
          { name: 'PHP_HOME', value: linkRoot },
          { name: 'PATH', value: linkRoot },
        ]
      }

      return [
        { name: 'CARGO_HOME', value: `${activeVersion.installDir}\\cargo` },
        { name: 'RUSTUP_HOME', value: `${activeVersion.installDir}\\rustup` },
        { name: 'PATH', value: `${root}\\links\\rust` },
      ]
    },
    [dashboard],
  )

  // --- Config Setter ---
  const setConfig = useCallback((newConfig: AppConfig) => {
    setConfigState(newConfig)
  }, [])

  const value: AppContextValue = {
    // Data
    dashboard,
    config,
    cleanupPreview,
    backupResult,
    operationResult,
    confirmDialog,
    diagnostics,
    downloadProgress,

    // UI State
    locale,
    loading,
    working,
    activeWorkspace,
    javaVendor,
    cleanupArchive,
    searchQuery,

    // Computed
    copy,
    workspaceCards,
    activeWorkspaceCard,
    runtimeInventory,
    filteredRuntimeInventory,
    issueSummary,
    javaSummary,
    javaVendors,
    selectedJavaVendor,
    supportedJavaVersions,
    progressTitle,
    progressDetail,
    hasProgressBar,

    // Helpers
    formatDateTime,
    getRuntimeBindings,

    // Setters
    setLocale,
    setActiveWorkspace,
    setJavaVendor,
    setCleanupArchive,
    setSearchQuery,
    setConfig,
    setConfirmDialog,
    setDiagnostics,

    // Actions
    refreshDashboard,
    runOperation,
    commitResult,
    commitError,
    handleCreateBackup,
    handlePreviewCleanup,
    handleApplyCleanup,
    handleInstallRuntime,
    handleSwitchRuntime,
    handleUninstallRuntime,
    handleUninstallProgram,
    handleInstallTool,
    handleUninstallTool,
    handleSaveConfig,
    handleConfirmAction,
    requestUninstallProgram,
    requestUninstallRuntime,
    requestUninstallTool,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
