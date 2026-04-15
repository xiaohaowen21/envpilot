import { useEffect, useMemo, useState } from 'react'

import type {
  AppConfig,
  BackupResult,
  CleanupPreview,
  DashboardData,
  DiagnosticResult,
  DownloadProgress,
  InstallRuntimeOptions,
  JavaVendor,
  ManagedRuntimeKey,
  OperationResult,
  PathIssueType,
  RuntimeKey,
  SystemToolKey,
  SystemToolSummary,
} from '../shared/contracts'
import CollapsibleSection from './components/CollapsibleSection'
import {
  getInitialLocale,
  getToolDescription as getLocalizedToolDescription,
  getToolInstallLabel as getLocalizedToolInstallLabel,
  getToolNotes as getLocalizedToolNotes,
  getToolSourceLabel as getLocalizedToolSourceLabel,
  getToolStatusLabel as getLocalizedToolStatusLabel,
  getToolUninstallLabel as getLocalizedToolUninstallLabel,
  getWorkspaceCards,
  javaVendorLabel,
  type Locale,
  type WorkspaceId,
  uiCopy,
} from './ui-copy'
import './App.css'

interface ConfirmDialogState {
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

function App() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [cleanupPreview, setCleanupPreview] = useState<CleanupPreview | null>(null)
  const [backupResult, setBackupResult] = useState<BackupResult | null>(null)
  const [operationResult, setOperationResult] = useState<OperationResult | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const [locale, setLocale] = useState<Locale>(getInitialLocale)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState<string | null>(null)
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId>('overview')
  const [javaVendor, setJavaVendor] = useState<JavaVendor>('temurin')
  const [cleanupArchive, setCleanupArchive] = useState(true)
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[] | null>(null)
  const copy = uiCopy[locale]

  const refreshDashboard = async () => {
    const data = await window.envPilot.getDashboard()
    setDashboard(data)
  }

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true)
      try {
        const [dashboardData, configData] = await Promise.all([
          window.envPilot.getDashboard(),
          window.envPilot.getConfig(),
        ])
        setDashboard(dashboardData)
        setConfig(configData)
        setLocale(configData.language)
      } finally {
        setLoading(false)
      }
    }
    void loadDashboard()
  }, [])

  useEffect(() => {
    window.localStorage.setItem('envpilot-locale', locale)
    document.documentElement.lang = locale
  }, [locale])

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

  useEffect(() => {
    const unsubscribe = window.envPilot.onDownloadProgress((progress) => {
      setDownloadProgress(progress)
    })

    return unsubscribe
  }, [])

  const formatDateTime = (value: string) => new Date(value).toLocaleString(locale)

  const commitResult = (result: OperationResult) => {
    setOperationResult(result)
  }

  const commitError = (error: unknown) => {
    setOperationResult({
      message: error instanceof Error ? error.message : String(error),
      ok: false,
    })
  }

  const runOperation = async (key: string, action: () => Promise<void>) => {
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
  }

  const handleCreateBackup = async () => {
    await runOperation('backup', async () => {
      const result = await window.envPilot.createBackup()
      setBackupResult(result)
      await refreshDashboard()
    })
  }

  const handlePreviewCleanup = async () => {
    await runOperation('preview', async () => {
      const result = await window.envPilot.previewCleanup()
      setCleanupPreview(result)
    })
  }

  const handleApplyCleanup = async () => {
    await runOperation('cleanup-apply', async () => {
      const result = await window.envPilot.applyCleanup()
      commitResult(result)
      setCleanupPreview(await window.envPilot.previewCleanup())
      await refreshDashboard()
    })
  }

  const handleInstallRuntime = async (runtime: ManagedRuntimeKey, options?: InstallRuntimeOptions) => {
    const workKey = `install-${runtime}-${options?.version ?? 'latest'}-${options?.javaVendor ?? 'default'}`
    await runOperation(workKey, async () => {
      const result = await window.envPilot.installRuntime(runtime, options)
      commitResult(result)
      await refreshDashboard()
    })
  }

  const handleSwitchRuntime = async (runtime: ManagedRuntimeKey, runtimeId: string) => {
    await runOperation(`switch-${runtime}-${runtimeId}`, async () => {
      const result = await window.envPilot.switchRuntime(runtime, runtimeId)
      commitResult(result)
      await refreshDashboard()
    })
  }

  const handleUninstallRuntime = async (runtime: ManagedRuntimeKey, runtimeId: string) => {
    await runOperation(`uninstall-${runtime}-${runtimeId}`, async () => {
      const result = await window.envPilot.uninstallRuntime(runtime, runtimeId)
      commitResult(result)
      await refreshDashboard()
    })
  }

  const handleUninstallProgram = async (programId: string) => {
    await runOperation(`program-uninstall-${programId}`, async () => {
      const result = await window.envPilot.uninstallProgram(programId)
      commitResult(result)
      await refreshDashboard()
    })
  }

  const handleInstallTool = async (tool: SystemToolKey) => {
    await runOperation(`tool-install-${tool}`, async () => {
      const result = await window.envPilot.installSystemTool(tool)
      commitResult(result)
      await refreshDashboard()
    })
  }

  const handleUninstallTool = async (tool: SystemToolKey) => {
    await runOperation(`tool-uninstall-${tool}`, async () => {
      const result = await window.envPilot.uninstallSystemTool(tool)
      commitResult(result)
      await refreshDashboard()
    })
  }

  const handleSaveConfig = async (updates: Partial<AppConfig>) => {
    await runOperation('save-config', async () => {
      const result = await window.envPilot.saveConfig(updates)
      commitResult(result)
      const newConfig = await window.envPilot.getConfig()
      setConfig(newConfig)
      if (updates.language) {
        setLocale(updates.language)
      }
      await refreshDashboard()
    })
  }

  const requestUninstallProgram = (programId: string, displayName: string) => {
    setConfirmDialog({
      actionLabel: locale === 'zh-CN' ? '卸载软件' : 'Uninstall software',
      confirmLabel: locale === 'zh-CN' ? '确认卸载' : 'Confirm uninstall',
      description:
        locale === 'zh-CN'
          ? '这会调用 Windows 中登记的原始卸载程序，并按该软件自己的卸载流程执行。'
          : 'This runs the uninstall command registered in Windows and follows that software’s own removal flow.',
      execute: () => handleUninstallProgram(programId),
      targetLabel: displayName,
      title: locale === 'zh-CN' ? '确认卸载软件' : 'Confirm software removal',
    })
  }

  const requestUninstallRuntime = (
    runtime: ManagedRuntimeKey,
    runtimeLabel: string,
    runtimeId: string,
    version: string,
  ) => {
    setConfirmDialog({
      actionLabel: locale === 'zh-CN' ? '卸载托管版本' : 'Remove managed version',
      confirmLabel: locale === 'zh-CN' ? '确认卸载版本' : 'Confirm remove',
      description:
        locale === 'zh-CN'
          ? '这会删除 EnvPilot 托管目录中的该版本文件，并同步清理当前版本切换记录。'
          : 'This removes the selected runtime files from EnvPilot storage and updates the active-version mapping.',
      execute: () => handleUninstallRuntime(runtime, runtimeId),
      targetLabel: `${runtimeLabel} ${version}`,
      title: locale === 'zh-CN' ? '确认卸载托管版本' : 'Confirm managed version removal',
    })
  }

  const requestUninstallTool = (tool: SystemToolSummary) => {
    if (tool.key === 'docker') {
      setConfirmDialog({
        actionLabel: locale === 'zh-CN' ? '卸载 Docker Desktop' : 'Uninstall Docker Desktop',
        confirmLabel: locale === 'zh-CN' ? '确认卸载 Docker Desktop' : 'Confirm Docker removal',
        description:
          locale === 'zh-CN'
            ? '这会触发 Docker Desktop 自身的卸载流程，Windows 功能开关不会被一并移除。'
            : 'This triggers Docker Desktop’s own uninstall flow. Windows feature switches are managed separately.',
        execute: () => handleUninstallTool(tool.key),
        targetLabel: tool.label,
        title: locale === 'zh-CN' ? '确认卸载 Docker Desktop' : 'Confirm Docker Desktop removal',
      })
      return
    }

    setConfirmDialog({
      actionLabel: locale === 'zh-CN' ? '关闭系统功能' : 'Disable Windows feature',
      confirmLabel: locale === 'zh-CN' ? '确认关闭功能' : 'Confirm disable',
      description:
        locale === 'zh-CN'
          ? '这会关闭对应的 Windows 功能。执行后可能需要重启系统。'
          : 'This disables the selected Windows feature. A reboot may be required.',
      execute: () => handleUninstallTool(tool.key),
      targetLabel: tool.label,
      title: locale === 'zh-CN' ? '确认关闭系统功能' : 'Confirm Windows feature disable',
    })
  }

  const handleConfirmAction = async () => {
    if (!confirmDialog) {
      return
    }
    const action = confirmDialog.execute
    setConfirmDialog(null)
    await action()
  }

  const issueSummary = useMemo(() => {
    if (!dashboard) {
      return []
    }
    return Object.entries(
      dashboard.pathIssues.reduce<Record<string, number>>((accumulator, issue) => {
        accumulator[issue.type] = (accumulator[issue.type] ?? 0) + 1
        return accumulator
      }, {}),
    )
  }, [dashboard])

  const runtimeInventory = useMemo(() => {
    if (!dashboard) {
      return []
    }
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
      item.programs.some((p) => p.displayName.toLowerCase().includes(query))
    )
  }, [runtimeInventory, searchQuery])

  const workspaceCards = useMemo(() => {
    if (!dashboard) {
      return []
    }
    return getWorkspaceCards(dashboard, locale)
  }, [dashboard, locale])

  const activeWorkspaceCard =
    workspaceCards.find((item) => item.id === activeWorkspace) ?? workspaceCards[0]

  const javaSummary = dashboard?.managedRuntimes.find((runtime) => runtime.key === 'java')
  const javaVendors = useMemo(
    () => javaSummary?.installOptions?.javaVendors ?? [],
    [javaSummary],
  )
  const selectedJavaVendor = javaVendors.find((vendor) => vendor.key === javaVendor) ?? javaVendors[0]
  const supportedJavaVersions = new Set(selectedJavaVendor?.supportedVersions ?? [])

  useEffect(() => {
    if (!selectedJavaVendor && javaVendors[0]) {
      setJavaVendor(javaVendors[0].key)
    }
  }, [javaVendors, selectedJavaVendor])

  if (loading || !dashboard || !activeWorkspaceCard) {
    return (
      <main className="workspace-shell loading-shell">
        <section className="panel loading-panel">
          <h1>{copy.loadingTitle}</h1>
          <p>{copy.loadingCopy}</p>
        </section>
      </main>
    )
  }

  const renderOverviewWorkspace = () => (
    <>
      <section className="card-grid two-columns">
        <article className="panel">
          <div className="section-title">
            <h2>{copy.overview.systemBaseline}</h2>
            <span>{copy.overview.generatedAt(formatDateTime(dashboard.generatedAt))}</span>
          </div>
          <div className="stat-grid">
            <div className="stat-card">
              <span>{copy.overview.operatingSystem}</span>
              <strong>{dashboard.system.platform}</strong>
              <small>{dashboard.system.release}</small>
            </div>
            <div className="stat-card">
              <span>{copy.overview.architecture}</span>
              <strong>{dashboard.system.architecture}</strong>
              <small>{dashboard.system.shell}</small>
            </div>
            <div className="stat-card">
              <span>{copy.overview.permission}</span>
              <strong>{dashboard.system.isAdmin ? copy.overview.adminReady : copy.overview.adminMissing}</strong>
              <small>{copy.overview.adminHelp}</small>
            </div>
            <div className="stat-card">
              <span>{copy.overview.network}</span>
              <strong>{dashboard.system.hasNetwork ? copy.networkAccessible : copy.networkRestricted}</strong>
              <small>{copy.overview.networkHelp}</small>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="section-title">
            <h2>{copy.overview.backupAndDirectory}</h2>
            <span>{copy.overview.storageHint}</span>
          </div>
          <dl className="kv-list">
            <div>
              <dt>{copy.overview.rootDirectory}</dt>
              <dd>{dashboard.rootDir}</dd>
            </div>
            <div>
              <dt>{copy.overview.backupDirectory}</dt>
              <dd>{dashboard.backupsDir}</dd>
            </div>
            <div>
              <dt>{copy.overview.recentBackups}</dt>
              <dd>{dashboard.backupHistory.length}</dd>
            </div>
            <div>
              <dt>{copy.overview.environmentCount}</dt>
              <dd>{dashboard.variables.length}</dd>
            </div>
          </dl>
          {backupResult ? <p className="result-note success-note">{backupResult.message}</p> : null}
        </article>
      </section>

      <section className="panel">
        <div className="section-title">
          <h2>{copy.overview.recentLogs}</h2>
          <span>{copy.overview.recentLogsNote}</span>
        </div>
        <div className="history-list">
          {dashboard.operationLogs.length === 0 ? (
            <p className="empty-tip">{copy.overview.thereAreNoLogs}</p>
          ) : (
            dashboard.operationLogs.map((entry, index) => (
              <div className="history-item" key={`${entry.createdAt}-${index}`}>
                <strong>{formatDateTime(entry.createdAt)}</strong>
                <span className={entry.level === 'error' ? 'log-error' : 'log-info'}>
                  {entry.message}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  )

  const renderSoftwareWorkspace = () => (
    <>
      <section className="panel info-panel">
        <strong>{copy.workspace.software.title}</strong>
        <p>{copy.software.heroDescription}</p>
      </section>

      <section className="search-bar">
        <input
          type="text"
          placeholder={locale === 'zh-CN' ? '搜索软件名称、运行时或发布者...' : 'Search software name, runtime, or publisher...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        {searchQuery && (
          <button
            className="search-clear"
            onClick={() => setSearchQuery('')}
            type="button"
          >
            ×
          </button>
        )}
      </section>

      <section className="card-grid two-columns">
        {filteredRuntimeInventory.map((runtime) => (
          <article className="panel runtime-detail-card" key={runtime.runtimeKey}>
            <div className="runtime-card-head">
              <div>
                <h2>{runtime.label}</h2>
                <p className="panel-copy">{copy.software.registryCount(runtime.programs.length)}</p>
              </div>
              <div className="summary-pills">
                {runtime.managedRuntime ? (
                  <span className="summary-pill">
                    {copy.versions.managedCount(runtime.managedRuntime.installedVersions.length)}
                  </span>
                ) : null}
                <span className="summary-pill">
                  {runtime.commandRuntime?.detected
                    ? `${copy.commandLabel} ${runtime.commandRuntime.version ?? copy.shared.unknownVersion}`
                    : copy.noneDetected}
                </span>
              </div>
            </div>

            <CollapsibleSection
              badge={copy.shared.sourcePath}
              defaultOpen={Boolean(runtime.commandRuntime?.detected)}
              title={copy.software.commandDetected}
            >
              <p className="detail-line">
                {runtime.commandRuntime?.detected
                  ? `${runtime.commandRuntime.command} / ${runtime.commandRuntime.version ?? copy.shared.unknownVersion}`
                  : copy.notFoundInPath}
              </p>
            </CollapsibleSection>

            <CollapsibleSection
              badge={copy.shared.programSource}
              defaultOpen={runtime.programs.length > 0}
              title={copy.software.registrySection}
            >
              {runtime.programs.length === 0 ? (
                <p className="empty-tip">{copy.software.registryEmpty}</p>
              ) : (
                <div className="stack-list">
                  {runtime.programs.map((program) => (
                    <div className="stack-row" key={program.id}>
                      <div>
                        <strong>{program.displayName}</strong>
                        <small>
                          {program.displayVersion || copy.shared.unknownVersion}
                          {program.publisher ? ` · ${program.publisher}` : ''}
                        </small>
                        <span>{program.installLocation || '-'}</span>
                      </div>
                      <button
                        className="danger-button"
                        disabled={working !== null || !program.canUninstall}
                        onClick={() => requestUninstallProgram(program.id, program.displayName)}
                      >
                        {working === `program-uninstall-${program.id}`
                          ? copy.versions.uninstalling
                          : copy.software.uninstallSoftware}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CollapsibleSection>
          </article>
        ))}
      </section>
    </>
  )
  const renderVersionsWorkspace = () => (
    <>
      <section className="panel info-panel">
        <strong>{copy.versions.autoManagedLabel}</strong>
        <p>{copy.versions.autoManagedRuntimeFlow}</p>
        <p>{copy.versions.autoManagedRuntimeNote}</p>
        <div className="settings-row">
          <label className="toggle-card" htmlFor="cleanup-archive">
            <input
              checked={cleanupArchive}
              id="cleanup-archive"
              onChange={(event) => setCleanupArchive(event.target.checked)}
              type="checkbox"
            />
            <div>
              <strong>{copy.versions.cleanupArchive}</strong>
              <span>{copy.versions.cleanupArchiveHint}</span>
            </div>
          </label>
        </div>
      </section>

      <section className="card-grid two-columns">
        {dashboard.managedRuntimes.map((runtime) => {
          const relatedInventory = runtimeInventory.find((item) => item.runtimeKey === runtime.key)
          const availableVersions =
            runtime.key === 'java'
              ? runtime.availableVersions.filter((catalog) => supportedJavaVersions.has(catalog.version))
              : runtime.availableVersions

          return (
            <article className="panel version-runtime-card" key={runtime.key}>
              <div className="runtime-card-head">
                <div>
                  <h2>{runtime.label}</h2>
                  <p className="panel-copy">{runtime.description}</p>
                </div>
                <span className="summary-pill">
                  {copy.versions.managedCount(runtime.installedVersions.length)}
                </span>
              </div>

              {runtime.key === 'java' ? (
                <div className="vendor-toolbar">
                  <div className="vendor-toolbar-copy">
                    <strong>{copy.versions.selectedVendor}</strong>
                    <span>{copy.versions.vendorHint}</span>
                  </div>
                  <div className="vendor-switch">
                    {javaVendors.map((vendor) => (
                      <button
                        className={`vendor-button ${javaVendor === vendor.key ? 'active' : ''}`}
                        key={vendor.key}
                        onClick={() => setJavaVendor(vendor.key)}
                        type="button"
                      >
                        {javaVendorLabel[vendor.key][locale]}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <CollapsibleSection
                badge={runtime.sharedEntryPoint}
                defaultOpen={runtime.installedVersions.length > 0}
                title={copy.versions.sharedEntryPointTitle}
              >
                <p className="detail-line">{copy.versions.sharedEntryPointHint}</p>
                <code>{runtime.sharedEntryPoint}</code>
              </CollapsibleSection>

              <CollapsibleSection
                badge={`${copy.software.registryCount(relatedInventory?.programs.length ?? 0)} · ${
                  relatedInventory?.commandRuntime?.version ?? copy.noneDetected
                }`}
                defaultOpen
                title={copy.versions.detectedInstalls}
              >
                {relatedInventory?.programs.length ? (
                  <div className="mini-list">
                    {relatedInventory.programs.slice(0, 4).map((program) => (
                      <div className="mini-row" key={program.id}>
                        <strong>{program.displayName}</strong>
                        <small>{program.displayVersion || copy.shared.unknownVersion}</small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-tip">{copy.versions.noSystemRecord}</p>
                )}
              </CollapsibleSection>

              <CollapsibleSection
                badge={
                  runtime.key === 'java' && selectedJavaVendor
                    ? javaVendorLabel[selectedJavaVendor.key][locale]
                    : copy.shared.officialCatalog
                }
                title={copy.versions.versionCatalog}
              >
                <div className="stack-list compact-stack">
                  {availableVersions.map((catalog) => {
                    const workKey = `install-${runtime.key}-${catalog.version}-${runtime.key === 'java' ? javaVendor : 'default'}`
                    return (
                      <div className="stack-row" key={`${runtime.key}-${catalog.version}`}>
                        <div>
                          <strong>{catalog.version}</strong>
                          <small>{catalog.channel}</small>
                        </div>
                        <button
                          className="ghost-button"
                          disabled={working !== null}
                          onClick={() =>
                            handleInstallRuntime(runtime.key, {
                              cleanupArchive,
                              javaVendor: runtime.key === 'java' ? javaVendor : undefined,
                              version: catalog.version,
                            })
                          }
                        >
                          {working === workKey ? copy.versions.installing : copy.versions.install}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </CollapsibleSection>

              <CollapsibleSection
                badge={copy.shared.managedDirectory}
                defaultOpen={runtime.installedVersions.length > 0}
                title={copy.versions.managedVersions}
              >
                {runtime.installedVersions.length === 0 ? (
                  <p className="empty-tip">{copy.versions.managedEmpty}</p>
                ) : (
                  <div className="stack-list">
                    {runtime.installedVersions.map((version) => (
                      <div className="stack-row" key={version.id}>
                        <div className="version-detail">
                          <div className="version-title-line">
                            <strong>{version.version}</strong>
                            {version.vendor ? (
                              <span className="source-tag">{javaVendorLabel[version.vendor][locale]}</span>
                            ) : null}
                            {version.isActive ? (
                              <span className="status-chip status-success">{copy.shared.activeVersion}</span>
                            ) : null}
                          </div>
                          <small>
                            {version.isActive ? copy.shared.activeVersion : copy.versions.switchableVersion}
                          </small>
                          <span>{copy.shared.realDirectory}: {version.installDir}</span>
                          <span>{copy.shared.entryPoint}: {version.entryPoint}</span>
                        </div>
                        <div className="inline-actions">
                          <button
                            className="ghost-button"
                            disabled={working !== null || version.isActive}
                            onClick={() => handleSwitchRuntime(runtime.key, version.id)}
                          >
                            {working === `switch-${runtime.key}-${version.id}`
                              ? copy.versions.switching
                              : version.isActive
                                ? copy.shared.activeVersion
                                : copy.versions.switch}
                          </button>
                          <button
                            className="danger-button"
                            disabled={working !== null}
                            onClick={() =>
                              requestUninstallRuntime(runtime.key, runtime.label, version.id, version.version)
                            }
                          >
                            {working === `uninstall-${runtime.key}-${version.id}`
                              ? copy.versions.uninstalling
                              : copy.versions.uninstallVersion}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CollapsibleSection>
            </article>
          )
        })}
      </section>
    </>
  )

  const renderPlatformWorkspace = () => (
    <>
      <section className="panel info-panel">
        <strong>{copy.platform.infoTitle}</strong>
        <p>{copy.platform.heroDescription}</p>
        <p>{copy.operationHint}</p>
      </section>

      <section className="card-grid two-columns">
        {dashboard.systemTools.map((tool) => (
          <article className="panel tool-panel" key={tool.key}>
            <div className="section-title">
              <h2>{tool.label}</h2>
              <span
                className={`status-chip ${
                  tool.status === 'installed'
                    ? 'status-success'
                    : tool.status === 'partial'
                      ? 'status-warn'
                      : 'status-muted'
                }`}
              >
                {getLocalizedToolStatusLabel(tool, locale)}
              </span>
            </div>
            <p className="panel-copy">{getLocalizedToolDescription(tool, locale)}</p>
            <div className="detail-block">
              <div className="block-header">
                <strong>{copy.platform.currentState}</strong>
                <span className="source-tag">{getLocalizedToolSourceLabel(tool, locale)}</span>
              </div>
              <p className="detail-line">{getLocalizedToolNotes(tool, locale)}</p>
              <p className="detail-line">
                {tool.version
                  ? `${locale === 'zh-CN' ? '版本' : 'Version'}: ${tool.version}`
                  : tool.key === 'docker'
                    ? copy.platform.dockerVersionUnknown
                    : copy.platform.featureVersionUnknown}
              </p>
            </div>
            <div className="inline-actions">
              <button
                disabled={working !== null || tool.status === 'installed'}
                onClick={() => handleInstallTool(tool.key)}
              >
                {working === `tool-install-${tool.key}`
                  ? copy.platform.processing
                  : getLocalizedToolInstallLabel(tool, locale)}
              </button>
              <button
                className="danger-button"
                disabled={working !== null || tool.status === 'not_installed'}
                onClick={() => requestUninstallTool(tool)}
              >
                {working === `tool-uninstall-${tool.key}`
                  ? copy.platform.processing
                  : getLocalizedToolUninstallLabel(tool, locale)}
              </button>
            </div>
          </article>
        ))}
      </section>
    </>
  )

  const renderVariablesWorkspace = () => (
    <>
      <section className="panel info-panel">
        <strong>{copy.workspace.variables.title}</strong>
        <p>{copy.variables.heroDescription}</p>
      </section>

      <section className="card-grid two-columns">
        <article className="panel">
          <div className="section-title">
            <h2>{copy.variables.pathScan}</h2>
            <span>{copy.variables.pendingCount(dashboard.pathIssues.length)}</span>
          </div>
          <div className="issue-summary">
            {issueSummary.length === 0 ? (
              <span className="success-badge">{copy.variables.noIssues}</span>
            ) : (
              issueSummary.map(([type, count]) => (
                <span className="issue-chip" key={type}>
                  {copy.issueTypeMap[type as PathIssueType]} {count}
                </span>
              ))
            )}
          </div>
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>{copy.variables.scope}</th>
                  <th>{copy.variables.pathIssue}</th>
                  <th>{copy.variables.pathEntry}</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.pathIssues.slice(0, 12).map((issue) => (
                  <tr key={issue.id}>
                    <td>{issue.scope}</td>
                    <td>{copy.issueTypeMap[issue.type]}</td>
                    <td>{issue.entry || '(empty)'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel">
          <div className="section-title">
            <h2>{copy.variables.cleanupPreview}</h2>
            <span>{copy.variables.cleanupPreviewNote}</span>
          </div>

          <div className="action-row">
            <button className="ghost-button" disabled={working !== null} onClick={handlePreviewCleanup}>
              {working === 'preview' ? copy.previewWorking : copy.variables.rebuildPreview}
            </button>
            <button disabled={working !== null} onClick={handleApplyCleanup}>
              {working === 'cleanup-apply' ? copy.autoCleanupWorking : copy.variables.autoCleanup}
            </button>
          </div>

          {cleanupPreview ? (
            <>
              <div className="stat-grid compact-grid">
                <div className="stat-card">
                  <span>{copy.variables.removableSuggestion}</span>
                  <strong>{cleanupPreview.removableCount}</strong>
                </div>
                <div className="stat-card">
                  <span>{locale === 'zh-CN' ? '建议修复' : 'Suggested fixes'}</span>
                  <strong>{cleanupPreview.fixableCount}</strong>
                </div>
              </div>
              <div className="history-list">
                {cleanupPreview.operations.slice(0, 10).map((operation, index) => (
                  <div className="history-item" key={`${operation.type}-${index}`}>
                    <strong>
                      {operation.scope} / {copy.issueTypeMap[operation.type]}
                    </strong>
                    <span>{operation.target}</span>
                    <small>{operation.reason}</small>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="empty-tip">{copy.variables.noCleanupPreview}</p>
          )}
        </article>
      </section>

      <section className="panel">
        <div className="section-title">
          <h2>{copy.variables.backupBaseline}</h2>
          <span>{copy.variables.backupBaselineNote}</span>
        </div>
        <div className="history-list">
          {dashboard.backupHistory.length === 0 ? (
            <p className="empty-tip">{copy.variables.backupMissing}</p>
          ) : (
            dashboard.backupHistory.map((record) => (
              <div className="history-item" key={record.filePath}>
                <strong>{formatDateTime(record.createdAt)}</strong>
                <span>{record.filePath}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  )

  const renderSettingsWorkspace = () => {
    if (!config) return null

    return (
      <>
        <section className="panel info-panel">
          <strong>{copy.workspace.settings.title}</strong>
          <p>{copy.workspace.settings.description}</p>
        </section>

        <section className="card-grid two-columns">
          <article className="panel">
            <div className="section-title">
              <h2>{locale === 'zh-CN' ? '存储设置' : 'Storage Settings'}</h2>
            </div>
            <div className="settings-form">
              <div className="form-field">
                <label htmlFor="storage-root">
                  {locale === 'zh-CN' ? '工作目录' : 'Working Directory'}
                </label>
                <input
                  id="storage-root"
                  type="text"
                  value={config.storageRoot}
                  onChange={(e) => setConfig({ ...config, storageRoot: e.target.value })}
                  placeholder={locale === 'zh-CN' ? '留空使用默认路径' : 'Leave empty for default path'}
                />
                <small>
                  {locale === 'zh-CN'
                    ? 'EnvPilot 将在此目录下存储运行时、下载缓存和备份文件。'
                    : 'EnvPilot stores runtimes, downloads, and backups in this directory.'}
                </small>
              </div>
              <div className="form-field">
                <label className="toggle-card" htmlFor="cleanup-archive-config">
                  <input
                    checked={config.downloadCleanupEnabled}
                    id="cleanup-archive-config"
                    onChange={(e) => setConfig({ ...config, downloadCleanupEnabled: e.target.checked })}
                    type="checkbox"
                  />
                  <div>
                    <strong>
                      {locale === 'zh-CN' ? '安装后清理下载缓存' : 'Clean download cache after install'}
                    </strong>
                    <span>
                      {locale === 'zh-CN'
                        ? '避免 D:\\EnvPilot\\downloads 留下过多 zip / exe 缓存。'
                        : 'Prevents D:\\EnvPilot\\downloads from accumulating too many zip/exe files.'}
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </article>

          <article className="panel">
            <div className="section-title">
              <h2>{locale === 'zh-CN' ? '代理设置' : 'Proxy Settings'}</h2>
            </div>
            <div className="settings-form">
              <div className="form-field">
                <label className="toggle-card" htmlFor="proxy-enabled">
                  <input
                    checked={config.proxyEnabled}
                    id="proxy-enabled"
                    onChange={(e) => setConfig({ ...config, proxyEnabled: e.target.checked })}
                    type="checkbox"
                  />
                  <div>
                    <strong>
                      {locale === 'zh-CN' ? '启用代理' : 'Enable Proxy'}
                    </strong>
                    <span>
                      {locale === 'zh-CN'
                        ? '通过代理服务器下载安装包。'
                        : 'Download packages through a proxy server.'}
                    </span>
                  </div>
                </label>
              </div>
              {config.proxyEnabled && (
                <>
                  <div className="form-field">
                    <label htmlFor="proxy-server">
                      {locale === 'zh-CN' ? '代理服务器' : 'Proxy Server'}
                    </label>
                    <input
                      id="proxy-server"
                      type="text"
                      value={config.proxyServer || ''}
                      onChange={(e) => setConfig({ ...config, proxyServer: e.target.value })}
                      placeholder="http://proxy.example.com:8080"
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="proxy-username">
                      {locale === 'zh-CN' ? '用户名' : 'Username'}
                    </label>
                    <input
                      id="proxy-username"
                      type="text"
                      value={config.proxyUsername || ''}
                      onChange={(e) => setConfig({ ...config, proxyUsername: e.target.value })}
                      placeholder={locale === 'zh-CN' ? '可选' : 'Optional'}
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="proxy-password">
                      {locale === 'zh-CN' ? '密码' : 'Password'}
                    </label>
                    <input
                      id="proxy-password"
                      type="password"
                      value={config.proxyPassword || ''}
                      onChange={(e) => setConfig({ ...config, proxyPassword: e.target.value })}
                      placeholder={locale === 'zh-CN' ? '可选' : 'Optional'}
                    />
                  </div>
                </>
              )}
            </div>
          </article>

          <article className="panel">
            <div className="section-title">
              <h2>{locale === 'zh-CN' ? '外观设置' : 'Appearance'}</h2>
            </div>
            <div className="settings-form">
              <div className="form-field">
                <label>{locale === 'zh-CN' ? '主题' : 'Theme'}</label>
                <div className="theme-switch">
                  {(['light', 'dark', 'system'] as const).map((theme) => (
                    <button
                      className={`theme-button ${config.theme === theme ? 'active' : ''}`}
                      key={theme}
                      onClick={() => setConfig({ ...config, theme })}
                      type="button"
                    >
                      {theme === 'light'
                        ? locale === 'zh-CN'
                          ? '浅色'
                          : 'Light'
                        : theme === 'dark'
                          ? locale === 'zh-CN'
                            ? '深色'
                            : 'Dark'
                          : locale === 'zh-CN'
                            ? '跟随系统'
                            : 'System'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-field">
                <label>{locale === 'zh-CN' ? '语言' : 'Language'}</label>
                <div className="theme-switch">
                  <button
                    className={`theme-button ${config.language === 'zh-CN' ? 'active' : ''}`}
                    onClick={() => setConfig({ ...config, language: 'zh-CN' })}
                    type="button"
                  >
                    中文
                  </button>
                  <button
                    className={`theme-button ${config.language === 'en-US' ? 'active' : ''}`}
                    onClick={() => setConfig({ ...config, language: 'en-US' })}
                    type="button"
                  >
                    English
                  </button>
                </div>
              </div>
            </div>
          </article>

          <article className="panel">
            <div className="section-title">
              <h2>{locale === 'zh-CN' ? '关于' : 'About'}</h2>
            </div>
            <div className="about-info">
              <div className="about-item">
                <span>{locale === 'zh-CN' ? '版本' : 'Version'}</span>
                <strong>0.1.0</strong>
              </div>
              <div className="about-item">
                <span>{locale === 'zh-CN' ? '描述' : 'Description'}</span>
                <strong>{locale === 'zh-CN' ? 'Windows 环境自动化配置工具' : 'Windows environment automation tool'}</strong>
              </div>
            </div>
          </article>

          <article className="panel">
            <div className="section-title">
              <h2>{locale === 'zh-CN' ? '配置导入/导出' : 'Config Import/Export'}</h2>
            </div>
            <div className="config-import-export">
              <p className="config-description">
                {locale === 'zh-CN'
                  ? '导出当前配置到文件，或从文件导入配置。'
                  : 'Export current config to file, or import config from file.'}
              </p>
              <div className="config-actions">
                <button
                  className="ghost-button"
                  disabled={working !== null}
                  onClick={async () => {
                    await runOperation('export-config', async () => {
                      const data = await window.envPilot.exportConfig()
                      const blob = new Blob([data], { type: 'application/json' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = 'envpilot-config.json'
                      a.click()
                      URL.revokeObjectURL(url)
                      commitResult({ ok: true, message: locale === 'zh-CN' ? '配置已导出' : 'Config exported' })
                    })
                  }}
                >
                  {working === 'export-config'
                    ? locale === 'zh-CN'
                      ? '导出中...'
                      : 'Exporting...'
                    : locale === 'zh-CN'
                      ? '导出配置'
                      : 'Export Config'}
                </button>
                <label className="import-button">
                  <input
                    type="file"
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return

                      await runOperation('import-config', async () => {
                        const data = await file.text()
                        const result = await window.envPilot.importConfig(data)
                        commitResult(result)
                        if (result.ok) {
                          const newConfig = await window.envPilot.getConfig()
                          setConfig(newConfig)
                          if (newConfig.language) {
                            setLocale(newConfig.language)
                          }
                        }
                      })

                      e.target.value = ''
                    }}
                  />
                  <button
                    className="ghost-button"
                    disabled={working !== null}
                    type="button"
                    onClick={(e) => {
                      const input = e.currentTarget.parentElement?.querySelector('input')
                      input?.click()
                    }}
                  >
                    {working === 'import-config'
                      ? locale === 'zh-CN'
                        ? '导入中...'
                        : 'Importing...'
                      : locale === 'zh-CN'
                        ? '导入配置'
                        : 'Import Config'}
                  </button>
                </label>
              </div>
            </div>
          </article>

          <article className="panel">
            <div className="section-title">
              <h2>{locale === 'zh-CN' ? '操作日志' : 'Operation Logs'}</h2>
              <button
                className="ghost-button"
                disabled={working !== null}
                onClick={async () => {
                  await runOperation('clear-logs', async () => {
                    const result = await window.envPilot.clearOperationLogs()
                    commitResult(result)
                    await refreshDashboard()
                  })
                }}
              >
                {working === 'clear-logs'
                  ? locale === 'zh-CN'
                    ? '清除中...'
                    : 'Clearing...'
                  : locale === 'zh-CN'
                    ? '清除日志'
                    : 'Clear Logs'}
              </button>
            </div>
            <div className="log-viewer">
              {dashboard.operationLogs.length === 0 ? (
                <p className="empty-tip">{locale === 'zh-CN' ? '暂无操作日志' : 'No operation logs'}</p>
              ) : (
                <div className="log-list">
                  {dashboard.operationLogs.slice(0, 20).map((entry, index) => (
                    <div className={`log-entry ${entry.level}`} key={`${entry.createdAt}-${index}`}>
                      <div className="log-time">{formatDateTime(entry.createdAt)}</div>
                      <div className="log-message">{entry.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </article>

          <article className="panel">
            <div className="section-title">
              <h2>{locale === 'zh-CN' ? '备份管理' : 'Backup Management'}</h2>
            </div>
            <div className="backup-manager">
              {dashboard.backupHistory.length === 0 ? (
                <p className="empty-tip">{locale === 'zh-CN' ? '暂无备份记录' : 'No backup records'}</p>
              ) : (
                <div className="backup-list">
                  {dashboard.backupHistory.map((record) => (
                    <div className="backup-item" key={record.filePath}>
                      <div className="backup-info">
                        <div className="backup-time">{formatDateTime(record.createdAt)}</div>
                        <div className="backup-path">{record.filePath}</div>
                        <div className="backup-meta">
                          {locale === 'zh-CN' ? '范围数' : 'Scopes'}: {record.scopeCount}
                        </div>
                      </div>
                      <div className="backup-actions">
                        <button
                          className="ghost-button"
                          disabled={working !== null}
                          onClick={async () => {
                            setConfirmDialog({
                              actionLabel: locale === 'zh-CN' ? '恢复备份' : 'Restore backup',
                              confirmLabel: locale === 'zh-CN' ? '确认恢复' : 'Confirm restore',
                              description:
                                locale === 'zh-CN'
                                  ? '这会将环境变量恢复到该备份时的状态。'
                                  : 'This will restore environment variables to the state at the time of the backup.',
                              execute: async () => {
                                await runOperation(`restore-${record.filePath}`, async () => {
                                  const result = await window.envPilot.restoreBackup(record.filePath)
                                  commitResult(result)
                                  await refreshDashboard()
                                })
                              },
                              targetLabel: formatDateTime(record.createdAt),
                              title: locale === 'zh-CN' ? '确认恢复备份' : 'Confirm backup restore',
                            })
                          }}
                        >
                          {locale === 'zh-CN' ? '恢复' : 'Restore'}
                        </button>
                        <button
                          className="danger-button"
                          disabled={working !== null}
                          onClick={async () => {
                            setConfirmDialog({
                              actionLabel: locale === 'zh-CN' ? '删除备份' : 'Delete backup',
                              confirmLabel: locale === 'zh-CN' ? '确认删除' : 'Confirm delete',
                              description:
                                locale === 'zh-CN'
                                  ? '这会永久删除该备份文件。'
                                  : 'This will permanently delete the backup file.',
                              execute: async () => {
                                await runOperation(`delete-${record.filePath}`, async () => {
                                  const result = await window.envPilot.deleteBackup(record.filePath)
                                  commitResult(result)
                                  await refreshDashboard()
                                })
                              },
                              targetLabel: formatDateTime(record.createdAt),
                              title: locale === 'zh-CN' ? '确认删除备份' : 'Confirm backup delete',
                            })
                          }}
                        >
                          {locale === 'zh-CN' ? '删除' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </article>

          <article className="panel">
            <div className="section-title">
              <h2>{locale === 'zh-CN' ? '环境诊断' : 'Environment Diagnostics'}</h2>
              <button
                className="ghost-button"
                disabled={working !== null}
                onClick={async () => {
                  await runOperation('run-diagnostics', async () => {
                    const result = await window.envPilot.runDiagnostics()
                    setDiagnostics(result)
                  })
                }}
              >
                {working === 'run-diagnostics'
                  ? locale === 'zh-CN'
                    ? '诊断中...'
                    : 'Diagnosing...'
                  : locale === 'zh-CN'
                    ? '运行诊断'
                    : 'Run Diagnostics'}
              </button>
            </div>
            <div className="diagnostics-viewer">
              {!diagnostics ? (
                <p className="empty-tip">
                  {locale === 'zh-CN'
                    ? '点击"运行诊断"检查系统环境状态'
                    : 'Click "Run Diagnostics" to check system environment status'}
                </p>
              ) : (
                <div className="diagnostics-list">
                  {diagnostics.map((category) => (
                    <div className="diagnostic-category" key={category.category}>
                      <h3>
                        {category.category === 'system'
                          ? locale === 'zh-CN' ? '系统信息' : 'System Info'
                          : category.category === 'storage'
                            ? locale === 'zh-CN' ? '存储路径' : 'Storage Paths'
                            : category.category === 'environment'
                              ? locale === 'zh-CN' ? '环境变量' : 'Environment Variables'
                              : category.category === 'runtimes'
                                ? locale === 'zh-CN' ? '运行时检测' : 'Runtime Detection'
                                : locale === 'zh-CN' ? '网络连接' : 'Network'}
                      </h3>
                      <div className="diagnostic-items">
                        {category.items.map((item, index) => (
                          <div className={`diagnostic-item ${item.severity}`} key={index}>
                            <div className="diagnostic-icon">
                              {item.severity === 'error' ? '✕' : item.severity === 'warning' ? '⚠' : 'ℹ'}
                            </div>
                            <div className="diagnostic-content">
                              <div className="diagnostic-message">{item.message}</div>
                              {item.suggestion && (
                                <div className="diagnostic-suggestion">{item.suggestion}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </article>
        </section>

        <div className="settings-actions">
          <button
            disabled={working !== null}
            onClick={() => handleSaveConfig(config)}
          >
            {working === 'save-config'
              ? locale === 'zh-CN'
                ? '保存中...'
                : 'Saving...'
              : locale === 'zh-CN'
                ? '保存设置'
                : 'Save Settings'}
          </button>
        </div>
      </>
    )
  }

  return (
    <main className="workspace-shell">
      <aside className="workspace-sidebar">
        <div className="sidebar-brand">
          <p className="eyebrow">{copy.localeBadge}</p>
          <h1>EnvPilot</h1>
          <span>{copy.sidebar.appSubtitle}</span>
        </div>

        <div className="workspace-list">
          {[copy.sidebar.coreGroup, copy.sidebar.governanceGroup].map((groupTitle, index) => {
            const targetIds = index === 0 ? ['overview', 'software', 'versions', 'platform'] : ['variables', 'settings']
            return (
              <section className="sidebar-group" key={groupTitle}>
                <div className="sidebar-group-label">{groupTitle}</div>
                <div className="sidebar-card-list">
                  {workspaceCards
                    .filter((workspace) => targetIds.includes(workspace.id))
                    .map((workspace) => (
                      <button
                        className={`workspace-card ${activeWorkspace === workspace.id ? 'active' : ''}`}
                        key={workspace.id}
                        onClick={() => setActiveWorkspace(workspace.id)}
                        type="button"
                      >
                        <strong>{workspace.title}</strong>
                        <p>{workspace.description}</p>
                        <div className="workspace-card-footer">
                          <span>{workspace.metric}</span>
                        </div>
                      </button>
                    ))}
                </div>
              </section>
            )
          })}
        </div>

        <div className="sidebar-footer">
          <span>{copy.language.label}</span>
          <div className="locale-switch">
            <button
              className={`locale-button ${locale === 'zh-CN' ? 'active' : ''}`}
              onClick={() => setLocale('zh-CN')}
              type="button"
            >
              {copy.language.zh}
            </button>
            <button
              className={`locale-button ${locale === 'en-US' ? 'active' : ''}`}
              onClick={() => setLocale('en-US')}
              type="button"
            >
              {copy.language.en}
            </button>
          </div>
        </div>
      </aside>

      <section className="workspace-main">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">{copy.currentWorkspace}</p>
            <h1>{activeWorkspaceCard.title}</h1>
            <p className="header-copy">{activeWorkspaceCard.description}</p>
          </div>

          <div className="header-actions">
            <button disabled={working !== null} onClick={handleCreateBackup}>
              {working === 'backup' ? copy.backupWorking : copy.backupNow}
            </button>
            <button className="ghost-button" disabled={working !== null} onClick={handlePreviewCleanup}>
              {working === 'preview' ? copy.previewWorking : copy.previewCleanup}
            </button>
            <button className="ghost-button" disabled={working !== null} onClick={handleApplyCleanup}>
              {working === 'cleanup-apply' ? copy.autoCleanupWorking : copy.autoCleanup}
            </button>
          </div>
        </header>

        {operationResult?.message ? (
          <section className={`panel banner ${operationResult.ok ? 'banner-success' : 'banner-error'}`}>
            {operationResult.message}
          </section>
        ) : null}

        {downloadProgress && working ? (
          <section className="panel download-progress-panel">
            <div className="progress-header">
              <strong>{locale === 'zh-CN' ? '下载进度' : 'Download Progress'}</strong>
              <span>{downloadProgress.percentage}%</span>
            </div>
            <div className="progress-bar-container">
              <div
                className="progress-bar"
                style={{ width: `${downloadProgress.percentage}%` }}
              />
            </div>
            <div className="progress-details">
              <span>
                {(downloadProgress.bytesReceived / 1024 / 1024).toFixed(1)} MB /{' '}
                {(downloadProgress.contentLength / 1024 / 1024).toFixed(1)} MB
              </span>
            </div>
          </section>
        ) : null}

        {activeWorkspace === 'overview' ? renderOverviewWorkspace() : null}
        {activeWorkspace === 'software' ? renderSoftwareWorkspace() : null}
        {activeWorkspace === 'versions' ? renderVersionsWorkspace() : null}
        {activeWorkspace === 'platform' ? renderPlatformWorkspace() : null}
        {activeWorkspace === 'variables' ? renderVariablesWorkspace() : null}
        {activeWorkspace === 'settings' ? renderSettingsWorkspace() : null}
      </section>

      {confirmDialog ? (
        <div className="confirm-backdrop" role="presentation">
          <section
            aria-labelledby="confirm-dialog-title"
            aria-modal="true"
            className="confirm-dialog"
            role="dialog"
          >
            <p className="eyebrow">{copy.confirmAgain}</p>
            <h2 id="confirm-dialog-title">{confirmDialog.title}</h2>
            <div className="confirm-grid">
              <div className="confirm-field">
                <span>{locale === 'zh-CN' ? '操作类型' : 'Action type'}</span>
                <strong>{confirmDialog.actionLabel}</strong>
              </div>
              <div className="confirm-field">
                <span>{locale === 'zh-CN' ? '目标对象' : 'Target'}</span>
                <strong>{confirmDialog.targetLabel}</strong>
              </div>
            </div>
            <p className="confirm-copy">{confirmDialog.description}</p>
            <div className="confirm-actions">
              <button
                className="ghost-button"
                disabled={working !== null}
                onClick={() => setConfirmDialog(null)}
                type="button"
              >
                {copy.close}
              </button>
              <button
                className="modal-danger-button"
                disabled={working !== null}
                onClick={() => void handleConfirmAction()}
                type="button"
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}

export default App
