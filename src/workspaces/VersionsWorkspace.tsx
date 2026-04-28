import { useAppContext } from '../hooks/useAppContext'
import { javaVendorLabel } from '../ui-copy'
import type { JavaVendor } from '../../shared/contracts'
import CollapsibleSection from '../components/CollapsibleSection'

export default function VersionsWorkspace() {
  const {
    dashboard,
    locale,
    copy,
    working,
    cleanupArchive,
    setCleanupArchive,
    javaVendor,
    setJavaVendor,
    javaVendors,
    selectedJavaVendor,
    supportedJavaVersions,
    runtimeInventory,
    getRuntimeBindings,
    handleInstallRuntime,
    handleSwitchRuntime,
    requestUninstallRuntime,
  } = useAppContext()

  if (!dashboard) return null

  return (
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

      <section className="card-grid three-columns workflow-grid">
        <article className="panel workflow-card">
          <span className="workflow-step">01</span>
          <strong>{copy.versions.workflowStep1Title}</strong>
          <p>{copy.versions.workflowStep1Description}</p>
        </article>
        <article className="panel workflow-card">
          <span className="workflow-step">02</span>
          <strong>{copy.versions.workflowStep2Title}</strong>
          <p>{copy.versions.workflowStep2Description}</p>
        </article>
        <article className="panel workflow-card">
          <span className="workflow-step">03</span>
          <strong>{copy.versions.workflowStep3Title}</strong>
          <p>{copy.versions.workflowStep3Description}</p>
        </article>
      </section>

      <section className="card-grid two-columns">
        {dashboard.managedRuntimes.map((runtime) => {
          const relatedInventory = runtimeInventory.find((item) => item.runtimeKey === runtime.key)
          const activeManagedVersion = runtime.installedVersions.find((version) => version.isActive)
          const runtimeBindings = getRuntimeBindings(runtime.key, activeManagedVersion)
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
                    {javaVendors.map((vendor: { key: JavaVendor; label: string; supportedVersions: string[] }) => (
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
                badge={
                  runtimeBindings.length > 0
                    ? copy.versions.environmentBindingsBadge(runtimeBindings.length)
                    : copy.versions.environmentBindingsNotActive
                }
                defaultOpen={Boolean(activeManagedVersion)}
                title={copy.versions.environmentBindings}
              >
                {runtimeBindings.length === 0 ? (
                  <p className="empty-tip">{copy.versions.noActiveVersionTip}</p>
                ) : (
                  <div className="binding-list">
                    {runtimeBindings.map((binding, index) => (
                      <div className="binding-row" key={`${runtime.key}-${binding.name}-${index}`}>
                        <strong>{binding.name}</strong>
                        <span>{binding.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CollapsibleSection>

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
                    ? javaVendorLabel[selectedJavaVendor.key as JavaVendor][locale]
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
}
