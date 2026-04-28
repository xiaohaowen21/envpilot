import { useAppContext } from '../hooks/useAppContext'

export default function SettingsWorkspace() {
  const {
    dashboard,
    config,
    copy,
    working,
    diagnostics,
    setConfig,
    handleSaveConfig,
    runOperation,
    commitResult,
    refreshDashboard,
    setConfirmDialog,
    setDiagnostics,
    formatDateTime,
  } = useAppContext()

  if (!config || !dashboard) return null

  const s = copy.settings // shorthand for settings copy

  return (
    <>
      <section className="panel info-panel">
        <strong>{copy.workspace.settings.title}</strong>
        <p>{copy.workspace.settings.description}</p>
      </section>

      <section className="card-grid two-columns">
        {/* Storage Settings */}
        <article className="panel">
          <div className="section-title">
            <h2>{s.storageTitle}</h2>
          </div>
          <div className="settings-form">
            <div className="form-field">
              <label htmlFor="storage-root">
                {s.workingDirectoryLabel}
              </label>
              <input
                id="storage-root"
                type="text"
                value={config.storageRoot}
                onChange={(e) => setConfig({ ...config, storageRoot: e.target.value })}
                placeholder={s.workingDirectoryPlaceholder}
              />
              <small>{s.workingDirectoryHint}</small>
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
                  <strong>{s.cleanupArchiveLabel}</strong>
                  <span>{s.cleanupArchiveHint}</span>
                </div>
              </label>
            </div>
          </div>
        </article>

        {/* Proxy Settings */}
        <article className="panel">
          <div className="section-title">
            <h2>{s.proxyTitle}</h2>
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
                  <strong>{s.proxyEnabledLabel}</strong>
                  <span>{s.proxyEnabledHint}</span>
                </div>
              </label>
            </div>
            {config.proxyEnabled && (
              <>
                <div className="form-field">
                  <label htmlFor="proxy-server">{s.proxyServerLabel}</label>
                  <input
                    id="proxy-server"
                    type="text"
                    value={config.proxyServer || ''}
                    onChange={(e) => setConfig({ ...config, proxyServer: e.target.value })}
                    placeholder="http://proxy.example.com:8080"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="proxy-username">{s.usernameLabel}</label>
                  <input
                    id="proxy-username"
                    type="text"
                    value={config.proxyUsername || ''}
                    onChange={(e) => setConfig({ ...config, proxyUsername: e.target.value })}
                    placeholder={s.usernamePlaceholder}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="proxy-password">{s.passwordLabel}</label>
                  <input
                    id="proxy-password"
                    type="password"
                    value={config.proxyPassword || ''}
                    onChange={(e) => setConfig({ ...config, proxyPassword: e.target.value })}
                    placeholder={s.passwordPlaceholder}
                  />
                </div>
              </>
            )}
          </div>
        </article>

        {/* Appearance */}
        <article className="panel">
          <div className="section-title">
            <h2>{s.appearanceTitle}</h2>
          </div>
          <div className="settings-form">
            <div className="form-field">
              <label>{s.themeLabel}</label>
              <div className="theme-switch">
                {(['light', 'dark', 'system'] as const).map((theme) => (
                  <button
                    className={`theme-button ${config.theme === theme ? 'active' : ''}`}
                    key={theme}
                    onClick={() => setConfig({ ...config, theme })}
                    type="button"
                  >
                    {
                      theme === 'light'
                        ? s.themeLight
                        : theme === 'dark'
                          ? s.themeDark
                          : s.themeSystem
                    }
                  </button>
                ))}
              </div>
            </div>
            <div className="form-field">
              <label>{s.languageLabel}</label>
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

        {/* About */}
        <article className="panel">
          <div className="section-title">
            <h2>{s.aboutTitle}</h2>
          </div>
          <div className="about-info">
            <div className="about-item">
              <span>{s.aboutVersion}</span>
              <strong>0.1.0</strong>
            </div>
            <div className="about-item">
              <span>{s.aboutDescription}</span>
              <strong>{s.aboutDescription}</strong>
            </div>
          </div>
        </article>

        {/* Config Import/Export */}
        <article className="panel">
          <div className="section-title">
            <h2>{s.configImportTitle}</h2>
          </div>
          <div className="config-import-export">
            <p className="config-description">{s.configImportDescription}</p>
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
                    commitResult({ ok: true, message: s.configExported })
                  })
                }}
              >
                {working === 'export-config'
                  ? s.exportingConfig
                  : s.exportConfig}
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
                    ? s.importingConfig
                    : s.importConfig}
                </button>
              </label>
            </div>
          </div>
        </article>

        {/* Operation Logs */}
        <article className="panel">
          <div className="section-title">
            <h2>{s.operationLogsTitle}</h2>
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
                ? s.clearingLogs
                : s.clearLogs}
            </button>
          </div>
          <div className="log-viewer">
            {dashboard.operationLogs.length === 0 ? (
              <p className="empty-tip">{s.noLogs}</p>
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

        {/* Backup Management */}
        <article className="panel">
          <div className="section-title">
            <h2>{s.backupManagementTitle}</h2>
          </div>
          <div className="backup-manager">
            {dashboard.backupHistory.length === 0 ? (
              <p className="empty-tip">{s.noBackups}</p>
            ) : (
              <div className="backup-list">
                {dashboard.backupHistory.map((record) => (
                  <div className="backup-item" key={record.filePath}>
                    <div className="backup-info">
                      <div className="backup-time">{formatDateTime(record.createdAt)}</div>
                      <div className="backup-path">{record.filePath}</div>
                      <div className="backup-meta">
                        {copy.variables.scope}: {record.scopeCount}
                      </div>
                    </div>
                    <div className="backup-actions">
                      <button
                        className="ghost-button"
                        disabled={working !== null}
                        onClick={async () => {
                          setConfirmDialog({
                            actionLabel: s.restoreConfirmAction,
                            confirmLabel: s.restoreConfirmLabel,
                            description: s.restoreConfirmDescription,
                            execute: async () => {
                              await runOperation(`restore-${record.filePath}`, async () => {
                                const result = await window.envPilot.restoreBackup(record.filePath)
                                commitResult(result)
                                await refreshDashboard()
                              })
                            },
                            targetLabel: formatDateTime(record.createdAt),
                            title: s.restoreConfirmTitle,
                          })
                        }}
                      >
                        {s.restoreBackup}
                      </button>
                      <button
                        className="danger-button"
                        disabled={working !== null}
                        onClick={async () => {
                          setConfirmDialog({
                            actionLabel: s.deleteConfirmAction,
                            confirmLabel: s.deleteConfirmLabel,
                            description: s.deleteConfirmDescription,
                            execute: async () => {
                              await runOperation(`delete-${record.filePath}`, async () => {
                                const result = await window.envPilot.deleteBackup(record.filePath)
                                commitResult(result)
                                await refreshDashboard()
                              })
                            },
                            targetLabel: formatDateTime(record.createdAt),
                            title: s.deleteConfirmTitle,
                          })
                        }}
                      >
                        {s.deleteBackup}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </article>

        {/* Diagnostics */}
        <article className="panel">
          <div className="section-title">
            <h2>{s.diagnosticsTitle}</h2>
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
                ? s.diagnosing
                : s.runDiagnostics}
            </button>
          </div>
          <div className="diagnostics-viewer">
            {!diagnostics ? (
              <p className="empty-tip">{s.noDiagnostics}</p>
            ) : (
              <div className="diagnostics-list">
                {diagnostics.map((category) => (
                  <div className="diagnostic-category" key={category.category}>
                    <h3>
                      {category.category === 'system'
                        ? s.diagnosticCategorySystem
                        : category.category === 'storage'
                          ? s.diagnosticCategoryStorage
                          : category.category === 'environment'
                            ? s.diagnosticCategoryEnvironment
                            : category.category === 'runtimes'
                              ? s.diagnosticCategoryRuntimes
                              : s.diagnosticCategoryNetwork}
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
            ? s.savingSettings
            : s.saveSettings}
        </button>
      </div>
    </>
  )
}
